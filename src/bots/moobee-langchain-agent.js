/**
 * Moobee LangChain Agent Bot
 * @module bots/moobee-langchain-agent
 * @description Bot agentivo con LangChain per interazione intelligente con Moobee
 * @created 2025-01-23
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatDeepSeek } from '@langchain/community/chat_models/deepseek';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { DynamicStructuredTool } from 'langchain/tools';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { PrismaClient } from '@prisma/client';
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import { BufferMemory } from 'langchain/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import z from 'zod';

const prisma = new PrismaClient();

class MoobeeAgentBot {
  constructor() {
    // Initialize LLMs
    this.gpt5 = new ChatOpenAI({
      modelName: 'gpt-5',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    this.claude = new ChatAnthropic({
      modelName: 'claude-3-opus-20240229',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      temperature: 0.7
    });

    this.deepseek = new ChatDeepSeek({
      modelName: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY,
      temperature: 0.7
    });

    // Initialize embeddings for RAG
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Initialize vector store for RAG
    this.initializeVectorStore();

    // Initialize tools
    this.tools = this.createTools();

    // Initialize memory
    this.memory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history'
    });
  }

  async initializeVectorStore() {
    // Configure PGVector for RAG
    this.vectorStore = await PGVectorStore.initialize(this.embeddings, {
      postgresConnectionOptions: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'moobee'
      },
      tableName: 'moobee_embeddings',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content',
        metadataColumnName: 'metadata'
      }
    });
  }

  createTools() {
    return [
      // Tool per generare domande di engagement
      new DynamicStructuredTool({
        name: 'generate_engagement_questions',
        description: 'Genera domande di engagement personalizzate per dipendenti',
        schema: z.object({
          roleId: z.number().describe('ID del ruolo'),
          department: z.string().describe('Dipartimento'),
          context: z.string().describe('Contesto aziendale'),
          numberOfQuestions: z.number().default(5)
        }),
        func: async ({ roleId, department, context, numberOfQuestions }) => {
          // Query database per ottenere contesto
          const role = await prisma.roles.findUnique({
            where: { id: roleId }
          });

          const existingTemplates = await prisma.engagement_templates.findMany({
            where: { role_id: roleId },
            include: { questions: true }
          });

          // Usa multi-agent per generare domande collaborative
          const prompt = `
            Genera ${numberOfQuestions} domande di engagement per:
            - Ruolo: ${role?.name || 'General'}
            - Dipartimento: ${department}
            - Contesto: ${context}

            Considera le best practice UWES e Gallup Q12.
            Le domande devono essere specifiche, misurabili e azionabili.
          `;

          const response = await this.gpt5.invoke([
            { role: 'system', content: 'Sei un esperto HR specializzato in engagement surveys.' },
            { role: 'user', content: prompt }
          ]);

          return response.content;
        }
      }),

      // Tool per analizzare risultati assessment
      new DynamicStructuredTool({
        name: 'analyze_assessment_results',
        description: 'Analizza i risultati degli assessment e fornisce insights',
        schema: z.object({
          assessmentId: z.string().describe('ID assessment'),
          comparisonPeriod: z.string().optional().describe('Periodo di confronto')
        }),
        func: async ({ assessmentId, comparisonPeriod }) => {
          // Query risultati dal database
          const results = await prisma.assessment_results.findMany({
            where: { assessment_id: assessmentId },
            include: {
              user: true,
              responses: true
            }
          });

          // Analisi con RAG
          const relevantDocs = await this.vectorStore.similaritySearch(
            `assessment results analysis ${assessmentId}`,
            3
          );

          const analysisPrompt = `
            Analizza questi risultati di assessment:
            ${JSON.stringify(results, null, 2)}

            Documenti rilevanti dal knowledge base:
            ${relevantDocs.map(doc => doc.pageContent).join('\n')}

            Fornisci:
            1. Trend principali
            2. Aree di forza e debolezza
            3. Raccomandazioni specifiche
          `;

          const response = await this.claude.invoke([
            { role: 'system', content: 'Sei un esperto di analisi HR e assessment aziendali.' },
            { role: 'user', content: analysisPrompt }
          ]);

          return response.content;
        }
      }),

      // Tool per rispondere a domande HR
      new DynamicStructuredTool({
        name: 'answer_hr_question',
        description: 'Risponde a domande HR usando il knowledge base aziendale',
        schema: z.object({
          question: z.string().describe('Domanda HR'),
          context: z.string().optional().describe('Contesto aggiuntivo')
        }),
        func: async ({ question, context }) => {
          // RAG search nel database
          const relevantDocs = await this.vectorStore.similaritySearch(question, 5);

          // Query policy e procedure dal database
          const policies = await prisma.company_policies.findMany({
            where: {
              OR: [
                { title: { contains: question, mode: 'insensitive' } },
                { content: { contains: question, mode: 'insensitive' } }
              ]
            }
          });

          const ragContext = `
            Documenti rilevanti:
            ${relevantDocs.map(doc => doc.pageContent).join('\n---\n')}

            Policy aziendali:
            ${policies.map(p => `${p.title}: ${p.content}`).join('\n')}

            Contesto aggiuntivo: ${context || 'N/A'}
          `;

          const response = await this.deepseek.invoke([
            { role: 'system', content: 'Sei un assistente HR esperto che fornisce risposte accurate basate sulla documentazione aziendale.' },
            { role: 'user', content: `Domanda: ${question}\n\nContesto:\n${ragContext}` }
          ]);

          return response.content;
        }
      }),

      // Tool per suggerire percorsi formativi
      new DynamicStructuredTool({
        name: 'suggest_training_path',
        description: 'Suggerisce percorsi formativi personalizzati',
        schema: z.object({
          userId: z.string().describe('ID utente'),
          skills: z.array(z.string()).describe('Skills da sviluppare')
        }),
        func: async ({ userId, skills }) => {
          // Query profilo utente e storico formazione
          const user = await prisma.users.findUnique({
            where: { id: userId },
            include: {
              role: true,
              training_history: true,
              assessment_results: true
            }
          });

          // Query corsi disponibili
          const courses = await prisma.training_courses.findMany({
            where: {
              skills: {
                hasSome: skills
              }
            }
          });

          const prompt = `
            Utente: ${user?.name} (${user?.role?.name})
            Skills richieste: ${skills.join(', ')}
            Corsi disponibili: ${courses.map(c => c.title).join(', ')}

            Crea un percorso formativo personalizzato di 3-6 mesi.
          `;

          const response = await this.gpt5.invoke([
            { role: 'system', content: 'Sei un esperto di formazione e sviluppo del personale.' },
            { role: 'user', content: prompt }
          ]);

          return response.content;
        }
      })
    ];
  }

  async createAgent() {
    const prompt = PromptTemplate.fromTemplate(`
      Sei un assistente HR intelligente per Moobee, specializzato in:
      - Engagement e assessment dei dipendenti
      - Analisi dati HR e insights predittivi
      - Supporto decisionale per manager e HR
      - Formazione e sviluppo del personale

      Hai accesso a:
      - Database aziendale con dati di engagement, assessment e performance
      - Knowledge base con policy, procedure e best practices
      - Multi-agent collaboration per analisi complesse

      Conversazione precedente:
      {chat_history}

      Richiesta utente: {input}

      Usa i tool disponibili per fornire risposte accurate e contestualizzate.
      Quando possibile, basa le tue risposte su dati reali dal database.
    `);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.gpt5,
      tools: this.tools,
      prompt
    });

    return new AgentExecutor({
      agent,
      tools: this.tools,
      memory: this.memory,
      verbose: true
    });
  }

  // Metodo per processare domande
  async processQuestion(question, context = {}) {
    const agent = await this.createAgent();

    const response = await agent.invoke({
      input: question,
      context: JSON.stringify(context)
    });

    return response.output;
  }

  // Metodo per generare Q&A collaborative
  async generateCollaborativeQA(topic, numberOfPairs = 5) {
    const questions = [];
    const answers = [];

    // Genera domande usando GPT-5
    const questionPrompt = `
      Genera ${numberOfPairs} domande intelligenti su: ${topic}

      Le domande devono essere:
      - Rilevanti per HR e management
      - Specifiche per il contesto di Moobee
      - Progressivamente più approfondite

      Formato: Una domanda per riga
    `;

    const questionsResponse = await this.gpt5.invoke([
      { role: 'system', content: 'Sei un esperto HR che formula domande strategiche.' },
      { role: 'user', content: questionPrompt }
    ]);

    const generatedQuestions = questionsResponse.content.split('\n').filter(q => q.trim());

    // Per ogni domanda, genera una risposta usando Claude
    for (const question of generatedQuestions) {
      // Cerca contesto nel database
      const relevantDocs = await this.vectorStore.similaritySearch(question, 3);

      const answerPrompt = `
        Domanda: ${question}

        Contesto dal database Moobee:
        ${relevantDocs.map(doc => doc.pageContent).join('\n')}

        Fornisci una risposta completa e azionabile.
      `;

      const answerResponse = await this.claude.invoke([
        { role: 'system', content: 'Sei un consulente HR senior con esperienza in sistemi di engagement.' },
        { role: 'user', content: answerPrompt }
      ]);

      questions.push(question);
      answers.push(answerResponse.content);
    }

    return {
      topic,
      timestamp: new Date(),
      qa_pairs: questions.map((q, i) => ({
        question: q,
        answer: answers[i]
      }))
    };
  }

  // Metodo per indexare documenti nel vector store
  async indexDocuments(documents) {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });

    const docs = await textSplitter.createDocuments(documents);
    await this.vectorStore.addDocuments(docs);

    return `Indexed ${docs.length} document chunks`;
  }
}

export default MoobeeAgentBot;