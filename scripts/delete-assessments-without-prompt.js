/**
 * Script per eliminare tutti gli assessment che non hanno il prompt salvato
 * Include l'eliminazione delle domande e opzioni collegate
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAssessmentsWithoutPrompt() {
  try {
    console.log('🔍 Ricerca assessment senza prompt...\n');

    // Trova tutti gli assessment senza prompt (o con prompt vuoto)
    const assessmentsWithoutPrompt = await prisma.$queryRaw`
      SELECT
        id,
        name,
        type,
        "aiPrompt",
        "createdAt",
        (SELECT COUNT(*) FROM assessment_questions WHERE "templateId" = at.id) as question_count
      FROM assessment_templates at
      WHERE "aiPrompt" IS NULL
         OR "aiPrompt" = ''
         OR LENGTH("aiPrompt") < 10
      ORDER BY "createdAt" DESC
    `;

    if (assessmentsWithoutPrompt.length === 0) {
      console.log('✅ Nessun assessment senza prompt trovato.');
      return;
    }

    console.log(`📊 Trovati ${assessmentsWithoutPrompt.length} assessment senza prompt:\n`);

    assessmentsWithoutPrompt.forEach(a => {
      console.log(`ID: ${a.id} - ${a.name}`);
      console.log(`   Tipo: ${a.type}`);
      console.log(`   Domande: ${a.question_count}`);
      console.log(`   Prompt: ${a.aiPrompt || 'VUOTO'}`);
      console.log(`   Creato: ${new Date(a.createdAt).toLocaleString()}\n`);
    });

    // Conferma eliminazione
    console.log('⚠️  ATTENZIONE: Questi assessment e tutte le loro domande/opzioni verranno eliminati!');
    console.log('Procedere con l\'eliminazione? (decommentare il codice per confermare)\n');

    // DECOMMENTARE PER ESEGUIRE L'ELIMINAZIONE

    const assessmentIds = assessmentsWithoutPrompt.map(a => a.id);

    // Prima elimina le opzioni delle domande
    console.log('🗑️  Eliminazione opzioni...');
    const deletedOptions = await prisma.$executeRaw`
      DELETE FROM assessment_options
      WHERE "questionId" IN (
        SELECT id FROM assessment_questions
        WHERE "templateId" = ANY(${assessmentIds})
      )
    `;
    console.log(`   ✅ ${deletedOptions} opzioni eliminate`);

    // Poi elimina le domande
    console.log('🗑️  Eliminazione domande...');
    const deletedQuestions = await prisma.$executeRaw`
      DELETE FROM assessment_questions
      WHERE "templateId" = ANY(${assessmentIds})
    `;
    console.log(`   ✅ ${deletedQuestions} domande eliminate`);

    // Skip eliminazione selezioni tenant (tabella potrebbe non esistere o avere campi diversi)
    console.log('⏭️  Skip eliminazione selezioni tenant...');

    // Infine elimina gli assessment
    console.log('🗑️  Eliminazione assessment...');
    const deletedAssessments = await prisma.$executeRaw`
      DELETE FROM assessment_templates
      WHERE id = ANY(${assessmentIds})
    `;
    console.log(`   ✅ ${deletedAssessments} assessment eliminati`);

    console.log('\n✅ ELIMINAZIONE COMPLETATA!');


    // Mostra gli assessment rimanenti
    const remainingAssessments = await prisma.$queryRaw`
      SELECT
        id,
        name,
        type,
        LENGTH("aiPrompt") as prompt_length,
        (SELECT COUNT(*) FROM assessment_questions WHERE "templateId" = at.id) as question_count
      FROM assessment_templates at
      WHERE "aiPrompt" IS NOT NULL AND LENGTH("aiPrompt") > 10
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;

    console.log(`\n📊 Assessment rimanenti con prompt valido: ${remainingAssessments.length}`);
    remainingAssessments.forEach(a => {
      console.log(`   ✅ ${a.name} (${a.question_count} domande, prompt: ${a.prompt_length} caratteri)`);
    });

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
deleteAssessmentsWithoutPrompt();