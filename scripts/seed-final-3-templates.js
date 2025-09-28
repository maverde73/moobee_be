/**
 * Script per generare gli ultimi 3 template mancanti per arrivare a 16
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3000/api';
let AUTH_TOKEN = '';

// Ultimi 3 template
const templateConfigs = [
  {
    name: 'Blockchain Development Team Survey',
    description: 'Specialized engagement survey for blockchain and Web3 developers',
    type: 'UWES',
    instructions: 'Valuta il tuo engagement nel mondo blockchain e Web3.',
    suggestedFrequency: 'QUARTERLY',
    roleCount: 2,
    areas: ['GROWTH', 'MOTIVATION', 'COMMUNICATION']
  },
  {
    name: 'Cybersecurity Monthly Pulse Check',
    description: 'Monthly engagement assessment for cybersecurity professionals',
    type: 'CUSTOM',
    instructions: 'Survey mensile per professionisti della cybersecurity.',
    suggestedFrequency: 'MONTHLY',
    roleCount: 3,
    areas: ['LEADERSHIP', 'WORK_LIFE_BALANCE', 'BELONGING']
  },
  {
    name: 'Platform Engineering Annual Review',
    description: 'Annual comprehensive review for platform and infrastructure engineers',
    type: 'GALLUP_Q12',
    instructions: 'Revisione annuale completa per ingegneri di piattaforma.',
    suggestedFrequency: 'ANNUAL',
    roleCount: 2,
    areas: ['GROWTH', 'LEADERSHIP', 'COMMUNICATION', 'MOTIVATION']
  }
];

// Funzioni di supporto (semplificate)
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

async function generateQuestionsWithAI(type, roles, areas) {
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
          temperature: 0.75,
          maxTokens: 2000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minuti timeout
      }
    );

    if (response.data && response.data.data) {
      return response.data.data;
    }
    return response.data;
  } catch (error) {
    console.error('Error generating questions:', error.message);
    return {
      questions: [],
      metadata: { error: 'Failed to generate', provider: 'openai', model: 'gpt-5' }
    };
  }
}

async function createTemplate(config, roles, aiResponse) {
  const suggestedRoles = roles.map(r => `${r.id}:${r.name}`);
  const promptUsed = aiResponse.metadata?.promptUsed || '';
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
      temperature: 0.75,
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
    console.error('Error creating template:', error.message);
    throw error;
  }
}

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
    console.error('❌ Errore nel login:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Generazione ultimi 3 template per raggiungere 16 totali...\n');

  // Ottieni token
  console.log('🔐 Ottenimento token...');
  try {
    AUTH_TOKEN = await getAuthToken();
    console.log('✅ Token ottenuto\n');
  } catch (error) {
    console.error('❌ Errore token');
    process.exit(1);
  }

  let successCount = 0;

  for (let i = 0; i < templateConfigs.length; i++) {
    const config = templateConfigs[i];
    console.log(`📝 Template ${i + 1}/3: ${config.name}`);

    try {
      // 1. Ruoli
      const roles = await getRandomRoles(config.roleCount);
      console.log(`   Ruoli: ${roles.map(r => r.name).join(', ')}`);

      // 2. Domande AI
      console.log(`   Generazione domande...`);
      const aiResponse = await generateQuestionsWithAI(config.type, roles, config.areas);
      console.log(`   Domande generate: ${aiResponse.questions?.length || 0}`);

      // 3. Salva
      console.log(`   Salvataggio...`);
      const result = await createTemplate(config, roles, aiResponse);
      console.log(`   ✅ Salvato con ID: ${result.data?.id || 'N/A'}\n`);
      successCount++;

      // Pausa
      if (i < templateConfigs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`   ❌ Errore:`, error.message, '\n');
      continue;
    }
  }

  console.log('='.repeat(60));
  console.log(`✅ COMPLETATO! Creati ${successCount}/3 template`);
  console.log('📊 Verifica su: http://localhost:5174/engagement');
  console.log('='.repeat(60));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Errore fatale:', error);
  prisma.$disconnect();
  process.exit(1);
});