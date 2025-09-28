/**
 * Script per creare gli ultimi 10 assessment per completare il set di 30
 * Run: node scripts/create-final-10-assessments.js
 */

const axios = require('axios');

// Configurazione
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbGNpemhzMmUwMDAwMGdqdnpyY3F4Z2s4IiwidGVuYW50SWQiOiJjNWRkNmVhZS0xNDE5LTRjZjQtODJmNy0zM2VhMjI1NmE3MWUiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3MjY5MjcxOTcsImV4cCI6MTcyNzUzMTk5N30.RRx2IFy1xEDCRLaKvJOJZkQC10CiJHhfXYeojOXnvg8';

// Gruppi di ruoli finali
const FINAL_ROLE_GROUPS = [
  { name: 'Innovation & Research', roleIds: [7, 4, 3], type: 'big_five' },
  { name: 'Cloud Architecture', roleIds: [15, 19, 44], type: 'disc' },
  { name: 'AI & Machine Learning', roleIds: [37, 42, 38], type: 'belbin' },
  { name: 'Mobile Development', roleIds: [32, 40, 43], type: 'big_five' },
  { name: 'DevOps Excellence', roleIds: [1, 15, 44], type: 'disc' },
  { name: 'Product Management', roleIds: [22, 30, 12], type: 'belbin' },
  { name: 'UX Research Team', roleIds: [30, 12, 37], type: 'big_five' },
  { name: 'Platform Engineering', roleIds: [44, 15, 9], type: 'disc' },
  { name: 'Data Governance', roleIds: [10, 35, 42], type: 'belbin' },
  { name: 'Technical Leadership', roleIds: [44, 36, 22], type: 'big_five' }
];

// Domande predefinite di fallback
function getDefaultQuestions(assessmentType) {
  const baseQuestions = {
    big_five: [
      { text: "Mi piace esplorare nuove idee e prospettive innovative", category: "Openness", type: "likert", order: 0 },
      { text: "Completo sempre i compiti assegnati con attenzione ai dettagli", category: "Conscientiousness", type: "likert", order: 1 },
      { text: "Mi sento energico/a quando collaboro con il team", category: "Extraversion", type: "likert", order: 2 },
      { text: "Cerco sempre di supportare i colleghi nel raggiungimento degli obiettivi", category: "Agreeableness", type: "likert", order: 3 },
      { text: "Mantengo la calma anche in situazioni di alta pressione", category: "Neuroticism", type: "likert", order: 4 },
      { text: "Sono aperto/a a sperimentare nuovi approcci", category: "Openness", type: "likert", order: 5 },
      { text: "Organizzo il mio lavoro in modo metodico", category: "Conscientiousness", type: "likert", order: 6 },
      { text: "Mi piace guidare iniziative strategiche", category: "Extraversion", type: "likert", order: 7 },
      { text: "Creo un ambiente di lavoro collaborativo", category: "Agreeableness", type: "likert", order: 8 },
      { text: "Gestisco efficacemente le situazioni di stress", category: "Neuroticism", type: "likert", order: 9 }
    ],
    disc: [
      { text: "Prendo decisioni rapide basate sui dati", category: "Dominance", type: "likert", order: 0 },
      { text: "Comunico efficacemente la vision del progetto", category: "Influence", type: "likert", order: 1 },
      { text: "Mantengo standard di qualità consistenti", category: "Steadiness", type: "likert", order: 2 },
      { text: "Analizzo meticolosamente i requisiti", category: "Conscientiousness", type: "likert", order: 3 },
      { text: "Affronto le sfide con determinazione", category: "Dominance", type: "likert", order: 4 },
      { text: "Costruisco relazioni professionali positive", category: "Influence", type: "likert", order: 5 },
      { text: "Supporto la continuità operativa", category: "Steadiness", type: "likert", order: 6 },
      { text: "Verifico l'accuratezza dei deliverable", category: "Conscientiousness", type: "likert", order: 7 }
    ],
    belbin: [
      { text: "Coordino efficacemente le attività del team", category: "Coordinator", type: "likert", order: 0 },
      { text: "Propongo soluzioni innovative ai problemi", category: "Plant", type: "likert", order: 1 },
      { text: "Trasformo le strategie in piani operativi", category: "Implementer", type: "likert", order: 2 },
      { text: "Valuto oggettivamente le proposte", category: "Monitor Evaluator", type: "likert", order: 3 },
      { text: "Garantisco il completamento dei progetti", category: "Completer Finisher", type: "likert", order: 4 },
      { text: "Identifico opportunità di miglioramento", category: "Resource Investigator", type: "likert", order: 5 },
      { text: "Facilito la collaborazione nel team", category: "Team Worker", type: "likert", order: 6 },
      { text: "Spingo il team verso l'eccellenza", category: "Shaper", type: "likert", order: 7 },
      { text: "Fornisco competenze tecniche specializzate", category: "Specialist", type: "likert", order: 8 }
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

// Funzione per generare il prompt
function generatePrompt(roleGroup) {
  return `Sei un esperto/a di psicometria e assessment del personale.

Genera un questionario breve basato sui ${roleGroup.type === 'big_five' ? 'Big Five' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin'} per contesti di selezione e sviluppo professionale.

CONTESTO LAVORATIVO: ${roleGroup.name}
RUOLI TARGET: Ruoli professionali con ID ${roleGroup.roleIds.join(', ')}

REQUISITI DEL QUESTIONARIO:
1. Genera domande rilevanti per valutare le competenze
2. Utilizza il modello teorico ${roleGroup.type === 'big_five' ? 'Big Five (OCEAN)' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin Team Roles'}
3. Le domande devono essere professionali e chiare
4. Ogni domanda deve avere opzioni di risposta su scala Likert 1-5
5. Focus su competenze trasversali e soft skills

Il questionario deve essere adatto per la selezione e lo sviluppo del personale nel contesto ${roleGroup.name}.`;
}

// Funzione per creare un singolo assessment
async function createAssessment(roleGroup, index) {
  try {
    console.log(`\n📋 [${index + 21}/30] Creando assessment: ${roleGroup.name}`);
    console.log(`   Tipo: ${roleGroup.type}`);
    console.log(`   Ruoli: ${roleGroup.roleIds.join(', ')}`);

    // Usa sempre domande predefinite per velocità
    const questions = getDefaultQuestions(roleGroup.type);
    const prompt = generatePrompt(roleGroup);

    console.log(`   ✅ ${questions.length} domande pronte`);
    console.log(`   📝 Prompt di ${prompt.length} caratteri generato`);

    // Prepara i dati per la creazione
    const assessmentData = {
      name: `${roleGroup.name} Assessment`,
      type: roleGroup.type,
      description: `Assessment ${roleGroup.type === 'big_five' ? 'Big Five' : roleGroup.type === 'disc' ? 'DISC' : 'Belbin'} per ${roleGroup.name}`,
      instructions: `Questo questionario valuta le competenze e caratteristiche personali rilevanti per il team ${roleGroup.name}.`,
      suggestedRoles: roleGroup.roleIds.map(id => `${id}:Role ${id}`),
      suggestedFrequency: 'quarterly',
      questions: questions,
      aiModel: 'gpt-5',
      aiProvider: 'openai',
      aiTemperature: 0.7,
      aiMaxTokens: 16000,
      aiLanguage: 'it',
      aiPrompt: prompt,
      isActive: true
    };

    console.log('   💾 Salvando assessment...');

    const response = await axios.post(
      `${API_BASE}/assessments/templates`,
      assessmentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        timeout: 10000
      }
    );

    console.log(`   ✅ Assessment creato con successo! ID: ${response.data.id}`);
    return response.data;

  } catch (error) {
    console.error(`   ❌ Errore:`, error.response?.data?.message || error.message);
    return null;
  }
}

// Funzione principale
async function main() {
  console.log('🚀 Creazione degli ultimi 10 assessment per completare il set di 30...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < FINAL_ROLE_GROUPS.length; i++) {
    const result = await createAssessment(FINAL_ROLE_GROUPS[i], i);

    if (result) {
      successCount++;
    } else {
      failCount++;
    }

    // Pausa tra le creazioni
    await new Promise(resolve => setTimeout(resolve, 500));
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