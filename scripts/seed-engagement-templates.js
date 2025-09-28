/**
 * Script per generare 5 template di engagement completi con domande
 * Usa l'API per generare domande AI e salvare i template
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3000/api';

// Token will be obtained dynamically from login
let AUTH_TOKEN = '';

// Configurazioni template da creare
const templateConfigs = [
  {
    name: 'Engagement Senior Developer Q1 2025',
    description: 'Template di engagement per sviluppatori senior - Primo trimestre 2025',
    type: 'UWES',
    instructions: 'Rispondi sinceramente a tutte le domande basandoti sulla tua esperienza degli ultimi 3 mesi.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 2, // Numero di ruoli da selezionare
    areas: ['MOTIVATION', 'LEADERSHIP', 'GROWTH', 'BELONGING']
  },
  {
    name: 'Weekly Pulse Survey - Tech Team',
    description: 'Survey settimanale rapido per il team tecnico',
    type: 'CUSTOM',
    instructions: 'Questo è un pulse survey veloce. Richiede solo 2-3 minuti del tuo tempo.',
    suggestedFrequency: 'WEEKLY',
    roleCount: 3,
    areas: ['MOTIVATION', 'WORK_LIFE_BALANCE', 'COMMUNICATION']
  },
  {
    name: 'Gallup Q12 - Product Team 2025',
    description: 'Valutazione engagement basata sul modello Gallup Q12 per il team prodotto',
    type: 'GALLUP_Q12',
    instructions: 'Valuta il tuo livello di accordo con ciascuna affermazione pensando al tuo lavoro attuale.',
    suggestedFrequency: 'MONTHLY',
    roleCount: 2,
    areas: ['LEADERSHIP', 'BELONGING', 'GROWTH', 'COMMUNICATION']
  },
  {
    name: 'Annual Engagement Assessment - Full Stack',
    description: 'Valutazione annuale completa per sviluppatori full stack',
    type: 'UWES',
    instructions: 'Questa valutazione annuale ci aiuta a capire il tuo livello di engagement e soddisfazione.',
    suggestedFrequency: 'ANNUAL',
    roleCount: 1,
    areas: ['MOTIVATION', 'LEADERSHIP', 'COMMUNICATION', 'WORK_LIFE_BALANCE', 'BELONGING', 'GROWTH']
  },
  {
    name: 'Mid-Year Check-in - Engineering',
    description: 'Check-in semestrale per il team di ingegneria',
    type: 'CUSTOM',
    instructions: 'Rifletti sulla prima metà dell\'anno e condividi il tuo feedback.',
    suggestedFrequency: 'BIANNUAL',
    roleCount: 4,
    areas: ['GROWTH', 'LEADERSHIP', 'BELONGING', 'MOTIVATION']
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
    // Fallback statico se il DB non funziona
    const fallbackRoles = [
      { id: '44', name: 'Software Developer' },
      { id: '32', name: 'Web Developer' },
      { id: '22', name: 'Product Manager' },
      { id: '36', name: 'DevOps Engineer' },
      { id: '15', name: 'QA Engineer' },
      { id: '28', name: 'Tech Lead' },
      { id: '41', name: 'Frontend Developer' },
      { id: '19', name: 'Backend Developer' }
    ];

    // Ritorna ruoli casuali dal fallback
    const shuffled = fallbackRoles.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

// Funzione per generare domande con AI
async function generateQuestionsWithAI(type, roles, areas) {
  const roleNames = roles.map(r => r.name).join(', ');
  const roleId = parseInt(roles[0].id); // Usa il primo ruolo come principale

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
          temperature: 0.7,
          maxTokens: 2000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // La risposta contiene i dati nel campo data
    if (response.data && response.data.data) {
      return response.data.data;
    }
    return response.data;
  } catch (error) {
    console.error('Error generating questions:', error.response?.data || error.message);
    throw error;
  }
}

// Funzione per creare il template
async function createTemplate(config, roles, aiResponse) {
  const suggestedRoles = roles.map(r => `${r.id}:${r.name}`);

  // Estrai il prompt dalla risposta AI
  const promptUsed = aiResponse.metadata?.promptUsed || aiResponse.metadata?.prompt || aiResponse.prompt || '';
  const aiProvider = aiResponse.metadata?.provider || 'openai';
  const aiModel = aiResponse.metadata?.model || 'gpt-5';

  const templateData = {
    name: config.name,
    type: config.type,
    roleId: null, // Usiamo suggested_roles invece
    description: config.description,
    instructions: config.instructions,
    suggestedFrequency: config.suggestedFrequency,
    questions: aiResponse.questions || [],
    metadata: {
      aiGenerated: true,
      promptUsed: promptUsed, // Salva nel metadata
      aiProvider: aiProvider,
      aiModel: aiModel,
      suggestedRoles: suggestedRoles,
      roleNames: roles.map(r => r.name),
      generatedAt: new Date().toISOString(),
      areas: config.areas,
      language: 'it',
      temperature: 0.7,
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
  console.log('🚀 Inizio generazione template di engagement...\n');

  // Prima ottieni il token
  console.log('🔐 Ottenimento token di autenticazione...');
  try {
    AUTH_TOKEN = await getAuthToken();
    console.log('✅ Token ottenuto con successo\n');
  } catch (error) {
    console.error('❌ Impossibile ottenere il token di autenticazione');
    process.exit(1);
  }

  for (let i = 0; i < templateConfigs.length; i++) {
    const config = templateConfigs[i];
    console.log(`\n📝 Creazione template ${i + 1}/${templateConfigs.length}: ${config.name}`);

    try {
      // 1. Ottieni ruoli casuali
      console.log(`   1. Selezione ${config.roleCount} ruoli casuali...`);
      const roles = await getRandomRoles(config.roleCount);
      console.log(`      Ruoli selezionati: ${roles.map(r => r.name).join(', ')}`);

      // 2. Genera domande con AI
      console.log(`   2. Generazione domande AI (${config.type})...`);
      const aiResponse = await generateQuestionsWithAI(config.type, roles, config.areas);
      console.log(`      ✅ Generate ${aiResponse.questions?.length || 0} domande`);

      // 3. Crea il template nel database
      console.log(`   3. Salvataggio template nel database...`);
      const result = await createTemplate(config, roles, aiResponse);
      console.log(`      ✅ Template salvato con ID: ${result.data?.id || 'N/A'}`);

      // Pausa di 2 secondi tra un template e l'altro per non sovraccaricare l'API
      if (i < templateConfigs.length - 1) {
        console.log('   ⏳ Attesa 2 secondi prima del prossimo template...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`   ❌ Errore nella creazione del template:`, error.message);
      continue; // Continua con il prossimo template
    }
  }

  console.log('\n\n✅ Generazione completata!');
  console.log('📊 Verifica i template su: http://localhost:5174/engagement\n');

  await prisma.$disconnect();
  process.exit(0);
}

// Esegui lo script
main().catch((error) => {
  console.error('Errore fatale:', error);
  prisma.$disconnect();
  process.exit(1);
});