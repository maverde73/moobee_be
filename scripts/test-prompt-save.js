/**
 * Script di test per verificare il salvataggio del prompt
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurazione
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbGNpemhzMmUwMDAwMGdqdnpyY3F4Z2s4IiwidGVuYW50SWQiOiJjNWRkNmVhZS0xNDE5LTRjZjQtODJmNy0zM2VhMjI1NmE3MWUiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3MjY5MjcxOTcsImV4cCI6MTcyNzUzMTk5N30.RRx2IFy1xEDCRLaKvJOJZkQC10CiJHhfXYeojOXnvg8';

async function testPromptSave() {
  try {
    console.log('🧪 TEST SALVATAGGIO PROMPT\n');

    const testPrompt = `Sei un esperto/a di psicometria e assessment del personale.

QUESTO È UN PROMPT DI TEST PER VERIFICARE IL SALVATAGGIO.

Genera un questionario breve basato sui Big Five per contesti di selezione e sviluppo professionale.

CONTESTO LAVORATIVO: Test Team
RUOLI TARGET: Test Role 1, Test Role 2

REQUISITI DEL QUESTIONARIO:
1. Genera 5 domande di test
2. Utilizza il modello teorico Big Five (OCEAN)
3. Test del salvataggio prompt nel database

Lunghezza prompt: ${new Date().toISOString()}`;

    console.log('📝 Prompt di test generato:');
    console.log(`   Lunghezza: ${testPrompt.length} caratteri`);
    console.log(`   Prime 100 caratteri: ${testPrompt.substring(0, 100)}...`);

    // Domande di test semplici
    const testQuestions = [
      {
        text: "Domanda di test 1",
        category: "Openness",
        type: "likert",
        order: 0,
        isRequired: true,
        options: [
          { text: "Fortemente in disaccordo", value: 1 },
          { text: "In disaccordo", value: 2 },
          { text: "Neutro", value: 3 },
          { text: "D'accordo", value: 4 },
          { text: "Fortemente d'accordo", value: 5 }
        ]
      },
      {
        text: "Domanda di test 2",
        category: "Conscientiousness",
        type: "likert",
        order: 1,
        isRequired: true,
        options: [
          { text: "Fortemente in disaccordo", value: 1 },
          { text: "In disaccordo", value: 2 },
          { text: "Neutro", value: 3 },
          { text: "D'accordo", value: 4 },
          { text: "Fortemente d'accordo", value: 5 }
        ]
      }
    ];

    console.log('\n📤 Invio richiesta di creazione assessment...');

    const assessmentData = {
      name: `Test Prompt Save - ${new Date().toLocaleTimeString()}`,
      type: 'big_five',
      description: 'Test per verificare il salvataggio del prompt',
      instructions: 'Istruzioni di test',
      suggestedRoles: ['1:Test Role'],
      suggestedFrequency: 'quarterly',
      questions: testQuestions,
      aiModel: 'gpt-5',
      aiProvider: 'openai',
      aiTemperature: 0.7,
      aiMaxTokens: 16000,
      aiLanguage: 'it',
      aiPrompt: testPrompt,  // IMPORTANTE: Questo è il prompt da salvare
      isActive: true
    };

    console.log('\n📦 Dati inviati:');
    console.log(`   Campo aiPrompt presente: ${!!assessmentData.aiPrompt}`);
    console.log(`   Lunghezza aiPrompt: ${assessmentData.aiPrompt?.length || 0}`);

    const response = await axios.post(
      `${API_BASE}/assessments/templates`,
      assessmentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );

    console.log('\n✅ Assessment creato con successo!');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Nome: ${response.data.name}`);

    // Verifica nel database
    if (response.data.id) {
      console.log('\n🔍 Verifica nel database...');

      const dbCheck = await prisma.$queryRaw`
        SELECT
          id,
          name,
          "aiPrompt",
          LENGTH("aiPrompt") as prompt_length
        FROM assessment_templates
        WHERE id = ${response.data.id}
      `;

      if (dbCheck && dbCheck.length > 0) {
        const assessment = dbCheck[0];
        console.log('\n📊 RISULTATO VERIFICA:');
        console.log(`   ID: ${assessment.id}`);
        console.log(`   Nome: ${assessment.name}`);
        console.log(`   Prompt salvato: ${assessment.aiPrompt ? 'SÌ' : 'NO'}`);
        console.log(`   Lunghezza prompt: ${assessment.prompt_length || 0} caratteri`);

        if (assessment.aiPrompt) {
          console.log(`   Prime 100 caratteri del prompt salvato:`);
          console.log(`   ${assessment.aiPrompt.substring(0, 100)}...`);
          console.log('\n✅ TEST SUPERATO: Il prompt è stato salvato correttamente!');
        } else {
          console.log('\n❌ TEST FALLITO: Il prompt NON è stato salvato!');
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Errore:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui il test
testPromptSave();