const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEmployeeMapping() {
  console.log('=== VERIFICA MAPPING TENANT_USERS → EMPLOYEES ===\n');

  try {
    // 1. Conta tenant_users totali
    const totalTenantUsers = await prisma.tenant_users.count();
    console.log(`📊 Total tenant_users: ${totalTenantUsers}`);

    // 2. Conta employees totali
    const totalEmployees = await prisma.employees.count();
    console.log(`📊 Total employees: ${totalEmployees}`);

    // 3. Trova tenant_users usati negli assignments
    const usedInEngagement = await prisma.$queryRaw`
      SELECT DISTINCT employee_id as tenant_user_id
      FROM engagement_campaign_assignments
    `;

    const usedInAssessment = await prisma.$queryRaw`
      SELECT DISTINCT employee_id as tenant_user_id
      FROM assessment_campaign_assignments
    `;

    // Combina e rimuovi duplicati
    const allUsedIds = new Set([
      ...usedInEngagement.map(r => r.tenant_user_id),
      ...usedInAssessment.map(r => r.tenant_user_id)
    ]);

    console.log(`\n📌 Tenant users used in assignments: ${allUsedIds.size}`);
    console.log(`  - In engagement campaigns: ${usedInEngagement.length}`);
    console.log(`  - In assessment campaigns: ${usedInAssessment.length}`);

    // 4. Verifica mapping per ogni tenant_user usato
    const missingEmployees = [];
    const mappedEmployees = [];

    for (const tenantUserId of allUsedIds) {
      const tenantUser = await prisma.tenant_users.findUnique({
        where: { id: tenantUserId }
      });

      if (!tenantUser) {
        console.log(`⚠️  Tenant user not found: ${tenantUserId}`);
        continue;
      }

      const employee = await prisma.employees.findFirst({
        where: {
          email: tenantUser.email,
          tenant_id: tenantUser.tenant_id
        }
      });

      if (employee) {
        mappedEmployees.push({
          tenant_user_id: tenantUser.id,
          employee_id: employee.id,
          email: tenantUser.email
        });
      } else {
        missingEmployees.push({
          tenant_user_id: tenantUser.id,
          email: tenantUser.email,
          tenant_id: tenantUser.tenant_id
        });
      }
    }

    // 5. Report risultati
    console.log('\n=== RISULTATI MAPPING ===');
    console.log(`✅ Mapped correctly: ${mappedEmployees.length}`);
    console.log(`❌ Missing employees: ${missingEmployees.length}`);

    if (missingEmployees.length > 0) {
      console.log('\n⚠️  TENANT USERS SENZA EMPLOYEE:');
      missingEmployees.forEach(m => {
        console.log(`  - ${m.email} (ID: ${m.tenant_user_id})`);
      });

      // Salva lista per creazione automatica
      const fs = require('fs').promises;
      await fs.writeFile(
        'missing-employees.json',
        JSON.stringify(missingEmployees, null, 2)
      );
      console.log('\n📝 Lista salvata in missing-employees.json');
    }

    // 6. Check duplicati employees
    const duplicates = await prisma.$queryRaw`
      SELECT email, tenant_id, COUNT(*) as count
      FROM employees
      GROUP BY email, tenant_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log('\n⚠️  DUPLICATI TROVATI:');
      duplicates.forEach(d => {
        console.log(`  - ${d.email} in tenant ${d.tenant_id}: ${d.count} copie`);
      });
    } else {
      console.log('\n✅ Nessun duplicato employees trovato');
    }

    // 7. Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total assignments affected: ${allUsedIds.size}`);
    console.log(`Ready for migration: ${mappedEmployees.length}`);
    console.log(`Need employee creation: ${missingEmployees.length}`);
    console.log(`Success rate: ${(mappedEmployees.length / allUsedIds.size * 100).toFixed(1)}%`);

    return {
      totalUsed: allUsedIds.size,
      mapped: mappedEmployees.length,
      missing: missingEmployees.length,
      missingList: missingEmployees
    };

  } catch (error) {
    console.error('❌ Error during mapping check:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui
checkEmployeeMapping()
  .then(results => {
    if (results.missing > 0) {
      console.log('\n⚠️  ACTION REQUIRED: Run create-missing-employees.js');
      process.exit(1);
    } else {
      console.log('\n✅ All mappings OK! Ready for migration.');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });