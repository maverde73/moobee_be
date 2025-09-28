const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log('\n🔍 VERIFICA TABELLE SOFT SKILLS NEL DATABASE\n');
    console.log('='.repeat(60));

    // Query diretta per vedere tutte le tabelle
    const allTables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\n📋 TUTTE LE TABELLE NEL DATABASE:');
    console.log('-'.repeat(40));
    allTables.forEach(t => console.log(`  - ${t.table_name}`));

    // Cerca specificamente tabelle con 'soft' nel nome
    const softTables = allTables.filter(t =>
      t.table_name.toLowerCase().includes('soft')
    );

    console.log('\n🎯 TABELLE CONTENENTI "SOFT":');
    console.log('-'.repeat(40));
    if (softTables.length === 0) {
      console.log('  ❌ NESSUNA TABELLA CON "SOFT" NEL NOME TROVATA');
    } else {
      softTables.forEach(t => console.log(`  ✅ ${t.table_name}`));
    }

    // Controlla specificamente soft_skills
    const hasSoftSkills = allTables.some(t => t.table_name === 'soft_skills');
    console.log('\n📊 VERIFICA TABELLA "soft_skills":');
    console.log('-'.repeat(40));
    if (hasSoftSkills) {
      console.log('  ✅ La tabella "soft_skills" ESISTE nel database');

      // Conta i record
      try {
        const count = await prisma.soft_skills.count();
        console.log(`  📈 Numero di record: ${count}`);

        // Mostra struttura
        const columns = await prisma.$queryRaw`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'soft_skills'
          ORDER BY ordinal_position
        `;

        console.log('\n  📝 STRUTTURA TABELLA:');
        columns.forEach(col => {
          console.log(`     - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
        });
      } catch (e) {
        console.log('  ⚠️ Errore nel verificare i dettagli della tabella');
      }
    } else {
      console.log('  ❌ La tabella "soft_skills" NON ESISTE nel database');
    }

    // Controlla altre tabelle correlate
    console.log('\n🔗 VERIFICA TABELLE CORRELATE:');
    console.log('-'.repeat(40));

    const relatedTables = [
      'role_soft_skills',
      'question_soft_skill_mappings',
      'assessment_soft_skill_scores',
      'tenant_soft_skill_profiles',
      'soft_skills_assessments'
    ];

    for (const tableName of relatedTables) {
      const exists = allTables.some(t => t.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}: ${exists ? 'ESISTE' : 'NON ESISTE'}`);
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();