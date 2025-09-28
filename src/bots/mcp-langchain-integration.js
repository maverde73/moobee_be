/**
 * MCP-LangChain Integration
 * @module bots/mcp-langchain-integration
 * @description Integrazione tra Multi-Agent MCP e LangChain per Moobee
 * @created 2025-01-23
 */

import { spawn } from 'child_process';
import { Tool } from 'langchain/tools';
import z from 'zod';

class MCPMultiAgentTool extends Tool {
  name = 'mcp_multi_agent';
  description = 'Utilizza multi-agent MCP per collaborazione tra GPT-5, Claude e DeepSeek';

  constructor() {
    super();
    this.mcpServerPath = '/home/mgiurelli/sviluppo/moobee/Server-mcp/multi-agent-mcp/build/index.js';
  }

  async _call(input) {
    const { operation, prompt, agents, rounds, context } = JSON.parse(input);

    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', [this.mcpServerPath], {
        env: {
          ...process.env,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
        }
      });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: `multi_agent_${operation}`,
          arguments: {
            prompt,
            agents: agents || ['gpt-5', 'claude', 'deepseek'],
            rounds: rounds || 2,
            context
          }
        },
        id: Date.now()
      };

      let responseData = '';

      mcpProcess.stdout.on('data', (data) => {
        responseData += data.toString();
      });

      mcpProcess.stderr.on('data', (data) => {
        console.error('MCP Error:', data.toString());
      });

      mcpProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const response = JSON.parse(responseData);
            resolve(response.result || responseData);
          } catch (e) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`MCP process exited with code ${code}`));
        }
      });

      // Send request
      mcpProcess.stdin.write(JSON.stringify(request) + '\n');
      mcpProcess.stdin.end();
    });
  }
}

/**
 * Enhanced Moobee Agent with MCP Integration
 */
class EnhancedMoobeeAgent {
  constructor() {
    this.mcpTool = new MCPMultiAgentTool();
  }

  /**
   * Usa multi-agent brainstorming per generare idee
   */
  async brainstormIdeas(topic, context = {}) {
    const input = JSON.stringify({
      operation: 'brainstorm',
      prompt: topic,
      agents: ['gpt-5', 'claude', 'deepseek'],
      rounds: 2,
      context
    });

    return await this.mcpTool._call(input);
  }

  /**
   * Usa multi-agent per risolvere problemi complessi
   */
  async solveProblem(problem, strategy = 'parallel') {
    const input = JSON.stringify({
      operation: 'solve',
      prompt: problem,
      agents: ['gpt-5', 'claude'],
      context: { strategy }
    });

    return await this.mcpTool._call(input);
  }

  /**
   * Usa multi-agent per revisione collaborativa
   */
  async reviewContent(content, criteria = []) {
    const input = JSON.stringify({
      operation: 'review',
      prompt: `Revisiona questo contenuto: ${content}`,
      agents: ['claude', 'deepseek'],
      context: { criteria }
    });

    return await this.mcpTool._call(input);
  }

  /**
   * Genera Q&A usando multi-agent consensus
   */
  async generateConsensusQA(topic, numberOfQuestions = 5) {
    // Prima: brainstorming per le domande
    const brainstormResult = await this.brainstormIdeas(
      `Genera ${numberOfQuestions} domande strategiche per HR su: ${topic}`
    );

    // Poi: consensus per le risposte
    const consensusInput = JSON.stringify({
      operation: 'consensus',
      prompt: `Crea risposte definitive per queste domande HR:\n${brainstormResult}`,
      agents: ['gpt-5', 'claude', 'deepseek']
    });

    const consensusResult = await this.mcpTool._call(consensusInput);

    return {
      topic,
      brainstorm: brainstormResult,
      consensus: consensusResult,
      timestamp: new Date()
    };
  }

  /**
   * Analisi multi-prospettiva di dati HR
   */
  async analyzeHRData(data, analysisType) {
    const analysisPrompts = {
      engagement: 'Analizza i dati di engagement e identifica trend, rischi e opportunità',
      performance: 'Valuta le performance e suggerisci interventi di miglioramento',
      retention: 'Analizza i fattori di retention e predici potenziali turnover',
      culture: 'Valuta il clima aziendale e l\'allineamento culturale'
    };

    const prompt = analysisPrompts[analysisType] || 'Analizza questi dati HR';

    const input = JSON.stringify({
      operation: 'solve',
      prompt: `${prompt}\n\nDati:\n${JSON.stringify(data, null, 2)}`,
      agents: ['gpt-5', 'claude', 'deepseek'],
      context: {
        analysisType,
        requireMetrics: true,
        requireActionPlan: true
      }
    });

    return await this.mcpTool._call(input);
  }
}

/**
 * Factory per creare agenti specializzati
 */
class MoobeeAgentFactory {
  static createEngagementAgent() {
    const agent = new EnhancedMoobeeAgent();

    return {
      async generateEngagementSurvey(roleId, department) {
        const topic = `Survey di engagement per ${department}`;
        const qa = await agent.generateConsensusQA(topic, 10);

        return {
          type: 'engagement_survey',
          roleId,
          department,
          questions: qa.consensus,
          generatedBy: 'multi-agent-mcp',
          timestamp: qa.timestamp
        };
      },

      async analyzeEngagementResults(results) {
        return await agent.analyzeHRData(results, 'engagement');
      },

      async suggestImprovements(currentScore, targetScore) {
        const problem = `
          Score engagement attuale: ${currentScore}
          Target: ${targetScore}

          Come migliorare l'engagement del team?
        `;

        return await agent.solveProblem(problem);
      }
    };
  }

  static createAssessmentAgent() {
    const agent = new EnhancedMoobeeAgent();

    return {
      async createAssessment(type, role, skills) {
        const topic = `Assessment ${type} per ${role} con focus su: ${skills.join(', ')}`;
        return await agent.brainstormIdeas(topic);
      },

      async evaluateResponses(responses, rubric) {
        const content = JSON.stringify({ responses, rubric });
        return await agent.reviewContent(content, ['accuracy', 'completeness', 'clarity']);
      },

      async generateFeedback(assessmentResults) {
        const prompt = `
          Genera feedback costruttivo e piano di sviluppo per:
          ${JSON.stringify(assessmentResults, null, 2)}
        `;

        return await agent.solveProblem(prompt, 'sequential');
      }
    };
  }

  static createHRAdvisorAgent() {
    const agent = new EnhancedMoobeeAgent();

    return {
      async answerHRQuestion(question, context) {
        // Usa multi-agent per risposta completa
        const prompt = `
          Domanda HR: ${question}
          Contesto aziendale: ${JSON.stringify(context)}

          Fornisci una risposta completa con:
          1. Risposta diretta
          2. Considerazioni legali
          3. Best practices
          4. Esempi pratici
        `;

        return await agent.solveProblem(prompt);
      },

      async createPolicy(policyType, requirements) {
        const topic = `Policy aziendale per ${policyType} con requisiti: ${requirements}`;
        const draft = await agent.brainstormIdeas(topic);
        const refined = await agent.reviewContent(draft, ['legal_compliance', 'clarity', 'completeness']);

        return {
          draft,
          refined,
          type: policyType
        };
      },

      async strategicPlanning(goals, constraints, timeframe) {
        const problem = `
          Obiettivi HR: ${goals.join(', ')}
          Vincoli: ${constraints.join(', ')}
          Timeframe: ${timeframe}

          Crea un piano strategico dettagliato.
        `;

        return await agent.generateConsensusQA(problem, 8);
      }
    };
  }
}

export {
  MCPMultiAgentTool,
  EnhancedMoobeeAgent,
  MoobeeAgentFactory
};