/**
 * Script per generare 16 template di engagement diversificati
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3000/api';

// Token will be obtained dynamically from login
let AUTH_TOKEN = '';

// 16 template diversificati
const templateConfigs = [
  {
    name: 'Frontend Developer Engagement Q1 2025',
    description: 'Quarterly engagement survey for frontend developers',
    type: 'UWES',
    instructions: 'Valuta la tua esperienza lavorativa degli ultimi 3 mesi.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 2,
    areas: ['MOTIVATION', 'GROWTH', 'COMMUNICATION']
  },
  {
    name: 'Backend Team Weekly Pulse',
    description: 'Weekly pulse check for backend development team',
    type: 'CUSTOM',
    instructions: 'Survey veloce per monitorare il benessere settimanale.',
    suggestedFrequency: 'WEEKLY',
    roleCount: 3,
    areas: ['WORK_LIFE_BALANCE', 'MOTIVATION']
  },
  {
    name: 'DevOps Annual Gallup Survey',
    description: 'Annual Gallup Q12 assessment for DevOps teams',
    type: 'GALLUP_Q12',
    instructions: 'Valutazione annuale completa basata sul modello Gallup.',
    suggestedFrequency: 'ANNUAL',
    roleCount: 2,
    areas: ['LEADERSHIP', 'BELONGING', 'GROWTH', 'COMMUNICATION']
  },
  {
    name: 'QA Team Engagement Monthly',
    description: 'Monthly engagement survey for quality assurance teams',
    type: 'UWES',
    instructions: 'Rifletti sulla tua esperienza lavorativa del mese appena trascorso.',
    suggestedFrequency: 'MONTHLY',
    roleCount: 2,
    areas: ['MOTIVATION', 'LEADERSHIP', 'BELONGING']
  },
  {
    name: 'Product Team Sprint Retrospective',
    description: 'Bi-weekly sprint retrospective engagement survey',
    type: 'CUSTOM',
    instructions: 'Valuta il tuo engagement durante lo sprint appena concluso.',
    suggestedFrequency: 'WEEKLY',
    roleCount: 3,
    areas: ['COMMUNICATION', 'LEADERSHIP', 'GROWTH']
  },
  {
    name: 'Data Science Quarterly Check',
    description: 'Quarterly engagement assessment for data science teams',
    type: 'GALLUP_Q12',
    instructions: 'Analizza il tuo livello di engagement nel trimestre.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 2,
    areas: ['GROWTH', 'MOTIVATION', 'WORK_LIFE_BALANCE', 'COMMUNICATION']
  },
  {
    name: 'Mobile Development Engagement',
    description: 'Bi-annual engagement survey for mobile developers',
    type: 'UWES',
    instructions: 'Valutazione semestrale del tuo coinvolgimento lavorativo.',
    suggestedFrequency: 'BIANNUAL',
    roleCount: 2,
    areas: ['MOTIVATION', 'BELONGING', 'LEADERSHIP']
  },
  {
    name: 'Infrastructure Team Pulse',
    description: 'Weekly pulse survey for infrastructure and platform teams',
    type: 'CUSTOM',
    instructions: 'Monitora il tuo benessere lavorativo settimanale.',
    suggestedFrequency: 'WEEKLY',
    roleCount: 3,
    areas: ['WORK_LIFE_BALANCE', 'COMMUNICATION', 'LEADERSHIP']
  },
  {
    name: 'Security Team Engagement Annual',
    description: 'Annual comprehensive engagement survey for security teams',
    type: 'GALLUP_Q12',
    instructions: 'Valutazione annuale approfondita del tuo engagement.',
    suggestedFrequency: 'ANNUAL',
    roleCount: 2,
    areas: ['LEADERSHIP', 'GROWTH', 'BELONGING', 'MOTIVATION']
  },
  {
    name: 'UX Design Team Monthly Survey',
    description: 'Monthly engagement check for UX and design teams',
    type: 'UWES',
    instructions: 'Rifletti sul tuo coinvolgimento nel processo creativo.',
    suggestedFrequency: 'MONTHLY',
    roleCount: 2,
    areas: ['GROWTH', 'COMMUNICATION', 'MOTIVATION']
  },
  {
    name: 'Cloud Engineering Quarterly',
    description: 'Quarterly assessment for cloud engineering teams',
    type: 'CUSTOM',
    instructions: 'Valuta il tuo engagement nel cloud engineering.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 3,
    areas: ['MOTIVATION', 'WORK_LIFE_BALANCE', 'GROWTH', 'BELONGING']
  },
  {
    name: 'AI/ML Team Engagement Bi-Annual',
    description: 'Bi-annual survey for artificial intelligence and machine learning teams',
    type: 'GALLUP_Q12',
    instructions: 'Valutazione semestrale per team di AI e Machine Learning.',
    suggestedFrequency: 'BIANNUAL',
    roleCount: 2,
    areas: ['GROWTH', 'LEADERSHIP', 'COMMUNICATION', 'MOTIVATION']
  },
  {
    name: 'Database Team Weekly Check',
    description: 'Weekly engagement pulse for database administrators and engineers',
    type: 'CUSTOM',
    instructions: 'Check settimanale veloce sul tuo benessere lavorativo.',
    suggestedFrequency: 'WEEKLY',
    roleCount: 2,
    areas: ['WORK_LIFE_BALANCE', 'BELONGING']
  },
  {
    name: 'Full Stack Developer Monthly',
    description: 'Monthly engagement survey for full stack developers',
    type: 'UWES',
    instructions: 'Valuta mensilmente il tuo livello di engagement.',
    suggestedFrequency: 'MONTHLY',
    roleCount: 3,
    areas: ['MOTIVATION', 'GROWTH', 'COMMUNICATION', 'LEADERSHIP']
  },
  {
    name: 'Tech Lead Quarterly Assessment',
    description: 'Quarterly leadership and engagement assessment for tech leads',
    type: 'GALLUP_Q12',
    instructions: 'Autovalutazione trimestrale per tech lead e team leader.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 2,
    areas: ['LEADERSHIP', 'COMMUNICATION', 'BELONGING', 'GROWTH']
  },
  {
    name: 'Remote Team Engagement Special',
    description: 'Special engagement survey for remote and distributed teams',
    type: 'CUSTOM',
    instructions: 'Survey specifico per team remoti e distribuiti.',
    suggestedFrequency: 'MONTHLY',
    roleCount: 4,
    areas: ['COMMUNICATION', 'BELONGING', 'WORK_LIFE_BALANCE', 'MOTIVATION']
  }
];

// Funzione per ottenere ruoli casuali
async function getRandomRoles(count) {
  try {
    const roles = await prisma.$queryRaw`
      SELECT
        id::text as id,
        COALESCE("NameKnown_Role", "Role", name) as name
      FROM roles
      WHERE "NameKnown_Role" IS NOT NULL
      ORDER BY RANDOM()
      LIMIT ${count}
    `;

    return roles.map(role => ({
      id: role.id,
      name: role.name
    }));
  } catch (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
}

// Funzione per generare domande con AI
async function generateQuestionsWithAI(type, roles, areas, temperature = 0.7) {
  const roleNames = roles.map(r => r.name).join(', ');
  const roleId = parseInt(roles[0].id);

  try {
    const response = await axios.post(
      `${API_BASE}/engagement/ai/generate-questions`,
      {
        type: type,
        roleId: roleId,
        roleName: roleNames,
        numberOfQuestions: 10,
        areas: areas,
        language: 'it',
        aiConfig: {
          provider: 'openai',
          model: 'gpt-5',
          temperature: temperature, // Variabile per diversificare
          maxTokens: 2000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 secondi timeout
      }
    );

    // La risposta contiene i dati nel campo data
    if (response.data && response.data.data) {
      return response.data.data;
    }
    return response.data;
  } catch (error) {
    console.error('Error generating questions:', error.response?.data || error.message);
    // Ritorna un oggetto vuoto invece di lanciare errore
    return {
      questions: [],
      metadata: {
        error: 'Failed to generate questions',
        provider: 'openai',
        model: 'gpt-5'
      }
    };
  }
}

// Funzione per creare il template
async function createTemplate(config, roles, aiResponse) {
  const suggestedRoles = roles.map(r => `${r.id}:${r.name}`);

  // Estrai il prompt dalla risposta AI
  const promptUsed = aiResponse.metadata?.promptUsed || aiResponse.metadata?.prompt || '';
  const aiProvider = aiResponse.metadata?.provider || 'openai';
  const aiModel = aiResponse.metadata?.model || 'gpt-5';

  const templateData = {
    name: config.name,
    type: config.type,
    roleId: null,
    description: config.description,
    instructions: config.instructions,
    suggestedFrequency: config.suggestedFrequency,
    questions: aiResponse.questions || [],
    metadata: {
      aiGenerated: true,
      promptUsed: promptUsed,
      aiProvider: aiProvider,
      aiModel: aiModel,
      suggestedRoles: suggestedRoles,
      roleNames: roles.map(r => r.name),
      generatedAt: new Date().toISOString(),
      areas: config.areas,
      language: 'it',
      temperature: config.temperature || 0.7,
      maxTokens: 2000,
      numberOfQuestions: aiResponse.questions?.length || 0
    }
  };

  try {
    const response = await axios.post(
      `${API_BASE}/engagement/templates`,
      templateData,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating template:', error.response?.data || error.message);
    throw error;
  }
}

// Funzione per ottenere il token di autenticazione
async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE}/login`, {
      email: 'superadmin@test.com',
      password: 'Test123!'
    });

    if (response.data.accessToken) {
      return response.data.accessToken;
    }
    throw new Error('No access token received');
  } catch (error) {
    console.error('❌ Errore nel login:', error.response?.data || error.message);
    throw error;
  }
}

// Funzione principale
async function main() {
  console.log('🚀 Inizio generazione di 16 template di engagement...\n');

  // Prima ottieni il token
  console.log('🔐 Ottenimento token di autenticazione...');
  try {
    AUTH_TOKEN = await getAuthToken();
    console.log('✅ Token ottenuto con successo\n');
  } catch (error) {
    console.error('❌ Impossibile ottenere il token di autenticazione');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < templateConfigs.length; i++) {
    const config = templateConfigs[i];
    console.log(`\n📝 Template ${i + 1}/${templateConfigs.length}: ${config.name}`);

    try {
      // 1. Ottieni ruoli casuali
      console.log(`   Selezione ${config.roleCount} ruoli...`);
      const roles = await getRandomRoles(config.roleCount);
      console.log(`   ✓ Ruoli: ${roles.map(r => r.name).join(', ')}`);

      // 2. Genera domande con AI (con temperature variabile per diversificare)
      const temperature = 0.5 + (Math.random() * 0.5); // Temperature tra 0.5 e 1.0
      console.log(`   Generazione domande AI (temp: ${temperature.toFixed(2)})...`);
      const aiResponse = await generateQuestionsWithAI(config.type, roles, config.areas, temperature);
      console.log(`   ✓ Generate ${aiResponse.questions?.length || 0} domande`);

      // 3. Crea il template nel database
      console.log(`   Salvataggio nel database...`);
      const result = await createTemplate(config, roles, aiResponse);
      console.log(`   ✅ Template salvato con ID: ${result.data?.id || 'N/A'}`);
      successCount++;

      // Pausa breve tra le richieste per non sovraccaricare l'API
      if (i < templateConfigs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } catch (error) {
      console.error(`   ❌ Errore:`, error.message);
      failCount++;
      continue;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ GENERAZIONE COMPLETATA!');
  console.log(`   Successi: ${successCount}/${templateConfigs.length}`);
  console.log(`   Falliti: ${failCount}/${templateConfigs.length}`);
  console.log('📊 Verifica i template su: http://localhost:5174/engagement');
  console.log('='.repeat(60) + '\n');

  await prisma.$disconnect();
  process.exit(0);
}

// Esegui lo script
main().catch((error) => {
  console.error('Errore fatale:', error);
  prisma.$disconnect();
  process.exit(1);
});