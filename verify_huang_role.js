const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRole() {
  try {
    const roleRecord = await prisma.employee_roles.findFirst({
      where: { employee_id: 80 },
      include: {
        employees: {
          select: { first_name: true, last_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    if (roleRecord) {
      console.log('\n✅ Role found in database:');
      console.log(`   Employee: ${roleRecord.employees.first_name} ${roleRecord.employees.last_name}`);
      console.log(`   Role ID: ${roleRecord.role_id}`);
      console.log(`   Sub-Role ID: ${roleRecord.sub_role_id}`);
      console.log(`   Years Experience: ${roleRecord.anni_esperienza}`);
      console.log(`   Seniority: ${roleRecord.seniority}`);
      console.log(`   Created: ${roleRecord.created_at}\n`);
    } else {
      console.log('\n❌ No role found for employee_id 80\n');
    }

    // Check skills
    const skills = await prisma.employee_skills.findMany({
      where: { employee_id: 80 },
      select: { skill_id: true }
    });

    console.log(`\n📊 Skills count: ${skills.length}\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRole();
