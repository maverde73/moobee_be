const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGradingValues() {
  try {
    console.log('=== Checking Grading values in skills_sub_roles_value ===');

    // Get top 10 highest grading values
    const topGrading = await prisma.skills_sub_roles_value.findMany({
      where: {
        Grading: { not: null }
      },
      orderBy: { Grading: 'desc' },
      take: 10,
      include: {
        skills: true,
        sub_roles: true
      }
    });

    console.log('\n📊 Top 10 Grading values:');
    topGrading.forEach((record, i) => {
      console.log(`${i+1}. Skill: ${record.skills?.Skill || 'Unknown'}`);
      console.log(`   Sub-role: ${record.sub_roles?.Name || 'Unknown'}`);
      console.log(`   Grading: ${record.Grading}`);
      console.log(`   Value: ${record.Value || 'null'}`);
      console.log('---');
    });

    // Get statistics
    const stats = await prisma.skills_sub_roles_value.aggregate({
      _avg: { Grading: true },
      _max: { Grading: true },
      _min: { Grading: true },
      _count: {
        Grading: true
      }
    });

    console.log('\n📈 Statistics:');
    console.log(`Total records with Grading: ${stats._count.Grading}`);
    console.log(`Average Grading: ${stats._avg.Grading?.toFixed(4) || 'N/A'}`);
    console.log(`Max Grading: ${stats._max.Grading || 'N/A'}`);
    console.log(`Min Grading: ${stats._min.Grading || 'N/A'}`);

    // Check for specific sub-role
    const subRoleId = 1; // Change this to test specific sub-role
    const subRoleSkills = await prisma.skills_sub_roles_value.findMany({
      where: { id_sub_role: subRoleId },
      orderBy: { Grading: 'desc' },
      take: 5,
      include: {
        skills: true
      }
    });

    console.log(`\n🔍 Top 5 skills for sub-role ${subRoleId}:`);
    subRoleSkills.forEach((record, i) => {
      console.log(`${i+1}. ${record.skills?.Skill}: Grading=${record.Grading || 0}, Value=${record.Value || 0}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGradingValues();