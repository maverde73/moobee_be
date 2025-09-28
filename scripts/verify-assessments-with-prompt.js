/**
 * Script per verificare che tutti gli assessment abbiano il prompt salvato
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAssessmentsWithPrompt() {
  try {
    console.log('🔍 Verifica assessment con prompt...\n');

    // Conta assessment con e senza prompt
    const totalAssessments = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM assessment_templates
    `;

    const withPrompt = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM assessment_templates
      WHERE "aiPrompt" IS NOT NULL
        AND "aiPrompt" != ''
        AND LENGTH("aiPrompt") > 10
    `;

    const withoutPrompt = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM assessment_templates
      WHERE "aiPrompt" IS NULL
         OR "aiPrompt" = ''
         OR LENGTH("aiPrompt") < 10
    `;

    console.log('📊 STATISTICHE ASSESSMENT:');
    console.log('='.repeat(50));
    console.log(`   Totale assessment: ${totalAssessments[0].total}`);
    console.log(`   ✅ Con prompt valido: ${withPrompt[0].total}`);
    console.log(`   ❌ Senza prompt: ${withoutPrompt[0].total}`);
    console.log('='.repeat(50));

    // Mostra dettagli degli ultimi assessment creati
    const recentAssessments = await prisma.$queryRaw`
      SELECT
        id,
        name,
        type,
        LENGTH("aiPrompt") as prompt_length,
        (SELECT COUNT(*) FROM assessment_questions WHERE "templateId" = at.id) as question_count,
        "createdAt"
      FROM assessment_templates at
      ORDER BY "createdAt" DESC
      LIMIT 10
    `;

    console.log('\n📋 ULTIMI 10 ASSESSMENT CREATI:');
    console.log('='.repeat(50));

    recentAssessments.forEach(a => {
      const hasPrompt = a.prompt_length && a.prompt_length > 10;
      const icon = hasPrompt ? '✅' : '❌';
      const promptInfo = hasPrompt ? `${a.prompt_length} caratteri` : 'NESSUN PROMPT';

      console.log(`${icon} ID: ${a.id} - ${a.name}`);
      console.log(`   Tipo: ${a.type}`);
      console.log(`   Domande: ${a.question_count}`);
      console.log(`   Prompt: ${promptInfo}`);
      console.log(`   Creato: ${new Date(a.createdAt).toLocaleString()}\n`);
    });

    // Verifica assessment senza domande
    const withoutQuestions = await prisma.$queryRaw`
      SELECT id, name
      FROM assessment_templates
      WHERE NOT EXISTS (
        SELECT 1 FROM assessment_questions
        WHERE "templateId" = assessment_templates.id
      )
    `;

    if (withoutQuestions.length > 0) {
      console.log('\n⚠️ ASSESSMENT SENZA DOMANDE:');
      console.log('='.repeat(50));
      withoutQuestions.forEach(a => {
        console.log(`   ID: ${a.id} - ${a.name}`);
      });
    }

    // Assessment con prompt più lungo
    const longestPrompt = await prisma.$queryRaw`
      SELECT
        id,
        name,
        LENGTH("aiPrompt") as prompt_length
      FROM assessment_templates
      WHERE "aiPrompt" IS NOT NULL
      ORDER BY LENGTH("aiPrompt") DESC
      LIMIT 1
    `;

    if (longestPrompt.length > 0) {
      console.log('\n🏆 ASSESSMENT CON PROMPT PIÙ LUNGO:');
      console.log(`   ${longestPrompt[0].name}`);
      console.log(`   Lunghezza prompt: ${longestPrompt[0].prompt_length} caratteri`);
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
verifyAssessmentsWithPrompt();