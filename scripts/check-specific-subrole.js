const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubRole(subRoleId) {
  try {
    console.log(`\n=== Checking Sub-role ${subRoleId} ===`);

    // Get sub-role details
    const subRole = await prisma.sub_roles.findUnique({
      where: { id: parseInt(subRoleId) }
    });

    console.log(`Sub-role name: ${subRole?.Name || 'Not found'}`);

    // Get all skills for this sub-role
    const skills = await prisma.skills_sub_roles_value.findMany({
      where: { id_sub_role: parseInt(subRoleId) },
      orderBy: { Grading: 'desc' },
      include: {
        skills: true
      }
    });

    console.log(`\nTotal skills for this sub-role: ${skills.length}`);
    console.log(`Skills with Grading > 0: ${skills.filter(s => s.Grading > 0).length}`);
    console.log(`Skills with null Grading: ${skills.filter(s => s.Grading === null).length}`);

    console.log('\n📊 Top 10 skills by Grading:');
    skills.slice(0, 10).forEach((record, i) => {
      const grading = record.Grading !== null ? record.Grading.toFixed(4) : 'null';
      const value = record.Value !== null ? record.Value.toFixed(4) : 'null';
      console.log(`${i+1}. ${record.skills?.Skill || 'Unknown'}`);
      console.log(`   Grading: ${grading}, Value: ${value}`);
    });

    console.log('\n📉 Bottom 5 skills by Grading (excluding nulls):');
    const nonNullSkills = skills.filter(s => s.Grading !== null);
    nonNullSkills.slice(-5).forEach((record, i) => {
      const grading = record.Grading.toFixed(4);
      const value = record.Value !== null ? record.Value.toFixed(4) : 'null';
      console.log(`${nonNullSkills.length - 4 + i}. ${record.skills?.Skill || 'Unknown'}`);
      console.log(`   Grading: ${grading}, Value: ${value}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get sub-role ID from command line or use default
const subRoleId = process.argv[2] || 1;
checkSubRole(subRoleId);