const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInsert() {
  const employee = await prisma.employees.findFirst({
    where: { email: 'chuang@nexadata.it' }
  });

  console.log('\n✓ Employee:', employee.id, employee.tenant_id);

  console.log('\n🧪 Testing manual skill insert...');

  try {
    const skill = await prisma.employee_skills.create({
      data: {
        employee_id: employee.id,
        skill_id: 225, // Bootstrap
        proficiency_level: 0,
        source: 'cv_extracted',
        cv_extractions: {
          connect: { id: 'e0ec36c4-1715-49dd-8a79-103aa037f079' }
        },
        tenants: {
          connect: { id: employee.tenant_id }
        }
      }
    });

    console.log('✅ Skill inserted successfully!');
    console.log('   ID:', skill.id);
    console.log('   tenant_id:', skill.tenant_id);
    console.log('   (populated by trigger)');

    // Cleanup
    await prisma.employee_skills.delete({ where: { id: skill.id } });
    console.log('\n✓ Test skill removed');

  } catch (error) {
    console.error('\n❌ INSERT FAILED:', error.message);
    if (error.code) console.error('   Error code:', error.code);
  }

  await prisma.$disconnect();
}

testInsert();
