const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllTables() {
  try {
    console.log('🔍 Verifica TUTTE le tabelle nel database Railway:\n');

    // Query diretta per vedere TUTTE le tabelle
    const allTables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('📋 TUTTE LE TABELLE NEL DATABASE:');
    console.log('=====================================');
    allTables.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Conta record in alcune tabelle chiave
    console.log('\n📊 CONTEGGIO RECORD:');
    console.log('=====================================');

    const tables = [
      'assessment_templates',
      'assessment_questions',
      'assessment_options',
      'assessment_soft_skill_scores',
      'assessment_template_roles',
      'soft_skills',
      'role_soft_skills',
      'tenant_assessment_selection'
    ];

    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ ${table}: ${result[0].count} record`);
      } catch (err) {
        console.log(`❌ ${table}: NON ESISTE o ERRORE`);
      }
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllTables();