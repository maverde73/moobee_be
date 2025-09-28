/**
 * Script per creare i rimanenti 10 assessment (21-30)
 * Utilizza i ruoli dal database e genera domande personalizzate
 * Run: node scripts/create-remaining-assessments.js
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

// Inizializza Prisma con il percorso corretto
const path = require('path');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Configurazione
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbGNpemhzMmUwMDAwMGdqdnpyY3F4Z2s4IiwidGVuYW50SWQiOiJjNWRkNmVhZS0xNDE5LTRjZjQtODJmNy0zM2VhMjI1NmE3MWUiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3MjY5MjcxOTcsImV4cCI6MTcyNzUzMTk5N30.RRx2IFy1xEDCRLaKvJOJZkQC10CiJHhfXYeojOXnvg8';

// Ultimi 10 gruppi di ruoli (21-30)
const REMAINING_ROLE_GROUPS = [
  // Emerging Tech
  { name: 'Nanotechnology Team', roleIds: [17, 48, 16], type: 'big_five' },
  { name: 'Photonics Engineering', roleIds: [16, 17, 47], type: 'disc' },
  { name: 'Emerging Tech Research', roleIds: [7, 4, 3], type: 'belbin' },

  // Cybersecurity
  { name: 'Cybersecurity Team', roleIds: [36, 49, 8], type: 'big_five' },
  { name: 'Digital Forensics', roleIds: [49, 8, 46], type: 'disc' },
  { name: 'Security Management', roleIds: [21, 26, 36], type: 'belbin' },

  // Telecom & Networks
  { name: 'Telecommunications', roleIds: [27, 2, 13], type: 'big_five' },
  { name: 'RF Engineering', roleIds: [2, 27, 28], type: 'disc' },
  { name: 'Network Design', roleIds: [13, 1, 24], type: 'belbin' },

  // Extra
  { name: 'Cross-Functional Excellence', roleIds: [22, 44, 36], type: 'big_five' }
];

// Funzione per generare domande con GPT-5
async function generateQuestionsWithGPT5(roleGroup, roleDetails) {
  // Definisci customDescription FUORI dal try per renderla accessibile nel catch
  let customDescription = `Sei un esperto/a di psicometria e assessment del personale.

Genera un questionario breve basato sui ${roleGroup.type === 'big_five' ? 'Big Five' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin'} per contesti di selezione e sviluppo professionale.

CONTESTO LAVORATIVO: ${roleGroup.name}
RUOLI TARGET: ${roleDetails.map(r => r.name).join(', ')}

REQUISITI DEL QUESTIONARIO:
1. Genera 10 domande rilevanti per i ruoli indicati
2. Utilizza il modello teorico ${roleGroup.type === 'big_five' ? 'Big Five (OCEAN)' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin Team Roles'}
3. Le domande devono valutare competenze chiave per i ruoli specifici
4. Mantieni un linguaggio professionale e chiaro
5. Ogni domanda deve avere opzioni di risposta su scala Likert 1-5

SOFT SKILLS SPECIFICHE PER I RUOLI:
${roleDetails.map(r => `- ${r.name}: ${r.soft_skills?.slice(0, 3).join(', ') || 'competenze generali'}`).join('\n')}

Formato risposta richiesto: JSON array con oggetti contenenti:
- text: testo della domanda
- category: categoria (es. per Big Five: Openness, Conscientiousness, etc.)
- type: "likert"
- isRequired: true
- order: numero progressivo
- options: array di opzioni con text e value`;

  try {
    console.log('   📝 Preparando richiesta a GPT-5...');

    const response = await axios.post(
      'http://localhost:8001/api/v1/llm/chat',
      {
        messages: [
          { role: 'user', content: customDescription }
        ],
        temperature: 0.7,
        max_tokens: 16000,
        model: 'gpt-5'
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      console.log('   ✅ Risposta ricevuta da GPT-5');

      try {
        const content = response.data.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]);
          console.log(`   📊 ${questions.length} domande generate con successo`);

          return {
            questions: questions,
            prompt: customDescription
          };
        }
      } catch (parseError) {
        console.error('   ❌ Errore nel parsing JSON:', parseError.message);
      }
    }

    throw new Error('Risposta GPT-5 non valida');

  } catch (error) {
    console.error(`   ❌ Error generating questions: ${error.message}`);
    console.log('   🔄 Uso domande predefinite di fallback...');

    // IMPORTANTE: Restituisci sempre anche il prompt con le domande di fallback
    return {
      questions: getDefaultQuestions(roleGroup.type),
      prompt: customDescription
    };
  }
}

// Domande predefinite di fallback
function getDefaultQuestions(assessmentType) {
  const baseQuestions = {
    big_five: [
      { text: "Mi piace esplorare nuove idee e prospettive", category: "Openness", type: "likert", order: 0 },
      { text: "Completo sempre i compiti assegnati nei tempi previsti", category: "Conscientiousness", type: "likert", order: 1 },
      { text: "Mi sento energico/a quando lavoro in team", category: "Extraversion", type: "likert", order: 2 },
      { text: "Cerco sempre di aiutare i colleghi in difficoltà", category: "Agreeableness", type: "likert", order: 3 },
      { text: "Rimango calmo/a sotto pressione", category: "Neuroticism", type: "likert", order: 4 },
      { text: "Sono aperto/a ai feedback costruttivi", category: "Openness", type: "likert", order: 5 },
      { text: "Pianifico in anticipo le mie attività", category: "Conscientiousness", type: "likert", order: 6 },
      { text: "Mi piace assumere ruoli di leadership", category: "Extraversion", type: "likert", order: 7 },
      { text: "Evito conflitti sul posto di lavoro", category: "Agreeableness", type: "likert", order: 8 },
      { text: "Gestisco bene lo stress lavorativo", category: "Neuroticism", type: "likert", order: 9 }
    ],
    disc: [
      { text: "Preferisco prendere decisioni rapide", category: "Dominance", type: "likert", order: 0 },
      { text: "Mi piace motivare e ispirare gli altri", category: "Influence", type: "likert", order: 1 },
      { text: "Valorizzo la stabilità e la coerenza", category: "Steadiness", type: "likert", order: 2 },
      { text: "Mi concentro sui dettagli e sulla precisione", category: "Conscientiousness", type: "likert", order: 3 },
      { text: "Mi piace affrontare nuove sfide", category: "Dominance", type: "likert", order: 4 },
      { text: "Costruisco facilmente relazioni positive", category: "Influence", type: "likert", order: 5 },
      { text: "Preferisco ambienti di lavoro armoniosi", category: "Steadiness", type: "likert", order: 6 },
      { text: "Seguo procedure e standard stabiliti", category: "Conscientiousness", type: "likert", order: 7 }
    ],
    belbin: [
      { text: "Mi piace coordinare il lavoro del team", category: "Coordinator", type: "likert", order: 0 },
      { text: "Genero spesso nuove idee creative", category: "Plant", type: "likert", order: 1 },
      { text: "Trasformo le idee in azioni pratiche", category: "Implementer", type: "likert", order: 2 },
      { text: "Analizzo criticamente le proposte", category: "Monitor Evaluator", type: "likert", order: 3 },
      { text: "Porto sempre a termine i compiti", category: "Completer Finisher", type: "likert", order: 4 },
      { text: "Costruisco network e relazioni utili", category: "Resource Investigator", type: "likert", order: 5 },
      { text: "Supporto i colleghi per il bene del team", category: "Team Worker", type: "likert", order: 6 },
      { text: "Mi concentro sugli obiettivi principali", category: "Shaper", type: "likert", order: 7 },
      { text: "Fornisco expertise tecnica specializzata", category: "Specialist", type: "likert", order: 8 }
    ]
  };

  const questions = baseQuestions[assessmentType] || baseQuestions.big_five;

  return questions.map(q => ({
    ...q,
    isRequired: true,
    options: [
      { text: "Fortemente in disaccordo", value: 1 },
      { text: "In disaccordo", value: 2 },
      { text: "Neutro", value: 3 },
      { text: "D'accordo", value: 4 },
      { text: "Fortemente d'accordo", value: 5 }
    ]
  }));
}

// Funzione per creare un singolo assessment
async function createAssessment(roleGroup, index, roleDetails) {
  try {
    console.log(`\n📋 [${index}/10] Creando assessment: ${roleGroup.name}`);
    console.log(`   Tipo: ${roleGroup.type}`);
    console.log(`   Ruoli: ${roleGroup.roleIds.join(', ')}`);

    // Genera domande con GPT-5
    console.log('   🤖 Generando domande con GPT-5...');
    const { questions, prompt } = await generateQuestionsWithGPT5(roleGroup, roleDetails);
    console.log(`   ✅ Generate ${questions.length} domande`);

    // Prepara i dati per la creazione
    const assessmentData = {
      name: `${roleGroup.name} Assessment ${index}`,
      type: roleGroup.type,
      description: `Assessment ${roleGroup.type === 'big_five' ? 'Big Five' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin'} per ${roleGroup.name}`,
      instructions: `Questo questionario valuta le competenze e caratteristiche personali rilevanti per i ruoli di ${roleDetails.map(r => r.name).join(', ')}.`,
      suggestedRoles: roleDetails.map(r => `${r.id}:${r.name}`),
      suggestedFrequency: 'quarterly',
      questions: questions,
      aiModel: 'gpt-5',
      aiProvider: 'openai',
      aiTemperature: 0.7,
      aiMaxTokens: 16000,
      aiLanguage: 'it',
      aiPrompt: prompt,  // SEMPRE includi il prompt
      isActive: true
    };

    console.log('   💾 Salvando assessment...');
    console.log(`   📝 Prompt di ${prompt.length} caratteri pronto per il salvataggio`);

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

    console.log(`   ✅ Assessment creato con successo! ID: ${response.data.id}`);
    return response.data;

  } catch (error) {
    console.error(`   ❌ Errore nella creazione:`, error.response?.data || error.message);
    return null;
  }
}

// Funzione principale
async function main() {
  console.log('🚀 Creazione degli ultimi 10 assessment...\n');

  let successCount = 0;
  let failCount = 0;

  try {
    // Recupera i dettagli dei ruoli necessari
    const allRoleIds = [...new Set(REMAINING_ROLE_GROUPS.flatMap(g => g.roleIds))];
    const roles = await prisma.role.findMany({
      where: { id: { in: allRoleIds } },
      select: {
        id: true,
        name: true,
        category: true,
        soft_skills: true
      }
    });

    // Crea gli assessment
    for (let i = 0; i < REMAINING_ROLE_GROUPS.length; i++) {
      const roleGroup = REMAINING_ROLE_GROUPS[i];
      const roleDetails = roleGroup.roleIds.map(id =>
        roles.find(r => r.id === id) || { id, name: `Role ${id}` }
      );

      const result = await createAssessment(roleGroup, i + 21, roleDetails);

      if (result) {
        successCount++;
      } else {
        failCount++;
      }

      // Pausa tra le creazioni per non sovraccaricare
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('❌ Errore generale:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log('📊 RIEPILOGO FINALE:');
  console.log(`   ✅ Assessment creati con successo: ${successCount}`);
  console.log(`   ❌ Assessment falliti: ${failCount}`);
  console.log(`   📋 Totale processati: ${successCount + failCount}`);
  console.log('==================================================');
}

// Esegui lo script
main().catch(console.error);