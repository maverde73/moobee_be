const { Client } = require('pg');
require('dotenv').config();

async function testDirectConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connesso al database Railway\n');

    // Verifica tabelle assessment
    const assessmentTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'assessment%'
      ORDER BY table_name
    `);

    console.log('📋 TABELLE ASSESSMENT NEL DATABASE:');
    console.log('=====================================');
    assessmentTables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Verifica tabelle soft skills
    const softSkillsTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE '%soft_skill%' OR table_name = 'soft_skills')
      ORDER BY table_name
    `);

    console.log('\n📋 TABELLE SOFT SKILLS:');
    console.log('=====================================');
    softSkillsTables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Verifica role tables
    const roleTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'role%'
      ORDER BY table_name
    `);

    console.log('\n📋 TABELLE RUOLI:');
    console.log('=====================================');
    roleTables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Conta i record in assessment_templates
    try {
      const count = await client.query('SELECT COUNT(*) FROM assessment_templates');
      console.log(`\n📊 assessment_templates contiene ${count.rows[0].count} record`);
    } catch (err) {
      console.log('\n❌ Errore conteggio assessment_templates:', err.message);
    }

  } catch (error) {
    console.error('❌ Errore di connessione:', error.message);
  } finally {
    await client.end();
  }
}

testDirectConnection();