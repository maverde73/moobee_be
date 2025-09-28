const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssessmentTables() {
  try {
    // Verifica quali tabelle assessment esistono nel database
    const result = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'assessment%'
      ORDER BY table_name;
    `;

    console.log('📊 Tabelle Assessment trovate nel database:');
    console.log('=====================================');
    result.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Verifica se assessment_templates esiste
    try {
      const count = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM assessment_templates;
      `;
      console.log(`\n✅ Tabella assessment_templates esiste con ${count[0].count} record`);
    } catch (error) {
      console.log('\n❌ Tabella assessment_templates NON ESISTE');
      console.log('   Dobbiamo crearla con una migration');
    }

    // Verifica soft_skills
    try {
      const softSkillsCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM soft_skills;
      `;
      console.log(`\n✅ Tabella soft_skills esiste con ${softSkillsCount[0].count} record`);
    } catch (error) {
      console.log('\n❌ Tabella soft_skills NON ESISTE');
    }

    // Verifica role_soft_skills
    try {
      const roleSoftSkillsCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM role_soft_skills;
      `;
      console.log(`✅ Tabella role_soft_skills esiste con ${roleSoftSkillsCount[0].count} record`);
    } catch (error) {
      console.log('❌ Tabella role_soft_skills NON ESISTE');
    }

  } catch (error) {
    console.error('Errore durante la verifica:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssessmentTables();