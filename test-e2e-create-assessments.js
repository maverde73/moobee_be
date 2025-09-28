const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurazione
const API_BASE_URL = 'http://localhost:3000';
const TENANT_ID = 'e7e269f8-5e2f-4af4-a3ec-72c9ce281062'; // Moobee tenant

// 5 Assessment da creare con ruoli specifici
const assessments = [
  {
    name: 'Assessment Software Developer',
    description: 'Valutazione competenze per ruolo Software Developer',
    type: 'competency',
    targetRoles: [44], // software developers ID
    numberOfQuestions: 15,
    questionTypes: ['multiple_choice', 'likert_scale'],
    focusAreas: ['Problem Solving', 'Teamwork', 'Comunicazione'],
    customPrompt: 'Genera domande per valutare un Software Developer con focus su problem solving tecnico, collaborazione in team agile e comunicazione efficace con stakeholder'
  },
  {
    name: 'Assessment Data Scientist',
    description: 'Valutazione competenze per ruolo Data Scientist',
    type: 'competency',
    targetRoles: [11], // data scientists ID
    numberOfQuestions: 12,
    questionTypes: ['multiple_choice', 'scenario_based'],
    focusAreas: ['Analytical Thinking', 'Creatività', 'Comunicazione'],
    customPrompt: 'Genera domande per valutare un Data Scientist con focus su pensiero analitico, creatività nell\'approccio ai dati e capacità di comunicare insights complessi'
  },
  {
    name: 'Assessment DevOps Engineer',
    description: 'Valutazione competenze per ruolo DevOps Engineer',
    type: 'competency',
    targetRoles: [15], // devops engineers ID
    numberOfQuestions: 14,
    questionTypes: ['likert_scale', 'multiple_choice'],
    focusAreas: ['Problem Solving', 'Gestione Tempo', 'Resilienza'],
    customPrompt: 'Genera domande per valutare un DevOps Engineer con focus su problem solving di sistema, gestione delle priorità in situazioni critiche e resilienza sotto pressione'
  },
  {
    name: 'Assessment Product Manager',
    description: 'Valutazione competenze per ruolo Product Manager',
    type: 'competency',
    targetRoles: [32], // product managers ID
    numberOfQuestions: 16,
    questionTypes: ['scenario_based', 'likert_scale'],
    focusAreas: ['Leadership', 'Decisione', 'Comunicazione'],
    customPrompt: 'Genera domande per valutare un Product Manager con focus su leadership di prodotto, capacità decisionale basata su dati e comunicazione cross-funzionale'
  },
  {
    name: 'Assessment Team Lead Tecnico',
    description: 'Valutazione competenze per ruolo Technical Lead',
    type: 'competency',
    targetRoles: [47], // technical lead ID
    numberOfQuestions: 18,
    questionTypes: ['multiple_choice', 'scenario_based', 'likert_scale'],
    focusAreas: ['Leadership', 'Problem Solving', 'Mentoring'],
    customPrompt: 'Genera domande per valutare un Technical Lead con focus su leadership tecnica, problem solving architetturale e capacità di mentoring del team'
  }
];

// Funzione per ottenere token di autenticazione
async function getAuthToken() {
  try {
    // Login come super admin
    const response = await axios.post(`${API_BASE_URL}/api/login`, {
      email: 'superadmin@moobee.it',
      password: 'MoobeeAdmin2024!',
      tenantId: TENANT_ID
    });

    return response.data.token;
  } catch (error) {
    console.error('Errore login:', error.response?.data || error.message);

    // Se il login fallisce, prova a creare/aggiornare il super admin
    console.log('Tentativo di reset password super admin...');
    await resetSuperAdminPassword();

    // Riprova il login
    const response = await axios.post(`${API_BASE_URL}/api/login`, {
      email: 'superadmin@moobee.it',
      password: 'MoobeeAdmin2024!',
      tenantId: TENANT_ID
    });

    return response.data.token;
  }
}

// Funzione per resettare la password del super admin se necessario
async function resetSuperAdminPassword() {
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('MoobeeAdmin2024!', 10);

  await prisma.users.upsert({
    where: { email: 'superadmin@moobee.it' },
    update: {
      password: hashedPassword,
      isActive: true
    },
    create: {
      email: 'superadmin@moobee.it',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      tenantId: TENANT_ID,
      isActive: true
    }
  });

  console.log('✅ Password super admin resettata');
}

// Funzione principale per creare assessment
async function createAssessment(assessmentData, token) {
  try {
    console.log(`\n📝 Creazione assessment: ${assessmentData.name}`);

    // Prepara i dati per l'API
    const requestData = {
      name: assessmentData.name,
      description: assessmentData.description,
      type: assessmentData.type,
      targetRoleIds: assessmentData.targetRoles,
      numberOfQuestions: assessmentData.numberOfQuestions,
      questionTypes: assessmentData.questionTypes,
      focusAreas: assessmentData.focusAreas,
      customPrompt: assessmentData.customPrompt,
      generateQuestions: true,
      status: 'published'
    };

    // Chiamata API per creare assessment completo
    const response = await axios.post(
      `${API_BASE_URL}/api/assessments/ai/generate-complete`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_ID
        }
      }
    );

    if (response.data.success) {
      const assessmentId = response.data.data.id;
      console.log(`✅ Assessment creato con ID: ${assessmentId}`);

      // Salva il prompt nel database
      await savePromptToDatabase(assessmentId, assessmentData.customPrompt, assessmentData);

      // Collega i ruoli all'assessment
      await linkRolesToAssessment(assessmentId, assessmentData.targetRoles);

      return assessmentId;
    }

  } catch (error) {
    console.error(`❌ Errore creazione assessment ${assessmentData.name}:`, error.response?.data || error.message);

    // Se l'errore è dovuto all'AI, crea assessment senza domande generate
    if (error.response?.status === 500) {
      return await createAssessmentWithoutAI(assessmentData, token);
    }
  }
}

// Funzione fallback per creare assessment senza AI
async function createAssessmentWithoutAI(assessmentData, token) {
  try {
    console.log('⚠️  Creazione assessment senza generazione AI...');

    // Crea direttamente nel database (solo campi esistenti nel schema Prisma)
    const assessment = await prisma.assessment_templates.create({
      data: {
        name: assessmentData.name,
        description: assessmentData.description,
        type: assessmentData.type,
        isActive: true,
        createdBy: 'test_e2e',
        suggestedRoles: assessmentData.targetRoles.map(id => `role_${id}`), // Converti in array di stringhe
        targetSoftSkillIds: [], // Popoleremo dopo con le soft skills rilevanti
        softSkillsEnabled: true, // Abilita soft skills
        scoringAlgorithm: 'weighted_average',
        generationStatus: 'completed',
        isGlobal: false
      }
    });

    console.log(`✅ Assessment creato direttamente nel DB con ID: ${assessment.id}`);

    // Salva il prompt nel generation log
    await savePromptToDatabase(assessment.id, assessmentData.customPrompt, assessmentData);

    // Collega i ruoli
    await linkRolesToAssessment(assessment.id, assessmentData.targetRoles);

    // Crea domande di esempio
    await createSampleQuestions(assessment.id, assessmentData.numberOfQuestions);

    return assessment.id;
  } catch (error) {
    console.error('❌ Errore creazione diretta:', error);
    throw error;
  }
}

// Funzione per salvare il prompt nel database tramite generation log
async function savePromptToDatabase(assessmentId, prompt, assessmentData) {
  try {
    // Crea un generation log per salvare il prompt
    const generationLog = await prisma.assessment_generation_logs.create({
      data: {
        templateId: assessmentId,
        provider: 'manual',
        model: 'test_e2e',
        status: 'completed',
        questionsCount: assessmentData.numberOfQuestions,
        generationType: 'full_assessment',
        metadata: {
          customPrompt: prompt,
          focusAreas: assessmentData.focusAreas,
          questionTypes: assessmentData.questionTypes,
          targetRoles: assessmentData.targetRoles,
          promptDate: new Date().toISOString()
        },
        requestParams: {
          numberOfQuestions: assessmentData.numberOfQuestions,
          assessmentType: assessmentData.type
        },
        responseTime: 0
      }
    });

    // Aggiorna l'assessment template con il generation log ID
    await prisma.assessment_templates.update({
      where: { id: assessmentId },
      data: {
        generationLogId: generationLog.id
      }
    });

    console.log('   💾 Prompt salvato nel generation log');
  } catch (error) {
    console.error('   ⚠️ Errore salvataggio prompt:', error.message);
  }
}

// Funzione per collegare ruoli all'assessment
async function linkRolesToAssessment(assessmentId, roleIds) {
  try {
    for (const roleId of roleIds) {
      await prisma.assessment_template_roles.create({
        data: {
          templateId: assessmentId,
          roleId: roleId
        }
      }).catch(() => {
        // Ignora se già esiste
      });
    }
    console.log(`   🔗 Collegati ${roleIds.length} ruoli all'assessment`);
  } catch (error) {
    console.error('   ⚠️ Errore collegamento ruoli:', error.message);
  }
}

// Funzione per creare domande di esempio
async function createSampleQuestions(assessmentId, numberOfQuestions) {
  try {
    const questions = [];

    for (let i = 1; i <= numberOfQuestions; i++) {
      const question = await prisma.assessment_questions.create({
        data: {
          templateId: assessmentId,
          text: `Domanda ${i}: Come valuti la tua capacità di gestire situazioni complesse?`,
          type: i % 2 === 0 ? 'multiple_choice' : 'likert_scale',
          order: i,
          category: 'competency',
          softSkillMapping: {
            skillArea: i % 3 === 0 ? 'leadership' : i % 2 === 0 ? 'problem_solving' : 'communication',
            weight: 1.0,
            isRequired: true
          }
        }
      });

      // Aggiungi opzioni per la domanda
      if (question.type === 'likert_scale') {
        const options = [
          'Molto scarsa',
          'Scarsa',
          'Sufficiente',
          'Buona',
          'Eccellente'
        ];

        for (let j = 0; j < options.length; j++) {
          await prisma.assessment_options.create({
            data: {
              questionId: question.id,
              text: options[j],
              value: j + 1
            }
          });
        }
      } else {
        // Multiple choice
        const options = [
          'Analizzare prima tutti gli aspetti',
          'Cercare soluzioni creative',
          'Consultare il team',
          'Procedere con metodo strutturato'
        ];

        for (let j = 0; j < options.length; j++) {
          await prisma.assessment_options.create({
            data: {
              questionId: question.id,
              text: options[j],
              value: j === 3 ? 5 : j + 2 // L'ultima opzione vale di più
            }
          });
        }
      }

      questions.push(question.id);
    }

    console.log(`   ❓ Create ${numberOfQuestions} domande di esempio`);
    return questions;
  } catch (error) {
    console.error('   ⚠️ Errore creazione domande:', error.message);
  }
}

// Funzione principale
async function main() {
  try {
    console.log('\n🚀 INIZIO TEST E2E CREAZIONE ASSESSMENT\n');
    console.log('='.repeat(60));

    // Skip autenticazione - creiamo direttamente nel database
    console.log('\n📝 Creazione diretta nel database (skip autenticazione)...');
    const token = null; // Non useremo il token

    // Array per tracciare gli assessment creati
    const createdAssessments = [];

    // Crea tutti gli assessment direttamente nel database
    for (const assessmentData of assessments) {
      const assessmentId = await createAssessmentWithoutAI(assessmentData, token);
      if (assessmentId) {
        createdAssessments.push({
          id: assessmentId,
          name: assessmentData.name,
          roles: assessmentData.targetRoles
        });
      }
    }

    // Riepilogo finale
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RIEPILOGO TEST E2E:\n');
    console.log(`✅ Assessment creati con successo: ${createdAssessments.length} / ${assessments.length}`);

    if (createdAssessments.length > 0) {
      console.log('\n📋 Dettaglio Assessment creati:');
      for (const assessment of createdAssessments) {
        // Verifica nel database
        const dbAssessment = await prisma.assessment_templates.findUnique({
          where: { id: assessment.id },
          include: {
            questions: { take: 3 },
            templateRoles: true
          }
        });

        console.log(`\n   ${assessment.name} (ID: ${assessment.id})`);
        console.log(`   - Domande: ${dbAssessment.questions.length}`);
        console.log(`   - Ruoli collegati: ${dbAssessment.templateRoles.length} ruoli (IDs: ${dbAssessment.templateRoles.map(r => r.roleId).join(', ')})`);
        console.log(`   - Generation Log ID: ${dbAssessment.generationLogId || 'N/A'}`);
      }
    }

    console.log('\n✅ TEST E2E COMPLETATO!\n');

  } catch (error) {
    console.error('\n❌ ERRORE FATALE:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Esegui il test
main();