/**
 * Script to Generate 10 Diverse Assessment Templates
 * Creates assessment templates with varied configurations for testing
 * @module scripts/generate-assessment-templates
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-secret-key';

// Generate auth token
const generateToken = () => {
  return jwt.sign(
    {
      id: 'template-generator',
      email: 'admin@moobee.com',
      role: 'admin',
      tenantId: 'moobee-main'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Template definitions
const assessmentTemplates = [
  {
    name: 'Big Five Personality Assessment - Senior Developer',
    type: 'big_five',
    description: 'Valutazione completa della personalità per sviluppatori senior. Analizza i cinque grandi fattori della personalità per identificare punti di forza e aree di crescita.',
    language: 'it',
    isActive: true,
    frequency: 'yearly',
    targetRoles: ['Senior Developer', 'Tech Lead', 'Software Architect'],
    estimatedTime: 20,
    metadata: {
      department: 'Engineering',
      level: 'senior',
      focusAreas: ['leadership', 'problem-solving', 'teamwork']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7
    },
    questionCount: 20
  },
  {
    name: 'DISC Behavioral Profile - Sales Team',
    type: 'disc',
    description: 'Profilo comportamentale DISC per il team vendite. Identifica lo stile comportamentale dominante per ottimizzare le strategie di vendita e la comunicazione con i clienti.',
    language: 'it',
    isActive: true,
    frequency: 'quarterly',
    targetRoles: ['Sales Representative', 'Account Manager', 'Business Development'],
    estimatedTime: 15,
    metadata: {
      department: 'Sales',
      level: 'all',
      focusAreas: ['communication', 'influence', 'persistence']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.6
    },
    questionCount: 15
  },
  {
    name: 'Belbin Team Roles - Project Managers',
    type: 'belbin',
    description: 'Identificazione dei ruoli di team secondo Belbin per project manager. Comprende i ruoli preferiti nel team per una gestione efficace dei progetti.',
    language: 'it',
    isActive: true,
    frequency: 'yearly',
    targetRoles: ['Project Manager', 'Scrum Master', 'Product Owner'],
    estimatedTime: 18,
    metadata: {
      department: 'Project Management',
      level: 'mid-senior',
      focusAreas: ['coordination', 'team-building', 'resource-management']
    },
    aiConfig: {
      provider: 'anthropic',
      model: 'claude-3',
      temperature: 0.7
    },
    questionCount: 15
  },
  {
    name: 'Competency Assessment - HR Specialists',
    type: 'competency',
    description: 'Valutazione delle competenze chiave per specialisti HR. Copre competenze tecniche e soft skills essenziali per la gestione delle risorse umane.',
    language: 'it',
    isActive: true,
    frequency: 'semi-annually',
    targetRoles: ['HR Specialist', 'HR Manager', 'Talent Acquisition'],
    estimatedTime: 25,
    metadata: {
      department: 'Human Resources',
      level: 'specialist',
      focusAreas: ['recruitment', 'employee-relations', 'compliance']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-5',
      temperature: 0.8
    },
    questionCount: 18
  },
  {
    name: 'Big Five Assessment - Marketing Creatives',
    type: 'big_five',
    description: 'Assessment personalità per team creativi marketing. Valuta creatività, apertura mentale e capacità collaborative nel contesto del marketing digitale.',
    language: 'it',
    isActive: true,
    frequency: 'yearly',
    targetRoles: ['Marketing Manager', 'Content Creator', 'Brand Manager'],
    estimatedTime: 20,
    metadata: {
      department: 'Marketing',
      level: 'all',
      focusAreas: ['creativity', 'innovation', 'brand-awareness']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.9
    },
    questionCount: 20
  },
  {
    name: 'DISC Profile - Customer Support Team',
    type: 'disc',
    description: 'Profilo DISC per team di supporto clienti. Ottimizza le interazioni con i clienti identificando stili di comunicazione e approcci più efficaci.',
    language: 'it',
    isActive: true,
    frequency: 'quarterly',
    targetRoles: ['Customer Support', 'Technical Support', 'Customer Success Manager'],
    estimatedTime: 12,
    metadata: {
      department: 'Customer Service',
      level: 'junior-mid',
      focusAreas: ['patience', 'empathy', 'problem-resolution']
    },
    aiConfig: {
      provider: 'anthropic',
      model: 'claude-3',
      temperature: 0.6
    },
    questionCount: 12
  },
  {
    name: 'Belbin Roles - UX/UI Designers',
    type: 'belbin',
    description: 'Mappatura ruoli Belbin per designer UX/UI. Identifica come i designer contribuiscono meglio ai team di prodotto e sviluppo.',
    language: 'it',
    isActive: true,
    frequency: 'yearly',
    targetRoles: ['UX Designer', 'UI Designer', 'Product Designer'],
    estimatedTime: 15,
    metadata: {
      department: 'Design',
      level: 'all',
      focusAreas: ['creativity', 'user-empathy', 'visual-communication']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.8
    },
    questionCount: 14
  },
  {
    name: 'Leadership Competency - C-Level Executives',
    type: 'competency',
    description: 'Valutazione competenze leadership per dirigenti C-level. Assessment approfondito delle capacità strategiche e di leadership executive.',
    language: 'it',
    isActive: true,
    frequency: 'yearly',
    targetRoles: ['CEO', 'CTO', 'CFO', 'COO', 'CMO'],
    estimatedTime: 30,
    metadata: {
      department: 'Executive',
      level: 'executive',
      focusAreas: ['strategic-thinking', 'decision-making', 'vision']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-5',
      temperature: 0.7
    },
    questionCount: 20
  },
  {
    name: 'Big Five Quick Assessment - Interns',
    type: 'big_five',
    description: 'Assessment rapido della personalità per stagisti e junior. Versione semplificata per identificare potenziale e aree di sviluppo.',
    language: 'it',
    isActive: true,
    frequency: 'monthly',
    targetRoles: ['Intern', 'Junior Developer', 'Junior Analyst'],
    estimatedTime: 10,
    metadata: {
      department: 'Various',
      level: 'entry',
      focusAreas: ['learning-ability', 'adaptability', 'enthusiasm']
    },
    aiConfig: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7
    },
    questionCount: 10
  },
  {
    name: 'DISC Assessment - Remote Team Members',
    type: 'disc',
    description: 'Profilo DISC ottimizzato per team remoti. Focus su comunicazione asincrona, autonomia e collaborazione virtuale.',
    language: 'it',
    isActive: true,
    frequency: 'semi-annually',
    targetRoles: ['Remote Developer', 'Remote Manager', 'Virtual Assistant'],
    estimatedTime: 15,
    metadata: {
      department: 'Remote Teams',
      level: 'all',
      focusAreas: ['self-management', 'virtual-communication', 'time-management']
    },
    aiConfig: {
      provider: 'anthropic',
      model: 'claude-3',
      temperature: 0.7
    },
    questionCount: 16
  }
];

// Function to generate questions based on assessment type
const generateQuestionsForType = (type, count = 10) => {
  const questionTemplates = {
    big_five: [
      { text: 'Mi piace essere al centro dell\'attenzione', category: 'extraversion' },
      { text: 'Preferisco lavorare da solo piuttosto che in gruppo', category: 'extraversion' },
      { text: 'Sono sempre pronto ad aiutare gli altri', category: 'agreeableness' },
      { text: 'Mi fido facilmente delle persone', category: 'agreeableness' },
      { text: 'Mantengo le mie cose in ordine', category: 'conscientiousness' },
      { text: 'Seguo sempre un piano dettagliato', category: 'conscientiousness' },
      { text: 'Mi preoccupo spesso per il futuro', category: 'neuroticism' },
      { text: 'Gestisco bene lo stress', category: 'neuroticism' },
      { text: 'Ho molti interessi diversi', category: 'openness' },
      { text: 'Mi piace provare cose nuove', category: 'openness' },
      { text: 'Sono una persona energica e entusiasta', category: 'extraversion' },
      { text: 'Preferisco routine stabili a cambiamenti frequenti', category: 'openness' },
      { text: 'Sono sensibile ai sentimenti degli altri', category: 'agreeableness' },
      { text: 'Completo sempre i compiti che inizio', category: 'conscientiousness' },
      { text: 'Rimango calmo anche in situazioni difficili', category: 'neuroticism' },
      { text: 'Mi adatto facilmente a nuove situazioni', category: 'openness' },
      { text: 'Sono organizzato e metodico nel mio lavoro', category: 'conscientiousness' },
      { text: 'Mi sento a mio agio nel parlare in pubblico', category: 'extraversion' },
      { text: 'Evito i conflitti quando possibile', category: 'agreeableness' },
      { text: 'Mi sento spesso ansioso o preoccupato', category: 'neuroticism' }
    ],
    disc: [
      { text: 'Prendo decisioni rapidamente', category: 'dominance' },
      { text: 'Mi piace influenzare e persuadere gli altri', category: 'influence' },
      { text: 'Preferisco ambienti stabili e prevedibili', category: 'steadiness' },
      { text: 'Presto attenzione ai dettagli', category: 'compliance' },
      { text: 'Sono orientato ai risultati', category: 'dominance' },
      { text: 'Sono ottimista ed entusiasta', category: 'influence' },
      { text: 'Sono paziente e supportivo', category: 'steadiness' },
      { text: 'Seguo le regole e le procedure', category: 'compliance' },
      { text: 'Mi piace affrontare sfide difficili', category: 'dominance' },
      { text: 'Costruisco facilmente relazioni', category: 'influence' },
      { text: 'Sono affidabile e consistente', category: 'steadiness' },
      { text: 'Analizzo accuratamente prima di agire', category: 'compliance' },
      { text: 'Sono diretto e franco nella comunicazione', category: 'dominance' },
      { text: 'Mi piace lavorare in team', category: 'influence' },
      { text: 'Mantengo la calma sotto pressione', category: 'steadiness' },
      { text: 'Mi concentro sulla qualità del lavoro', category: 'compliance' },
      { text: 'Assumo il controllo nelle situazioni', category: 'dominance' },
      { text: 'Sono espressivo e comunicativo', category: 'influence' },
      { text: 'Sono leale e dedicato', category: 'steadiness' },
      { text: 'Pianifico attentamente le mie azioni', category: 'compliance' }
    ],
    belbin: [
      { text: 'Mi piace coordinare il lavoro del team', category: 'coordinator' },
      { text: 'Genero molte idee creative', category: 'plant' },
      { text: 'Sono bravo a identificare risorse esterne', category: 'resource_investigator' },
      { text: 'Trasformo le idee in azioni pratiche', category: 'implementer' },
      { text: 'Mi assicuro che il lavoro sia completato nei tempi', category: 'completer_finisher' },
      { text: 'Analizzo e valuto le proposte oggettivamente', category: 'monitor_evaluator' },
      { text: 'Supporto e incoraggio i membri del team', category: 'team_worker' },
      { text: 'Mi piace guidare e prendere decisioni', category: 'shaper' },
      { text: 'Fornisco conoscenze specialistiche', category: 'specialist' },
      { text: 'Facilito la collaborazione nel team', category: 'coordinator' },
      { text: 'Propongo soluzioni innovative', category: 'plant' },
      { text: 'Creo network e contatti utili', category: 'resource_investigator' },
      { text: 'Organizzo il lavoro in modo sistematico', category: 'implementer' },
      { text: 'Perfeziono i dettagli del lavoro', category: 'completer_finisher' },
      { text: 'Identifico punti deboli nelle proposte', category: 'monitor_evaluator' }
    ],
    competency: [
      { text: 'Descrivi la tua esperienza nella gestione di progetti complessi', category: 'project_management' },
      { text: 'Come gestisci i conflitti nel team?', category: 'conflict_resolution' },
      { text: 'Quali strumenti utilizzi per l\'analisi dei dati?', category: 'technical_skills' },
      { text: 'Come prioritizzi le tue attività quotidiane?', category: 'time_management' },
      { text: 'Descrivi un esempio di leadership efficace', category: 'leadership' },
      { text: 'Come ti mantieni aggiornato nel tuo campo?', category: 'continuous_learning' },
      { text: 'Come gestisci lo stress sul lavoro?', category: 'stress_management' },
      { text: 'Descrivi la tua esperienza con presentazioni pubbliche', category: 'communication' },
      { text: 'Come approcci il problem solving?', category: 'problem_solving' },
      { text: 'Quali sono le tue strategie di negoziazione?', category: 'negotiation' },
      { text: 'Come gestisci il feedback negativo?', category: 'resilience' },
      { text: 'Descrivi la tua esperienza nel mentoring', category: 'mentoring' },
      { text: 'Come promuovi l\'innovazione nel team?', category: 'innovation' },
      { text: 'Quali sono le tue competenze digitali?', category: 'digital_skills' },
      { text: 'Come gestisci budget e risorse?', category: 'resource_management' },
      { text: 'Descrivi la tua esperienza con clienti difficili', category: 'customer_service' },
      { text: 'Come misuri il successo dei tuoi progetti?', category: 'performance_metrics' },
      { text: 'Quali sono le tue strategie di team building?', category: 'team_building' },
      { text: 'Come gestisci il cambiamento organizzativo?', category: 'change_management' },
      { text: 'Descrivi le tue competenze interculturali', category: 'cultural_awareness' }
    ]
  };

  const templates = questionTemplates[type] || questionTemplates.big_five;
  const questions = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const questionType = type === 'competency' ? 'text' : 'likert';

    questions.push({
      text: template.text,
      type: questionType,
      orderIndex: i,
      required: true,
      category: template.category,
      weight: 1.0,
      ...(questionType === 'likert' && {
        options: [
          { text: 'Fortemente in disaccordo', value: 1 },
          { text: 'In disaccordo', value: 2 },
          { text: 'Neutro', value: 3 },
          { text: 'D\'accordo', value: 4 },
          { text: 'Fortemente d\'accordo', value: 5 }
        ]
      }),
      ...(questionType === 'text' && {
        maxLength: 500,
        placeholder: 'Fornisci una risposta dettagliata...'
      })
    });
  }

  return questions;
};

// Main function to create templates
async function createAssessmentTemplates() {
  console.log('🚀 Starting Assessment Template Generation...\n');

  const authToken = generateToken();
  const results = {
    success: [],
    failed: []
  };

  for (const [index, template] of assessmentTemplates.entries()) {
    console.log(`📝 Creating template ${index + 1}/10: ${template.name}`);

    try {
      // Generate questions for the template
      const questions = generateQuestionsForType(template.type, template.questionCount);

      // Prepare template data
      const templateData = {
        name: template.name,
        type: template.type,
        description: template.description,
        language: template.language,
        isActive: template.isActive,
        frequency: template.frequency,
        targetRoles: template.targetRoles,
        estimatedTime: template.estimatedTime,
        metadata: template.metadata,
        questions: questions
      };

      // Create template via API
      const response = await axios.post(
        `${API_BASE_URL}/api/assessments/templates`,
        templateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          validateStatus: function (status) {
            return status < 500; // Don't throw on 4xx errors
          }
        }
      );

      if ((response.status === 200 || response.status === 201) && response.data) {
        // Handle wrapped response format
        const actualData = response.data.data || response.data;
        const responseId = actualData.id;

        if (response.data.success && responseId) {
          console.log(`✅ Successfully created: ${template.name}`);
          console.log(`   ID: ${responseId}`);
          console.log(`   Questions: ${actualData.questions?.length || 0}`);
          console.log(`   Type: ${template.type}`);
          console.log(`   Roles: ${template.targetRoles.join(', ')}\n`);

          results.success.push({
            id: responseId,
            name: template.name,
            type: template.type
          });
        } else {
          console.error(`⚠️ Template created but unexpected response format: ${template.name}`);
          results.success.push({
            id: responseId || 'unknown',
            name: template.name,
            type: template.type
          });
        }
      } else {
        console.error(`❌ Failed to create: ${template.name}`);
        console.error(`   Status: ${response.status}`);
        console.error(`   Error: ${JSON.stringify(response.data, null, 2)}\n`);

        results.failed.push({
          name: template.name,
          error: response.data?.error || response.data?.errors || 'Unknown error',
          status: response.status,
          details: response.data
        });
      }
    } catch (error) {
      console.error(`❌ Failed to create: ${template.name}`);
      console.error(`   Error: ${error.response?.data?.error || error.response?.data?.errors || error.message}\n`);

      results.failed.push({
        name: template.name,
        error: error.response?.data?.error || error.message
      });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 GENERATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully created: ${results.success.length} templates`);
  console.log(`❌ Failed: ${results.failed.length} templates`);

  if (results.success.length > 0) {
    console.log('\n📋 Created Templates:');
    results.success.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} (${t.type}) - ID: ${t.id}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n⚠️  Failed Templates:');
    results.failed.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} - ${t.error}`);
    });
  }

  console.log('\n✨ Template generation complete!\n');

  // Save results to file
  const fs = require('fs');
  const outputPath = '/home/mgiurelli/sviluppo/moobee/BE_nodejs/scripts/generated-templates.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved to: ${outputPath}`);

  await prisma.$disconnect();
  return results;
}

// Execute if run directly
if (require.main === module) {
  createAssessmentTemplates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createAssessmentTemplates, generateQuestionsForType };