/**
 * Script per generare nuovi template di engagement con prompt salvato
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3000/api';

// Token will be obtained dynamically from login
let AUTH_TOKEN = '';

// Nuovi template da creare
const templateConfigs = [
  {
    name: 'Developer Engagement Survey Q2 2025',
    description: 'Quarterly engagement survey for development team - Q2 2025',
    type: 'UWES',
    instructions: 'Rispondi sinceramente basandoti sulla tua esperienza recente.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 2,
    areas: ['MOTIVATION', 'GROWTH', 'COMMUNICATION']
  },
  {
    name: 'Tech Team Weekly Pulse Check',
    description: 'Quick weekly pulse check for tech team',
    type: 'CUSTOM',
    instructions: 'Survey rapido settimanale - max 3 minuti.',
    suggestedFrequency: 'WEEKLY',
    roleCount: 3,
    areas: ['WORK_LIFE_BALANCE', 'MOTIVATION']
  },
  {
    name: 'Engineering Gallup Assessment 2025',
    description: 'Annual Gallup Q12 assessment for engineering teams',
    type: 'GALLUP_Q12',
    instructions: 'Valutazione annuale basata sul modello Gallup Q12.',
    suggestedFrequency: 'ANNUAL',
    roleCount: 2,
    areas: ['LEADERSHIP', 'BELONGING', 'GROWTH', 'COMMUNICATION']
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
async function generateQuestionsWithAI(type, roles, areas) {
  const roleNames = roles.map(r => r.name).join(', ');
  const roleId = parseInt(roles[0].id);

  try {
    console.log('   Chiamata API per generare domande AI...');
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
          temperature: 0.8,
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

    // Debug: mostra cosa restituisce l'API
    console.log('   Risposta AI ricevuta. Struttura dati:');
    console.log('   - response.data.data presente?', !!response.data?.data);
    console.log('   - metadata presente?', !!response.data?.data?.metadata);
    console.log('   - promptUsed presente?', !!response.data?.data?.metadata?.promptUsed);

    if (response.data?.data?.metadata?.promptUsed) {
      console.log('   - Lunghezza prompt:', response.data.data.metadata.promptUsed.length, 'caratteri');
    }

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

  // Debug: mostra cosa stiamo per salvare
  console.log('   Preparazione dati template:');
  console.log('   - promptUsed nel metadata?', !!aiResponse.metadata?.promptUsed);
  console.log('   - Lunghezza prompt da salvare:', aiResponse.metadata?.promptUsed?.length || 0);

  // Estrai il prompt dalla risposta AI
  const promptUsed = aiResponse.metadata?.promptUsed || aiResponse.metadata?.prompt || aiResponse.prompt || '';
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
      promptUsed: promptUsed, // Questo sarà salvato in ai_prompt dal backend
      aiProvider: aiProvider,
      aiModel: aiModel,
      suggestedRoles: suggestedRoles,
      roleNames: roles.map(r => r.name),
      generatedAt: new Date().toISOString(),
      areas: config.areas,
      language: 'it',
      temperature: 0.8,
      maxTokens: 2000,
      numberOfQuestions: aiResponse.questions?.length || 0
    }
  };

  try {
    console.log('   Invio template al backend...');
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
  console.log('🚀 Inizio generazione template di engagement V2...\n');

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
      console.log(`      ✅ Prompt salvato: ${aiResponse.metadata?.promptUsed ? 'SI' : 'NO'}`);

      // 3. Crea il template nel database
      console.log(`   3. Salvataggio template nel database...`);
      const result = await createTemplate(config, roles, aiResponse);
      console.log(`      ✅ Template salvato con ID: ${result.data?.id || 'N/A'}`);

      // Verifica se il prompt è stato salvato
      if (result.data?.id) {
        const saved = await prisma.engagement_templates.findUnique({
          where: { id: result.data.id },
          select: {
            id: true,
            title: true,
            ai_prompt: true,
            ai_model: true,
            ai_provider: true,
            suggested_roles: true
          }
        });

        console.log(`      📋 Verifica salvataggio:`);
        console.log(`         - AI Prompt salvato: ${saved.ai_prompt ? 'SI (' + saved.ai_prompt.length + ' caratteri)' : 'NO'}`);
        console.log(`         - AI Model: ${saved.ai_model || 'N/A'}`);
        console.log(`         - AI Provider: ${saved.ai_provider || 'N/A'}`);
      }

      // Pausa di 2 secondi tra un template e l'altro
      if (i < templateConfigs.length - 1) {
        console.log('   ⏳ Attesa 2 secondi prima del prossimo template...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`   ❌ Errore nella creazione del template:`, error.message);
      continue;
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