const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  // Get test employee
  const employee = await prisma.employees.findFirst({
    where: { is_active: true }
  });

  console.log('\n📊 Employee Data:');
  console.log('ID:', employee.id, typeof employee.id);
  console.log('tenant_id:', employee.tenant_id, typeof employee.tenant_id);

  // Test raw query with explicit casting
  console.log('\n🧪 Test INSERT with explicit TEXT cast...');
  try {
    await prisma.$executeRaw`
      INSERT INTO employee_certifications (employee_id, certification_name, issuing_organization, tenant_id)
      VALUES (${employee.id}, 'TEST TRIGGER DEBUG', 'Test Org', ${employee.tenant_id}::TEXT)
    `;
    console.log('✅ SUCCESS: Explicit cast works');
  } catch (error) {
    console.error('❌ FAIL:', error.message.split('\n')[0]);
  }

  // Check if it was inserted
  const cert = await prisma.$queryRaw`
    SELECT id, employee_id, tenant_id, certification_name
    FROM employee_certifications
    WHERE certification_name = 'TEST TRIGGER DEBUG'
    LIMIT 1
  `;

  if (cert.length > 0) {
    console.log('\n✓ Inserted record:');
    console.log('  tenant_id:', cert[0].tenant_id, typeof cert[0].tenant_id);
    console.log('  Match:', cert[0].tenant_id === employee.tenant_id);

    // Cleanup
    await prisma.$executeRaw`
      DELETE FROM employee_certifications WHERE certification_name = 'TEST TRIGGER DEBUG'
    `;
  }

  await prisma.$disconnect();
}

debug();
