// Run Migration 044: Create MCP Optimized Views
// Created: 2025-10-12
// Usage: node run_migration_044.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Starting Migration 044: Create MCP Optimized Views\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'prisma/migrations/044_create_mcp_views.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQL file loaded successfully');
    console.log(`📊 File size: ${(sql.length / 1024).toFixed(2)} KB\n`);

    // Split SQL into individual statements (Prisma doesn't support multiple commands)
    console.log('⚙️  Executing migration...\n');

    // Split by CREATE OR REPLACE VIEW and COMMENT ON VIEW
    const statements = [];

    // Extract CREATE VIEW statements
    const createViewRegex = /CREATE OR REPLACE VIEW[\s\S]*?;/gi;
    const createMatches = sql.match(createViewRegex);
    if (createMatches) {
      statements.push(...createMatches);
    }

    // Extract COMMENT statements
    const commentRegex = /COMMENT ON VIEW[\s\S]*?;/gi;
    const commentMatches = sql.match(commentRegex);
    if (commentMatches) {
      statements.push(...commentMatches);
    }

    // Extract CREATE INDEX statements
    const indexRegex = /CREATE INDEX[\s\S]*?;/gi;
    const indexMatches = sql.match(indexRegex);
    if (indexMatches) {
      statements.push(...indexMatches);
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        console.log(`  [${i + 1}/${statements.length}] Executing...`);
        await prisma.$executeRawUnsafe(stmt);
      }
    }

    console.log('\n✅ All statements executed successfully!\n');

    // Verify views created
    const views = await prisma.$queryRawUnsafe(`
      SELECT
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN (
          'v_employee_skills_summary',
          'v_employee_complete_profile',
          'v_assessment_results_summary'
        )
      ORDER BY table_name
    `);

    console.log('📊 Created Views:\n');
    views.forEach((view, idx) => {
      console.log(`${idx + 1}. ${view.table_name}`);
      const defPreview = view.view_definition.substring(0, 100).replace(/\n/g, ' ');
      console.log(`   Definition: ${defPreview}...`);
      console.log('');
    });

    // Test queries on each view
    console.log('🧪 Testing views with sample queries...\n');

    // Test 1: v_employee_skills_summary
    const skillsCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM v_employee_skills_summary
    `);
    console.log(`✓ v_employee_skills_summary: ${skillsCount[0].count} rows`);

    // Test 2: v_employee_complete_profile
    const profilesCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM v_employee_complete_profile
    `);
    console.log(`✓ v_employee_complete_profile: ${profilesCount[0].count} rows`);

    // Test 3: v_assessment_results_summary
    const assessmentsCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM v_assessment_results_summary
    `);
    console.log(`✓ v_assessment_results_summary: ${assessmentsCount[0].count} rows`);

    console.log('\n🎉 Migration 044 completed successfully!\n');
    console.log('📝 Summary:');
    console.log('   - 3 views created');
    console.log('   - All views tested and verified\n');

    console.log('💡 Next steps:');
    console.log('   1. Update Prisma schema with view models (optional)');
    console.log('   2. Generate MCP documentation for new views');
    console.log('   3. Test MCP server with new views\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n💡 To rollback, run:');
    console.error('   node -e "const {PrismaClient} = require(\'@prisma/client\'); const prisma = new PrismaClient(); const fs = require(\'fs\'); const sql = fs.readFileSync(\'prisma/migrations/044_rollback.sql\', \'utf-8\'); prisma.\\$executeRawUnsafe(sql).then(() => { console.log(\'✅ Rollback complete\'); prisma.\\$disconnect(); });"');
    await prisma.$disconnect();
    process.exit(1);
  }
}

runMigration();
