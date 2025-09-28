const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const prisma = new PrismaClient();

async function importNexaUsers() {
  console.log('\n📥 IMPORT UTENTI NEXA DATA V2\n');
  console.log('='.repeat(50));
  console.log('Schema aggiornato: first_name/last_name SOLO in employees');
  console.log('='.repeat(50));

  const csvPath = path.join(__dirname, '..', 'docs', 'utenti nexa.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File CSV non trovato: ${csvPath}`);
    return;
  }

  // Trova o crea tenant Nexa Data
  let tenant = await prisma.tenants.findFirst({
    where: { slug: 'nexadata' }
  });

  if (!tenant) {
    console.log('⚠️ Tenant non trovato, creazione in corso...');
    tenant = await prisma.tenants.create({
      data: {
        id: 'b1234567-89ab-cdef-0123-456789abcdef',
        name: 'Nexa Data SRL',
        slug: 'nexadata',
        domain: 'nexadata.it',
        email: 'info@nexadata.it',
        is_active: true
      }
    });
    console.log('✅ Tenant creato');
  } else {
    console.log(`✅ Tenant trovato: ${tenant.name}`);
  }

  const users = [];
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Leggi CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv({ separator: ';' }))
      .on('data', (row) => {
        users.push(row);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`\n📊 Trovati ${users.length} utenti nel CSV\n`);

  // Importa utenti
  for (const user of users) {
    const email = user.email?.trim();
    const firstName = user['First name']?.trim() || '';
    const lastName = user['Last name']?.trim() || '';
    const password = user.Password?.trim() || 'Password123!';
    const role = user.Ruolo?.trim() || 'employee';

    if (!email) {
      console.log(`⚠️ Skipping: utente senza email`);
      totalSkipped++;
      continue;
    }

    try {
      // Verifica se utente esiste già
      const existingUser = await prisma.tenant_users.findFirst({
        where: {
          email: email,
          tenant_id: tenant.id
        }
      });

      if (existingUser) {
        console.log(`⏭️  Skip: ${email} (già esistente)`);
        totalSkipped++;
        continue;
      }

      // Hash della password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crea con transazione atomica
      await prisma.$transaction(async (tx) => {
        // 1. Prima crea l'employee con i dati anagrafici
        const employee = await tx.employees.create({
          data: {
            first_name: firstName,
            last_name: lastName,
            email: email,
            tenant_id: tenant.id,
            is_active: true,
            position: role === 'hr' ? 'HR Manager' : null,
            hire_date: new Date(),
            created_at: new Date()
          }
        });

        // 2. Poi crea il tenant_user SENZA first_name/last_name
        const tenantUser = await tx.tenant_users.create({
          data: {
            email: email,
            password_hash: hashedPassword,
            role: role,
            tenant_id: tenant.id,
            employee_id: employee.id, // Collega all'employee
            is_active: true,
            // Imposta scadenza password a 1 anno per forzare cambio al primo login
            password_reset_token: 'FORCE_CHANGE',
            password_reset_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 anno
            created_at: new Date()
            // NOTA: NO first_name, NO last_name qui!
          }
        });

        console.log(`✅ Importato: ${email} - ${firstName} ${lastName} (${role})`);
      });

      totalImported++;

    } catch (error) {
      console.error(`❌ Errore per ${email}:`, error.message);
      totalErrors++;
    }
  }

  // Crea anche utenti speciali per test
  console.log('\n📝 Creazione utenti speciali per test...\n');

  const specialUsers = [
    {
      email: 'giulia.verdi@nexadata.it',
      firstName: 'Giulia',
      lastName: 'Verdi',
      password: 'Password123!',
      role: 'hr',
      position: 'HR Manager'
    },
    {
      email: 'marco.rossi@nexadata.it',
      firstName: 'Marco',
      lastName: 'Rossi',
      password: 'Password123!',
      role: 'employee',
      position: 'Developer'
    }
  ];

  for (const user of specialUsers) {
    try {
      const existing = await prisma.tenant_users.findFirst({
        where: {
          email: user.email,
          tenant_id: tenant.id
        }
      });

      if (!existing) {
        const hashedPassword = await bcrypt.hash(user.password, 10);

        await prisma.$transaction(async (tx) => {
          // 1. Crea employee
          const employee = await tx.employees.create({
            data: {
              first_name: user.firstName,
              last_name: user.lastName,
              email: user.email,
              tenant_id: tenant.id,
              is_active: true,
              position: user.position,
              hire_date: new Date()
            }
          });

          // 2. Crea tenant_user (senza nomi)
          await tx.tenant_users.create({
            data: {
              email: user.email,
              password_hash: hashedPassword,
              role: user.role,
              tenant_id: tenant.id,
              employee_id: employee.id,
              is_active: true
              // NOTA: Utenti test NON hanno forza cambio password
            }
          });

          console.log(`✅ Utente test creato: ${user.email} (${user.role})`);
        });
      } else {
        console.log(`⏭️  Utente test già esistente: ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Errore creazione utente test ${user.email}:`, error.message);
    }
  }

  // Verifica finale
  const finalUserCount = await prisma.tenant_users.count({
    where: { tenant_id: tenant.id }
  });

  const finalEmployeeCount = await prisma.employees.count({
    where: { tenant_id: tenant.id }
  });

  console.log('\n' + '='.repeat(50));
  console.log('📊 RIEPILOGO IMPORT');
  console.log('='.repeat(50));
  console.log(`✅ Importati: ${totalImported}`);
  console.log(`⏭️  Saltati: ${totalSkipped}`);
  console.log(`❌ Errori: ${totalErrors}`);
  console.log(`\n📈 Totali nel database:`);
  console.log(`   - Utenti (tenant_users): ${finalUserCount}`);
  console.log(`   - Dipendenti (employees): ${finalEmployeeCount}`);

  // Test di verifica JOIN
  console.log('\n🔍 Test verifica JOIN:');
  const sampleUsers = await prisma.tenant_users.findMany({
    where: { tenant_id: tenant.id },
    take: 3,
    include: {
      employee: {
        select: {
          first_name: true,
          last_name: true,
          position: true
        }
      }
    }
  });

  for (const user of sampleUsers) {
    const name = user.employee ?
      `${user.employee.first_name} ${user.employee.last_name}` :
      'NO EMPLOYEE DATA';
    console.log(`   ${user.email}: ${name} (${user.role})`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Import completato con successo!');
}

importNexaUsers().catch(error => {
  console.error('❌ Errore fatale:', error);
  prisma.$disconnect();
  process.exit(1);
});