// Analyze Database Views
// Created: 2025-10-12
// Purpose: Analyze all views in the database to prepare MCP documentation

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeViews() {
  try {
    console.log('🔍 ANALISI VISTE DATABASE');
    console.log('═'.repeat(100));

    // 1. Get all views
    const views = await prisma.$queryRawUnsafe(`
      SELECT
        table_name,
        view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`\n📊 Totale viste trovate: ${views.length}\n`);

    // 2. For each view, get columns and details
    for (const view of views) {
      console.log('\n' + '━'.repeat(100));
      console.log(`VIEW: ${view.table_name}`);
      console.log('━'.repeat(100));

      // Get columns from information_schema
      const columns = await prisma.$queryRawUnsafe(`
        SELECT
          column_name,
          data_type,
          udt_name,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `, view.table_name);

      console.log(`\nCampi (${columns.length} totali):`);
      columns.forEach((col, idx) => {
        const type = col.character_maximum_length
          ? `${col.data_type}(${col.character_maximum_length})`
          : col.data_type;
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const def = col.column_default ? ` [DEFAULT: ${col.column_default}]` : '';
        console.log(`  ${idx + 1}. ${col.column_name} (${type}) ${nullable}${def}`);
      });

      console.log(`\nDefinizione SQL:`);
      console.log(view.view_definition.substring(0, 500) + '...');

      // Count usage in codebase
      const { execSync } = require('child_process');
      try {
        const grepResult = execSync(
          `grep -r "${view.table_name}" src/ --include="*.js" 2>/dev/null | wc -l`,
          { cwd: '/home/mgiurelli/sviluppo/moobee/BE_nodejs', encoding: 'utf-8' }
        );
        const usageCount = parseInt(grepResult.trim());
        console.log(`\n📈 Utilizzo nel codice: ${usageCount} occorrenze`);
      } catch (e) {
        console.log(`\n📈 Utilizzo nel codice: 0 occorrenze`);
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log('\n📋 RIEPILOGO VISTE PER PRIORITÀ:\n');

    // Analyze usage and priority
    const viewAnalysis = [];
    for (const view of views) {
      const { execSync } = require('child_process');
      let usageCount = 0;
      let usedInFiles = [];

      try {
        const grepFiles = execSync(
          `grep -l "${view.table_name}" src/**/*.js 2>/dev/null || true`,
          { cwd: '/home/mgiurelli/sviluppo/moobee/BE_nodejs', encoding: 'utf-8', shell: '/bin/bash' }
        );
        usedInFiles = grepFiles.trim().split('\n').filter(f => f);
        usageCount = usedInFiles.length;
      } catch (e) {
        // No matches
      }

      // Get column count
      const columns = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, view.table_name);

      viewAnalysis.push({
        name: view.table_name,
        usage: usageCount,
        files: usedInFiles,
        columnCount: parseInt(columns[0].count)
      });
    }

    // Sort by usage (most used first)
    viewAnalysis.sort((a, b) => b.usage - a.usage);

    console.log('PRIORITÀ 1 - Viste usate nel BE (alta priorità):');
    const priority1 = viewAnalysis.filter(v => v.usage > 0);
    if (priority1.length > 0) {
      priority1.forEach(v => {
        console.log(`  ✅ ${v.name}`);
        console.log(`     - Usata in ${v.usage} file(s)`);
        console.log(`     - ${v.columnCount} campi`);
        v.files.forEach(f => console.log(`     - ${f}`));
      });
    } else {
      console.log('  (nessuna)');
    }

    console.log('\nPRIORITÀ 2 - Viste non usate (bassa priorità):');
    const priority2 = viewAnalysis.filter(v => v.usage === 0);
    if (priority2.length > 0) {
      priority2.forEach(v => {
        console.log(`  📦 ${v.name} (${v.columnCount} campi) - Non usata nel codice`);
      });
    } else {
      console.log('  (nessuna)');
    }

    console.log('\n' + '═'.repeat(100));
    console.log('\n✅ Analisi completata!\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Errore durante l\'analisi:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

analyzeViews();
