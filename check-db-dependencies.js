#!/usr/bin/env node

/**
 * Verifica dipendenze database per i campi first_name/last_name in tenant_users
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkDatabaseDependencies() {
  log('\n=== VERIFICA DIPENDENZE DATABASE ===', 'blue');

  const checks = [];

  // 1. Check Views
  log('\n1. Controllo VISTE:', 'blue');
  const views = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  `;

  if (views.length > 0) {
    log(`  ⚠️  Trovate ${views.length} viste nel database:`, 'yellow');
    for (const view of views) {
      log(`     - ${view.table_name}`, 'yellow');

      // Check if view uses tenant_users columns
      const viewDef = await prisma.$queryRaw`
        SELECT view_definition
        FROM information_schema.views
        WHERE table_name = ${view.table_name}
      `;

      if (viewDef[0]?.view_definition?.includes('first_name') ||
          viewDef[0]?.view_definition?.includes('last_name')) {
        log(`     ❌ ATTENZIONE: Questa vista usa first_name/last_name!`, 'red');
        checks.push(false);
      }
    }
  } else {
    log('  ✅ Nessuna vista trovata', 'green');
    checks.push(true);
  }

  // 2. Check Stored Procedures/Functions
  log('\n2. Controllo STORED PROCEDURES/FUNCTIONS:', 'blue');
  const routines = await prisma.$queryRaw`
    SELECT routine_name, routine_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
  `;

  if (routines.length > 0) {
    log(`  ⚠️  Trovate ${routines.length} routines:`, 'yellow');
    for (const routine of routines) {
      log(`     - ${routine.routine_type}: ${routine.routine_name}`, 'yellow');
    }
  } else {
    log('  ✅ Nessuna stored procedure/function trovata', 'green');
    checks.push(true);
  }

  // 3. Check Triggers
  log('\n3. Controllo TRIGGERS:', 'blue');
  const triggers = await prisma.$queryRaw`
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'tenant_users'
  `;

  if (triggers.length > 0) {
    log(`  ⚠️  Trovati ${triggers.length} triggers su tenant_users:`, 'yellow');
    for (const trigger of triggers) {
      log(`     - ${trigger.trigger_name}`, 'yellow');
    }
  } else {
    log('  ✅ Nessun trigger su tenant_users', 'green');
    checks.push(true);
  }

  // 4. Check Foreign Keys
  log('\n4. Controllo FOREIGN KEYS:', 'blue');
  const fks = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'tenant_users'
      AND kcu.column_name IN ('first_name', 'last_name')
  `;

  if (fks.length > 0) {
    log(`  ❌ Trovate ${fks.length} foreign keys che usano first_name/last_name!`, 'red');
    checks.push(false);
  } else {
    log('  ✅ Nessuna FK usa first_name/last_name', 'green');
    checks.push(true);
  }

  // 5. Check Indexes
  log('\n5. Controllo INDICI:', 'blue');
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'tenant_users'
      AND (indexdef LIKE '%first_name%' OR indexdef LIKE '%last_name%')
  `;

  if (indexes.length > 0) {
    log(`  ⚠️  Trovati ${indexes.length} indici che usano first_name/last_name:`, 'yellow');
    for (const idx of indexes) {
      log(`     - ${idx.indexname}`, 'yellow');
    }
    log('  Questi indici verranno rimossi automaticamente', 'yellow');
  } else {
    log('  ✅ Nessun indice specifico su first_name/last_name', 'green');
    checks.push(true);
  }

  // 6. Check Query Raw nel codice
  log('\n6. Controllo QUERY RAW nel codice:', 'blue');
  const { execSync } = require('child_process');

  try {
    const rawQueries = execSync(
      `grep -r "tenant_users" ../src --include="*.js" | grep -E "queryRaw|executeRaw" | wc -l`,
      { encoding: 'utf-8' }
    ).trim();

    if (parseInt(rawQueries) > 0) {
      log(`  ⚠️  Trovate ${rawQueries} query raw che potrebbero usare tenant_users`, 'yellow');
      log('  Verificare manualmente queste query', 'yellow');
    } else {
      log('  ✅ Nessuna query raw trovata per tenant_users', 'green');
      checks.push(true);
    }
  } catch (error) {
    log('  ⚠️  Impossibile verificare query raw', 'yellow');
  }

  // 7. Check Data Consistency
  log('\n7. Controllo CONSISTENZA DATI:', 'blue');
  const inconsistent = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM tenant_users tu
    INNER JOIN employees e ON tu.employee_id = e.id
    WHERE (tu.first_name IS DISTINCT FROM e.first_name)
       OR (tu.last_name IS DISTINCT FROM e.last_name)
  `;

  const count = parseInt(inconsistent[0].count);
  if (count > 0) {
    log(`  ❌ Trovati ${count} record con dati inconsistenti tra le tabelle!`, 'red');
    log('  Correggere prima della migration', 'red');
    checks.push(false);
  } else {
    log('  ✅ Tutti i dati sono consistenti tra le tabelle', 'green');
    checks.push(true);
  }

  // Summary
  log('\n========================================', 'blue');
  log('             RISULTATI                  ', 'blue');
  log('========================================', 'blue');

  const allPassed = checks.every(c => c !== false);

  if (allPassed) {
    log('\n✅ DATABASE PRONTO PER LA MIGRATION!', 'green');
    log('\nPuoi procedere con:', 'green');
    log('1. Rimuovere first_name e last_name da schema.prisma', 'blue');
    log('2. npx prisma migrate dev --name remove_duplicate_name_fields', 'blue');
  } else {
    log('\n❌ PROBLEMI TROVATI - Correggere prima di procedere', 'red');
  }

  await prisma.$disconnect();
}

// Run checks
checkDatabaseDependencies().catch(error => {
  log('Errore: ' + error.message, 'red');
  process.exit(1);
});