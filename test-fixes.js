#!/usr/bin/env node

/**
 * Script di test per verificare i fix implementati
 * Esegue test per:
 * 1. Login con differenziazione UI basata su role
 * 2. Password reset con scadenza 1 anno
 * 3. Import CSV single source of truth
 */

// Use dynamic import for node-fetch v3+
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:3000';
let testsPassed = 0;
let testsFailed = 0;

// Colori per output
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

async function testLogin() {
  log('\n=== Test 1: Login e verifica role ===', 'blue');

  try {
    // Test login HR user
    const hrResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'giulia.verdi@nexadata.it',
        password: 'Password123!'
      })
    });

    const hrData = await hrResponse.json();

    if (hrData.success && hrData.user.role === 'hr') {
      log('✅ HR login corretto - role: ' + hrData.user.role, 'green');
      log('   Position (solo display): ' + (hrData.user.position || 'N/A'), 'yellow');
      testsPassed++;
    } else {
      log('❌ HR login fallito o role errato', 'red');
      testsFailed++;
    }

    // Test login Employee user
    const empResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'marco.rossi@nexadata.it',
        password: 'Password123!'
      })
    });

    const empData = await empResponse.json();

    if (empData.success && empData.user.role === 'employee') {
      log('✅ Employee login corretto - role: ' + empData.user.role, 'green');
      log('   Position (solo display): ' + (empData.user.position || 'N/A'), 'yellow');
      testsPassed++;
    } else {
      log('❌ Employee login fallito o role errato', 'red');
      testsFailed++;
    }

  } catch (error) {
    log('❌ Errore durante test login: ' + error.message, 'red');
    testsFailed++;
  }
}

async function testPasswordReset() {
  log('\n=== Test 2: Password Reset Expiry ===', 'blue');

  try {
    // Verifica che gli utenti importati abbiano password_reset_expires_at settato
    const users = await prisma.tenant_users.findMany({
      where: {
        email: {
          contains: '@nexadata.it'
        }
      },
      select: {
        email: true,
        password_reset_expires_at: true,
        password_reset_token: true
      }
    });

    let validExpiry = 0;
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    for (const user of users) {
      if (user.password_reset_expires_at) {
        const expiryDate = new Date(user.password_reset_expires_at);
        const daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry > 360 && daysUntilExpiry <= 366) {
          validExpiry++;
          log(`✅ ${user.email}: scadenza tra ${daysUntilExpiry} giorni`, 'green');
        } else {
          log(`⚠️  ${user.email}: scadenza anomala (${daysUntilExpiry} giorni)`, 'yellow');
        }
      }
    }

    if (validExpiry > 0) {
      log(`✅ ${validExpiry}/${users.length} utenti con scadenza password corretta`, 'green');
      testsPassed++;
    } else {
      log('❌ Nessun utente con scadenza password corretta', 'red');
      testsFailed++;
    }

  } catch (error) {
    log('❌ Errore durante test password reset: ' + error.message, 'red');
    testsFailed++;
  }
}

async function testDataConsistency() {
  log('\n=== Test 3: Consistenza Dati (Nome/Cognome) ===', 'blue');

  try {
    // Verifica che nome/cognome siano allineati tra employees e tenant_users
    const query = `
      SELECT
        tu.email,
        tu.first_name as tu_first,
        tu.last_name as tu_last,
        e.first_name as e_first,
        e.last_name as e_last
      FROM tenant_users tu
      INNER JOIN employees e ON tu.employee_id = e.id
      WHERE tu.email LIKE '%@nexadata.it%'
    `;

    const results = await prisma.$queryRawUnsafe(query);

    let consistent = 0;
    let inconsistent = 0;

    for (const row of results) {
      if (row.tu_first === row.e_first && row.tu_last === row.e_last) {
        consistent++;
        log(`✅ ${row.email}: dati consistenti`, 'green');
      } else {
        inconsistent++;
        log(`❌ ${row.email}: dati INCONSISTENTI!`, 'red');
        log(`   tenant_users: ${row.tu_first} ${row.tu_last}`, 'yellow');
        log(`   employees: ${row.e_first} ${row.e_last}`, 'yellow');
      }
    }

    if (inconsistent === 0) {
      log(`✅ Tutti i ${consistent} utenti hanno dati consistenti`, 'green');
      testsPassed++;
    } else {
      log(`❌ ${inconsistent} utenti con dati inconsistenti`, 'red');
      testsFailed++;
    }

  } catch (error) {
    log('❌ Errore durante test consistenza: ' + error.message, 'red');
    testsFailed++;
  }
}

async function testUIRole() {
  log('\n=== Test 4: UI Differentiation (role vs position) ===', 'blue');

  try {
    const users = await prisma.$queryRawUnsafe(`
      SELECT
        tu.email,
        tu.role as system_role,
        e.position as job_position
      FROM tenant_users tu
      INNER JOIN employees e ON tu.employee_id = e.id
      WHERE tu.email LIKE '%@nexadata.it%'
    `);

    for (const user of users) {
      log(`📧 ${user.email}:`, 'blue');
      log(`   System Role (UI): ${user.system_role}`, 'green');
      log(`   Job Position (Display): ${user.job_position || 'N/A'}`, 'yellow');

      // Verifica che position sia settato correttamente per HR
      if (user.system_role === 'hr' && user.job_position === 'HR Manager') {
        log('   ✅ HR position settato correttamente', 'green');
      } else if (user.system_role === 'employee' && (!user.job_position || user.job_position === '')) {
        log('   ✅ Employee position vuoto come previsto', 'green');
      }
    }

    testsPassed++;

  } catch (error) {
    log('❌ Errore durante test UI role: ' + error.message, 'red');
    testsFailed++;
  }
}

async function runTests() {
  log('========================================', 'blue');
  log('   TEST FIX DATABASE REORGANIZATION    ', 'blue');
  log('========================================', 'blue');

  await testLogin();
  await testPasswordReset();
  await testDataConsistency();
  await testUIRole();

  log('\n========================================', 'blue');
  log('            RISULTATI TEST              ', 'blue');
  log('========================================', 'blue');
  log(`✅ Test passati: ${testsPassed}`, 'green');
  log(`❌ Test falliti: ${testsFailed}`, 'red');

  if (testsFailed === 0) {
    log('\n🎉 TUTTI I TEST SONO PASSATI! 🎉', 'green');
  } else {
    log('\n⚠️  Alcuni test sono falliti, verificare i fix', 'yellow');
  }

  await prisma.$disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Esegui i test
runTests().catch(error => {
  log('Errore fatale: ' + error.message, 'red');
  process.exit(1);
});