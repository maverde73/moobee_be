/**
 * Script per creare 30 assessment utilizzando GPT-5
 * Utilizza i ruoli dal database e genera domande personalizzate
 * Run: node scripts/create-30-assessments.js
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

// Configurazione
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbGNpemhzMmUwMDAwMGdqdnpyY3F4Z2s4IiwidGVuYW50SWQiOiJjNWRkNmVhZS0xNDE5LTRjZjQtODJmNy0zM2VhMjI1NmE3MWUiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3MjY5MjcxOTcsImV4cCI6MTcyNzUzMTk5N30.RRx2IFy1xEDCRLaKvJOJZkQC10CiJHhfXYeojOXnvg8';

// Gruppi di ruoli affini per categoria (basati su ID esistenti da 1 a 51)
const ROLE_GROUPS = [
  // Software Development
  { name: 'Software Development Team', roleIds: [44, 32, 39], type: 'big_five' },
  { name: 'Full Stack Engineering', roleIds: [32, 44, 40], type: 'big_five' },
  { name: 'Web Development Squad', roleIds: [32, 40, 43], type: 'disc' },

  // Data Science & Analytics
  { name: 'Data Science Team', roleIds: [42, 37, 38], type: 'big_five' },
  { name: 'Analytics Excellence', roleIds: [22, 12, 30], type: 'disc' },
  { name: 'Research & Analytics', roleIds: [12, 37, 30], type: 'belbin' },

  // Infrastructure & Security
  { name: 'Network Infrastructure', roleIds: [1, 13, 24], type: 'big_five' },
  { name: 'Security Operations', roleIds: [36, 46, 49], type: 'disc' },
  { name: 'System Architecture', roleIds: [15, 19, 9], type: 'belbin' },

  // Database & Data Management
  { name: 'Database Management', roleIds: [10, 34, 35], type: 'big_five' },
  { name: 'Data Warehousing Team', roleIds: [35, 10, 42], type: 'disc' },
  { name: 'Information Systems', roleIds: [9, 19, 15], type: 'belbin' },

  // Quality & Testing
  { name: 'Quality Assurance', roleIds: [31, 33, 41], type: 'big_five' },
  { name: 'Testing Excellence', roleIds: [31, 41, 20], type: 'disc' },
  { name: 'Validation Engineering', roleIds: [41, 33, 20], type: 'belbin' },

  // Specialized Engineering
  { name: 'Robotics Engineering', roleIds: [5, 45, 6], type: 'big_five' },
  { name: 'Mechatronics Team', roleIds: [25, 5, 45], type: 'disc' },
  { name: 'Hardware Engineering', roleIds: [28, 48, 47], type: 'belbin' },

  // Bio & Health Tech
  { name: 'Bioinformatics Team', roleIds: [37, 11, 38], type: 'big_five' },
  { name: 'Health Informatics', roleIds: [18, 37, 38], type: 'disc' },
  { name: 'Life Sciences Tech', roleIds: [11, 18, 37], type: 'belbin' },

  // Advanced Technology
  { name: 'Nanotechnology Team', roleIds: [17, 48, 16], type: 'big_five' },
  { name: 'Photonics Engineering', roleIds: [16, 17, 47], type: 'disc' },
  { name: 'Emerging Tech Research', roleIds: [7, 4, 3], type: 'belbin' },

  // Security & Forensics
  { name: 'Cybersecurity Team', roleIds: [36, 49, 8], type: 'big_five' },
  { name: 'Digital Forensics', roleIds: [49, 8, 46], type: 'disc' },
  { name: 'Security Management', roleIds: [21, 26, 36], type: 'belbin' },

  // Telecom & RF
  { name: 'Telecommunications', roleIds: [27, 2, 13], type: 'big_five' },
  { name: 'RF Engineering', roleIds: [2, 27, 28], type: 'disc' },
  { name: 'Network Design', roleIds: [13, 1, 24], type: 'belbin' }
];

/**
 * Recupera i dettagli dei ruoli con i loro soft skills
 */
async function getRoleDetailsWithSoftSkills(roleIds) {
  try {
    const roles = await prisma.$queryRaw`
      SELECT
        r.id,
        r."Role" as name,
        ARRAY_AGG(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'nameEn', s."nameEn",
            'priority', rs.priority,
            'minScore', rs."minScore"
          ) ORDER BY rs.priority
        ) FILTER (WHERE s.id IS NOT NULL) as soft_skills
      FROM roles r
      LEFT JOIN role_soft_skills rs ON rs."roleId" = r.id
      LEFT JOIN soft_skills s ON s.id = rs."softSkillId"
      WHERE r.id = ANY(${roleIds})
      GROUP BY r.id, r."Role"
    `;

    return roles;
  } catch (error) {
    console.error('Error fetching role details:', error);
    return [];
  }
}

// Funzione per ottenere domande predefinite in caso di errore
function getDefaultQuestions(type) {
  const baseQuestions = {
    big_five: [
      { text: "Mi piace lavorare in team e collaborare con i colleghi", category: "Extraversion", type: "likert" },
      { text: "Sono attento ai dettagli e mi assicuro che il mio lavoro sia preciso", category: "Conscientiousness", type: "likert" },
      { text: "Mi adatto facilmente ai cambiamenti nel mio ambiente di lavoro", category: "Openness", type: "likert" },
      { text: "Cerco sempre di aiutare i miei colleghi quando hanno bisogno", category: "Agreeableness", type: "likert" },
      { text: "Rimango calmo anche nelle situazioni di stress", category: "Neuroticism", type: "likert" },
      { text: "Preferisco lavorare su progetti innovativi e sperimentali", category: "Openness", type: "likert" },
      { text: "Sono organizzato e pianifico il mio lavoro in anticipo", category: "Conscientiousness", type: "likert" },
      { text: "Mi sento a mio agio nel presentare idee a un gruppo", category: "Extraversion", type: "likert" },
      { text: "Riesco a gestire bene le critiche costruttive", category: "Neuroticism", type: "likert" },
      { text: "Mi piace aiutare i nuovi colleghi ad ambientarsi", category: "Agreeableness", type: "likert" }
    ],
    disc: [
      { text: "Preferisco prendere decisioni rapide piuttosto che analizzare ogni dettaglio", category: "Dominance", type: "likert" },
      { text: "Mi piace incontrare nuove persone e fare networking", category: "Influence", type: "likert" },
      { text: "Valorizzo la stabilità e la routine nel mio lavoro", category: "Steadiness", type: "likert" },
      { text: "Seguo sempre le procedure e i protocolli stabiliti", category: "Compliance", type: "likert" },
      { text: "Mi piace guidare il team verso gli obiettivi", category: "Dominance", type: "likert" },
      { text: "Sono bravo a motivare e ispirare gli altri", category: "Influence", type: "likert" },
      { text: "Preferisco un ambiente di lavoro prevedibile", category: "Steadiness", type: "likert" },
      { text: "Controllo sempre l'accuratezza del mio lavoro", category: "Compliance", type: "likert" }
    ],
    belbin: [
      { text: "Mi piace coordinare il lavoro del team e assicurarmi che tutti siano allineati", category: "Coordinator", type: "likert" },
      { text: "Sono bravo a trovare soluzioni creative ai problemi", category: "Plant", type: "likert" },
      { text: "Mi concentro sul completare i compiti nei tempi previsti", category: "Completer Finisher", type: "likert" },
      { text: "Analizzo sempre i pro e i contro prima di prendere decisioni", category: "Monitor Evaluator", type: "likert" },
      { text: "Sono bravo a identificare le risorse necessarie per un progetto", category: "Resource Investigator", type: "likert" },
      { text: "Mi assicuro che il team mantenga lo slancio", category: "Shaper", type: "likert" },
      { text: "Supporto i colleghi quando hanno bisogno", category: "Teamworker", type: "likert" },
      { text: "Porto competenze tecniche specializzate al team", category: "Specialist", type: "likert" },
      { text: "Trasformo le idee in azioni pratiche", category: "Implementer", type: "likert" }
    ]
  };

  // Aggiungi le opzioni standard per ogni domanda
  const questions = baseQuestions[type] || baseQuestions.big_five;
  return questions.map((q, index) => ({
    ...q,
    order: index,
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

/**
 * Genera domande utilizzando GPT-5 attraverso l'API del backend
 */
async function generateQuestionsWithGPT5(roleGroup, roleDetails) {
  // Definisci customDescription FUORI dal try per renderla accessibile nel catch
  let customDescription = `Sei un esperto/a di psicometria e assessment del personale. Genera un questionario breve basato sui ${roleGroup.type.toUpperCase().replace('_', ' ')} per contesti di selezione e sviluppo professionale.

CONTESTO LAVORATIVO: ${roleGroup.name}
RUOLI TARGET: ${roleDetails.map(r => r.name).join(', ')}

`;

    // Aggiungi soft skills per ruolo
    roleDetails.forEach(role => {
      if (role.soft_skills && role.soft_skills.length > 0) {
        customDescription += `\n${role.name.toUpperCase()}:\n`;

        const criticalSkills = role.soft_skills.slice(0, 3);
        const importantSkills = role.soft_skills.slice(3, 6);

        customDescription += `Competenze critiche da valutare:\n`;
        criticalSkills.forEach(skill => {
          if (skill && skill.name) {
            customDescription += `- ${skill.name}${skill.nameEn ? ` (${skill.nameEn})` : ''}\n`;
          }
        });

        if (importantSkills.length > 0) {
          customDescription += `Competenze complementari:\n`;
          importantSkills.forEach(skill => {
            if (skill && skill.name) {
              customDescription += `- ${skill.name}\n`;
            }
          });
        }
      }
    });

    customDescription += `
REQUISITI DEL QUESTIONARIO:
1. Genera 10 domande specifiche per valutare le competenze indicate
2. Utilizza il modello teorico ${roleGroup.type === 'big_five' ? 'Big Five (OCEAN)' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin Team Roles'}
3. Le domande devono essere contestualizzate per l'ambiente lavorativo IT/Tech
4. Usa un linguaggio professionale ma comprensibile
5. Ogni domanda deve mappare chiaramente su una dimensione del modello scelto
6. Includi scenari lavorativi realistici quando possibile

FORMATO OUTPUT:
Per ogni domanda specifica:
- Il testo della domanda
- La categoria/dimensione valutata
- Il tipo di risposta (Likert scale 1-5)
- Le opzioni di risposta in italiano`;

  try {
    console.log('   📝 Preparando richiesta a GPT-5...');

    // Chiama l'endpoint AI per generare le domande con timeout
    const response = await axios.post(
      `${API_BASE}/assessments/ai/generate-questions`,
      {
        type: roleGroup.type,
        count: 10,
        language: 'it',
        context: customDescription,
        suggestedRoles: roleDetails.map(r => `${r.id}:${r.name}`),
        model: 'gpt-5',
        temperature: 0.7,
        maxTokens: 16000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        timeout: 30000 // 30 secondi timeout (ridotto per evitare blocchi)
      }
    );

    console.log('   ✅ Risposta ricevuta da GPT-5');

    // Estrai le domande dalla struttura di risposta (data.data.questions)
    const questions = response.data?.data?.questions ||
                     response.data?.questions ||
                     response.data?.result?.questions;

    if (questions && questions.length > 0) {
      console.log(`   📊 ${questions.length} domande generate con successo`);
      return { questions: questions, prompt: customDescription };
    } else {
      console.log('   ⚠️ Risposta vuota da GPT-5, uso domande predefinite');
      return { questions: getDefaultQuestions(roleGroup.type), prompt: customDescription };
    }
  } catch (error) {
    console.error('   ❌ Error generating questions:', error.response?.data || error.message);
    console.log('   🔄 Uso domande predefinite di fallback...');
    // IMPORTANTE: Salva sempre il prompt anche quando usa domande di fallback
    return { questions: getDefaultQuestions(roleGroup.type), prompt: customDescription };
  }
}

/**
 * Crea un assessment completo
 */
async function createAssessment(roleGroup, roleDetails, questions, prompt, index) {
  try {
    const assessmentName = `${roleGroup.name} Assessment ${index + 1}`;

    // Verifica che il prompt sia presente
    if (!prompt || prompt.length < 10) {
      console.log('   ⚠️ ATTENZIONE: Prompt mancante o troppo corto!');
    } else {
      console.log(`   📝 Prompt di ${prompt.length} caratteri pronto per il salvataggio`);
    }

    const assessmentData = {
      name: assessmentName,
      type: roleGroup.type,
      description: `Assessment ${roleGroup.type.toUpperCase()} per valutare le competenze del team ${roleGroup.name}. Questo assessment è progettato per valutare i candidati per i ruoli di ${roleDetails.map(r => r.name).join(', ')}.`,
      instructions: `Completa tutte le domande con sincerità. Non ci sono risposte giuste o sbagliate. Il questionario richiede circa ${roleGroup.type === 'big_five' ? '30' : roleGroup.type === 'disc' ? '25' : '20'} minuti.`,
      suggestedRoles: roleDetails.map(r => `${r.id}:${r.name}`),
      suggestedFrequency: 'quarterly',
      questions: questions,
      aiModel: 'gpt-5',
      aiProvider: 'openai',
      aiTemperature: 0.7,
      aiMaxTokens: 16000,
      aiLanguage: 'it',
      aiPrompt: prompt || 'Prompt non disponibile',
      isActive: true
    };

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

    return response.data;
  } catch (error) {
    console.error('Error creating assessment:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Funzione principale
 */
async function main() {
  console.log('🚀 Avvio creazione di 30 assessment con GPT-5...\n');

  let successCount = 0;
  let failCount = 0;

  // Ricrea tutti i 30 assessment dall'inizio
  const START_FROM = 0; // Parti dall'inizio

  for (let i = START_FROM; i < ROLE_GROUPS.length && i < 30; i++) {
    const roleGroup = ROLE_GROUPS[i];
    console.log(`\n📋 [${i + 1}/30] Creando assessment: ${roleGroup.name}`);
    console.log(`   Tipo: ${roleGroup.type}`);
    console.log(`   Ruoli: ${roleGroup.roleIds.join(', ')}`);

    try {
      // 1. Recupera dettagli dei ruoli
      console.log('   📊 Recuperando dettagli dei ruoli...');
      const roleDetails = await getRoleDetailsWithSoftSkills(roleGroup.roleIds);

      if (roleDetails.length === 0) {
        console.log('   ⚠️  Nessun ruolo trovato, skip...');
        failCount++;
        continue;
      }

      // 2. Genera domande con GPT-5
      console.log('   🤖 Generando domande con GPT-5...');
      const generationResult = await generateQuestionsWithGPT5(roleGroup, roleDetails);

      if (!generationResult.questions || generationResult.questions.length === 0) {
        console.log('   ⚠️  Nessuna domanda generata, skip...');
        failCount++;
        continue;
      }

      console.log(`   ✅ Generate ${generationResult.questions.length} domande`);

      // 3. Crea l'assessment
      console.log('   💾 Salvando assessment...');
      const result = await createAssessment(roleGroup, roleDetails, generationResult.questions, generationResult.prompt, i);

      if (result && result.success) {
        console.log(`   ✅ Assessment creato con successo! ID: ${result.data.id}`);
        successCount++;
      } else {
        console.log('   ❌ Errore nella creazione dell\'assessment');
        failCount++;
      }

      // Pausa tra le richieste per non sovraccaricare l'API
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`   ❌ Errore: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RIEPILOGO FINALE:');
  console.log(`   ✅ Assessment creati con successo: ${successCount}`);
  console.log(`   ❌ Assessment falliti: ${failCount}`);
  console.log(`   📋 Totale processati: ${successCount + failCount}`);
  console.log('='.repeat(50));

  await prisma.$disconnect();
  process.exit(0);
}

// Esegui lo script
main().catch(error => {
  console.error('Errore fatale:', error);
  prisma.$disconnect();
  process.exit(1);
});