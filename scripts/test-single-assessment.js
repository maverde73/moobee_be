/**
 * Script di test per creare un singolo assessment con GPT-5
 * Test con prompt psicometrico professionale
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurazione
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbGNpemhzMmUwMDAwMGdqdnpyY3F4Z2s4IiwidGVuYW50SWQiOiJjNWRkNmVhZS0xNDE5LTRjZjQtODJmNy0zM2VhMjI1NmE3MWUiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3MjY5MjcxOTcsImV4cCI6MTcyNzUzMTk5N30.RRx2IFy1xEDCRLaKvJOJZkQC10CiJHhfXYeojOXnvg8';

// Test con Software Development Team
const TEST_GROUP = {
  name: 'Software Development Team',
  roleIds: [44, 32, 39],
  type: 'big_five'
};

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

/**
 * Genera domande utilizzando GPT-5 con prompt professionale
 */
async function generateQuestionsWithGPT5(roleGroup, roleDetails) {
  try {
    // Costruisci il prompt professionale per la psicometria
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

    console.log('\n📝 PROMPT GENERATO:');
    console.log('='.repeat(50));
    console.log(customDescription);
    console.log('='.repeat(50));

    console.log('\n🤖 Invio richiesta a GPT-5...');

    // Chiama l'endpoint AI per generare le domande
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
        timeout: 90000 // 90 secondi timeout
      }
    );

    console.log('✅ Risposta ricevuta da GPT-5');

    // Log della risposta completa per debug
    console.log('\n📦 Risposta completa:');
    console.log(JSON.stringify(response.data, null, 2));

    // Estrai le domande dalla struttura di risposta
    const questions = response.data?.data?.questions ||
                     response.data?.questions ||
                     response.data?.result?.questions ||
                     response.data;

    if (questions && Array.isArray(questions) && questions.length > 0) {
      console.log(`\n📊 Domande generate: ${questions.length}`);
      console.log('\nPRIME 3 DOMANDE:');
      questions.slice(0, 3).forEach((q, i) => {
        console.log(`\n${i + 1}. ${q.text || q.questionText || q.question}`);
        console.log(`   Categoria: ${q.category || q.dimension || 'N/A'}`);
        console.log(`   Tipo: ${q.type || q.questionType || 'likert'}`);
      });
      return { questions: questions, prompt: customDescription };
    } else {
      console.log('⚠️ Nessuna domanda nella risposta');
      console.log('Struttura response.data:', Object.keys(response.data || {}));
      return null;
    }
  } catch (error) {
    console.error('\n❌ Errore nella generazione:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log('\n💡 Suggerimento: Verifica che l\'endpoint /api/assessments/ai/generate-questions sia attivo');
    }
    return null;
  }
}

/**
 * Crea un assessment completo
 */
async function createAssessment(roleGroup, roleDetails, questions, prompt) {
  try {
    const assessmentName = `Test Assessment - ${roleGroup.name}`;

    console.log(`\n💾 Creazione assessment: ${assessmentName}`);

    const response = await axios.post(
      `${API_BASE}/assessments/templates`,
      {
        name: assessmentName,
        type: roleGroup.type,
        description: `Assessment ${roleGroup.type.toUpperCase()} per valutare le competenze del team ${roleGroup.name}. Questo assessment è progettato per valutare i candidati per i ruoli di ${roleDetails.map(r => r.name).join(', ')}.`,
        instructions: `Completa tutte le domande con sincerità. Non ci sono risposte giuste o sbagliate. Il questionario richiede circa 20-30 minuti.`,
        suggestedRoles: roleDetails.map(r => `${r.id}:${r.name}`),
        suggestedFrequency: 'quarterly',
        questions: questions,
        aiModel: 'gpt-5',
        aiProvider: 'openai',
        aiTemperature: 0.7,
        aiMaxTokens: 16000,
        aiLanguage: 'it',
        aiPrompt: prompt,
        isActive: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );

    console.log('✅ Assessment creato con successo!');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Nome: ${response.data.name}`);

    return response.data;
  } catch (error) {
    console.error('❌ Errore nella creazione:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Funzione principale
 */
async function main() {
  console.log('🚀 TEST CREAZIONE SINGOLO ASSESSMENT CON GPT-5');
  console.log('='.repeat(50));

  try {
    // 1. Recupera dettagli dei ruoli
    console.log('\n📊 Recupero dettagli dei ruoli...');
    console.log(`   Ruoli: ${TEST_GROUP.roleIds.join(', ')}`);

    const roleDetails = await getRoleDetailsWithSoftSkills(TEST_GROUP.roleIds);

    if (roleDetails.length === 0) {
      console.log('❌ Nessun ruolo trovato nel database');
      process.exit(1);
    }

    console.log(`✅ Trovati ${roleDetails.length} ruoli:`);
    roleDetails.forEach(role => {
      console.log(`   - ${role.name} (${role.soft_skills?.length || 0} soft skills)`);
    });

    // 2. Genera domande con GPT-5
    const result = await generateQuestionsWithGPT5(TEST_GROUP, roleDetails);

    if (!result || !result.questions) {
      console.log('\n❌ Impossibile generare le domande');
      process.exit(1);
    }

    // 3. Crea l'assessment
    const assessment = await createAssessment(TEST_GROUP, roleDetails, result.questions, result.prompt);

    if (assessment) {
      console.log('\n' + '='.repeat(50));
      console.log('🎉 TEST COMPLETATO CON SUCCESSO!');
      console.log('='.repeat(50));
      console.log('\nProssimi passi:');
      console.log('1. Verifica l\'assessment nel database o nell\'interfaccia');
      console.log('2. Se il risultato è soddisfacente, esegui lo script completo');
      console.log('   node scripts/create-30-assessments.js');
    } else {
      console.log('\n❌ Test fallito nella creazione dell\'assessment');
    }

  } catch (error) {
    console.error('\n❌ Errore generale:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui il test
main();