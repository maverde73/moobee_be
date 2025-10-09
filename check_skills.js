const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSkills() {
  console.log('🔍 Checking Skills IDs in Database');
  console.log('='.repeat(60));

  try {
    // Check React, Next.js, TypeScript IDs (skills from CV)
    const cvSkills = ['React', 'Nextjs', 'Next.js', 'TypeScript', 'Typescript', 'Java', 'HTML', 'CSS', 'Bootstrap'];

    for (const skillName of cvSkills) {
      const skills = await prisma.skills.findMany({
        where: {
          OR: [
            { Skill: { contains: skillName, mode: 'insensitive' } },
            { NameKnown_Skill: { contains: skillName, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          Skill: true,
          NameKnown_Skill: true
        },
        take: 3
      });

      if (skills.length > 0) {
        console.log(`\n✅ "${skillName}" found:`);
        skills.forEach(s => {
          console.log(`   ID ${s.id}: ${s.Skill} (Known: ${s.NameKnown_Skill || 'N/A'})`);
        });
      } else {
        console.log(`\n❌ "${skillName}" NOT FOUND`);
      }
    }

    // Check what skills have IDs 288, 278, 298 (the wrong IDs from employee_skills)
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Checking Wrong IDs from employee_skills table:');
    console.log('='.repeat(60));

    const wrongIds = [288, 278, 298, 285, 284, 280, 279, 286, 281, 294, 283, 276, 277];

    for (const id of wrongIds) {
      const skill = await prisma.skills.findUnique({
        where: { id },
        select: {
          id: true,
          Skill: true,
          NameKnown_Skill: true
        }
      });

      if (skill) {
        console.log(`ID ${id}: ${skill.Skill} (Known: ${skill.NameKnown_Skill || 'N/A'})`);
      } else {
        console.log(`ID ${id}: ❌ NOT FOUND`);
      }
    }

    // Count total skills
    console.log('\n' + '='.repeat(60));
    const total = await prisma.skills.count();
    console.log(`📊 Total skills in database: ${total}`);

    // Get ID range
    const minMax = await prisma.$queryRaw`
      SELECT MIN(id) as min_id, MAX(id) as max_id
      FROM skills
    `;
    console.log(`📈 ID Range: ${minMax[0].min_id} - ${minMax[0].max_id}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSkills();
