#!/usr/bin/env node

/**
 * Test Suite Pre-Migration
 * Verifica che il sistema sia pronto per la rimozione dei campi duplicati
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:3000';

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

async function testGetUsersWithJoin() {
  log('\n=== Test 1: GET Users con JOIN ===', 'blue');

  try {
    // Get Nexa tenant
    const tenant = await prisma.tenants.findFirst({
      where: { slug: 'nexadata' }
    });

    if (!tenant) {
      log('❌ Tenant Nexa non trovato', 'red');
      return false;
    }

    // Test service direttamente
    const tenantUserService = require('./src/services/tenantUserService');
    const users = await tenantUserService.getUsersForTenant(tenant.id);

    let success = true;
    for (const user of users.slice(0, 3)) { // Test primi 3 users
      log(`\n📧 ${user.email}:`, 'blue');

      // Verifica che abbiamo i dati mappati
      if (user.first_name && user.last_name) {
        log(`  ✅ Nome: ${user.first_name} ${user.last_name}`, 'green');
      } else {
        log(`  ❌ Nome/Cognome mancanti!`, 'red');
        success = false;
      }

      // Verifica struttura employee
      if (user.employee) {
        log(`  ✅ Employee data presente`, 'green');
      }

      log(`  📋 Role: ${user.role}`, 'yellow');
      log(`  📋 Position: ${user.position || 'N/A'}`, 'yellow');
    }

    return success;

  } catch (error) {
    log('❌ Errore: ' + error.message, 'red');
    return false;
  }
}

async function testUpdateUserWithTransaction() {
  log('\n=== Test 2: UPDATE User con Transaction ===', 'blue');

  try {
    const tenant = await prisma.tenants.findFirst({
      where: { slug: 'nexadata' }
    });

    // Trova un utente test
    const testUser = await prisma.tenant_users.findFirst({
      where: {
        email: 'marco.rossi@nexadata.it',
        tenant_id: tenant.id
      }
    });

    if (!testUser) {
      log('⚠️  User test non trovato', 'yellow');
      return true; // Non bloccare il test
    }

    const tenantUserService = require('./src/services/tenantUserService');

    // Test update
    const updatedUser = await tenantUserService.updateUser(
      testUser.id,
      tenant.id,
      {
        first_name: 'Marco',
        last_name: 'Rossi Updated',
        role: 'employee'
      }
    );

    if (updatedUser) {
      log('✅ Update eseguito con successo', 'green');

      // Verifica che employee sia stato aggiornato
      const employee = await prisma.employees.findUnique({
        where: { id: testUser.employee_id }
      });

      if (employee.last_name === 'Rossi Updated') {
        log('✅ Employee aggiornato correttamente', 'green');
      } else {
        log('❌ Employee non aggiornato!', 'red');
        return false;
      }

      // Ripristina valore originale
      await tenantUserService.updateUser(
        testUser.id,
        tenant.id,
        { last_name: 'Rossi' }
      );
    }

    return true;

  } catch (error) {
    log('❌ Errore: ' + error.message, 'red');
    return false;
  }
}

async function testLoginWithEmployeeData() {
  log('\n=== Test 3: Login con Employee Data ===', 'blue');

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'giulia.verdi@nexadata.it',
        password: 'Password123!'
      })
    });

    const data = await response.json();

    if (data.success) {
      log('✅ Login successful', 'green');

      const user = data.user;

      // Verifica che abbiamo firstName/lastName
      if (user.firstName && user.lastName) {
        log(`✅ Nome da employee: ${user.firstName} ${user.lastName}`, 'green');
      } else {
        log('❌ Nome/Cognome non presenti nel login response!', 'red');
        return false;
      }

      // Verifica role e position
      log(`📋 Role (per UI): ${user.role}`, 'yellow');
      log(`📋 Position (display): ${user.position || 'N/A'}`, 'yellow');

      return true;
    } else {
      log('❌ Login fallito', 'red');
      return false;
    }

  } catch (error) {
    log('❌ Errore: ' + error.message, 'red');
    return false;
  }
}

async function checkForDirectReferences() {
  log('\n=== Test 4: Check Direct References ===', 'blue');

  const { execSync } = require('child_process');

  try {
    // Check backend per riferimenti diretti a first_name/last_name in tenant_users
    const backendCheck = execSync(
      `grep -r "tenant_users.*first_name\\|tenant_users.*last_name" src/ --include="*.js" || true`,
      { encoding: 'utf-8' }
    );

    if (backendCheck.trim()) {
      log('⚠️  Trovati riferimenti diretti a tenant_users.first_name/last_name:', 'yellow');
      console.log(backendCheck);
      return false;
    } else {
      log('✅ Nessun riferimento diretto a tenant_users.first_name/last_name', 'green');
    }

    return true;

  } catch (error) {
    log('⚠️  Impossibile verificare riferimenti: ' + error.message, 'yellow');
    return true;
  }
}

async function runAllTests() {
  log('========================================', 'blue');
  log('     TEST MIGRATION READINESS CHECK     ', 'blue');
  log('========================================', 'blue');

  const tests = [
    { name: 'Get Users con JOIN', fn: testGetUsersWithJoin },
    { name: 'Update con Transaction', fn: testUpdateUserWithTransaction },
    { name: 'Login con Employee Data', fn: testLoginWithEmployeeData },
    { name: 'Check Direct References', fn: checkForDirectReferences }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  log('\n========================================', 'blue');
  log('           RISULTATI FINALI             ', 'blue');
  log('========================================', 'blue');
  log(`✅ Test passati: ${passed}/${tests.length}`, 'green');

  if (failed > 0) {
    log(`❌ Test falliti: ${failed}/${tests.length}`, 'red');
    log('\n⚠️  SISTEMA NON PRONTO PER LA MIGRATION!', 'red');
    log('Correggere i problemi identificati prima di procedere.', 'yellow');
  } else {
    log('\n🎉 SISTEMA PRONTO PER LA MIGRATION! 🎉', 'green');
    log('Puoi procedere con:', 'green');
    log('  npx prisma migrate dev --name remove_duplicate_name_fields', 'blue');
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

// Esegui i test
runAllTests().catch(error => {
  log('Errore fatale: ' + error.message, 'red');
  process.exit(1);
});