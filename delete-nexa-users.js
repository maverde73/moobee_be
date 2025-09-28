const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteNexaUsers() {
  console.log('\n🗑️  ELIMINAZIONE UTENTI NEXA DATA\n');
  console.log('='.repeat(50));

  try {
    // 1. Trova il tenant Nexa Data
    const tenant = await prisma.tenants.findFirst({
      where: {
        OR: [
          { slug: 'nexadata' },
          { name: { contains: 'Nexa' } }
        ]
      }
    });

    if (!tenant) {
      console.log('❌ Tenant Nexa Data non trovato');
      return;
    }

    console.log(`✅ Tenant trovato: ${tenant.name} (${tenant.id})`);

    // 2. Conta utenti prima della cancellazione
    const usersBefore = await prisma.tenant_users.count({
      where: { tenant_id: tenant.id }
    });

    const employeesBefore = await prisma.employees.count({
      where: { tenant_id: tenant.id }
    });

    console.log(`\n📊 Stato attuale:`);
    console.log(`   - Utenti in tenant_users: ${usersBefore}`);
    console.log(`   - Dipendenti in employees: ${employeesBefore}`);

    if (usersBefore === 0 && employeesBefore === 0) {
      console.log('\n⚠️  Nessun utente da eliminare');
      return;
    }

    // 3. Cancella con transazione per garantire consistenza
    console.log('\n🔄 Avvio cancellazione...\n');

    const result = await prisma.$transaction(async (tx) => {
      // Prima cancella dalle tabelle dipendenti (se esistono)
      // Grazie al CASCADE, molte saranno cancellate automaticamente

      // Cancella assessments
      const assessments = await tx.assessments.deleteMany({
        where: { tenant_id: tenant.id }
      });
      console.log(`   ✅ Cancellati ${assessments.count} assessments`);

      // Cancella employee_skills
      const skills = await tx.employee_skills.deleteMany({
        where: { tenant_id: tenant.id }
      });
      console.log(`   ✅ Cancellati ${skills.count} employee_skills`);

      // Cancella employee_roles
      const roles = await tx.employee_roles.deleteMany({
        where: { tenant_id: tenant.id }
      });
      console.log(`   ✅ Cancellati ${roles.count} employee_roles`);

      // Cancella project_assignments
      const projects = await tx.project_assignments.deleteMany({
        where: { tenant_id: tenant.id }
      });
      console.log(`   ✅ Cancellati ${projects.count} project_assignments`);

      // Cancella tenant_users (questo cancellerà anche employees grazie al CASCADE)
      const users = await tx.tenant_users.deleteMany({
        where: { tenant_id: tenant.id }
      });
      console.log(`   ✅ Cancellati ${users.count} tenant_users`);

      // Cancella employees rimasti (quelli senza tenant_users)
      const employees = await tx.employees.deleteMany({
        where: { tenant_id: tenant.id }
      });
      console.log(`   ✅ Cancellati ${employees.count} employees residui`);

      return { users: users.count, employees: employees.count };
    });

    // 4. Verifica cancellazione
    const usersAfter = await prisma.tenant_users.count({
      where: { tenant_id: tenant.id }
    });

    const employeesAfter = await prisma.employees.count({
      where: { tenant_id: tenant.id }
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ CANCELLAZIONE COMPLETATA');
    console.log('='.repeat(50));
    console.log(`\n📊 Risultato finale:`);
    console.log(`   - Utenti rimasti: ${usersAfter} (prima: ${usersBefore})`);
    console.log(`   - Dipendenti rimasti: ${employeesAfter} (prima: ${employeesBefore})`);

    if (usersAfter === 0 && employeesAfter === 0) {
      console.log('\n🎉 Database pronto per nuovo import!');
    }

  } catch (error) {
    console.error('\n❌ Errore durante cancellazione:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui con conferma
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  ATTENZIONE: Questa operazione cancellerà TUTTI gli utenti Nexa Data!');
readline.question('Sei sicuro di voler procedere? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    deleteNexaUsers().then(() => {
      readline.close();
    });
  } else {
    console.log('❌ Operazione annullata');
    readline.close();
  }
});