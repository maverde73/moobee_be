/**
 * Test Job Family Soft Skills Queries
 * Date: 2025-10-04 00:20
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testJobFamilySoftSkills() {
  try {
    console.log('\n🧪 Testing job_family_soft_skills queries...\n');

    // Test 1: Count all mappings
    const totalCount = await prisma.job_family_soft_skills.count();
    console.log(`✅ Total mappings: ${totalCount}`);

    // Test 2: Get all soft skills for "Developer / Engineer"
    const devSkills = await prisma.job_family_soft_skills.findMany({
      where: {
        job_family: {
          name: 'Developer / Engineer'
        }
      },
      include: {
        job_family: { select: { name: true } },
        soft_skills: { select: { name: true } }
      },
      orderBy: { priority: 'asc' }
    });

    console.log('\n📊 Developer / Engineer soft skills:');
    devSkills.forEach(m => {
      const required = m.is_required ? '✓ Required' : '○ Optional';
      console.log(`  ${m.priority}. ${m.soft_skills.name}`);
      console.log(`     ${required} | Weight: ${m.weight} | Target: ${m.target_score}/5 | Min: ${m.min_score}/5`);
    });

    // Test 3: Get all job families with their required skills count
    const jobFamilies = await prisma.job_family.findMany({
      include: {
        job_family_soft_skills: {
          where: { is_required: true }
        }
      }
    });

    console.log('\n📋 Job families with required skills count:');
    jobFamilies.forEach(jf => {
      console.log(`  ${jf.name}: ${jf.job_family_soft_skills.length} required skills`);
    });

    // Test 4: Find which job families need "Problem Solving Analitico"
    const problemSolvingSkill = await prisma.soft_skills.findFirst({
      where: { name: 'Problem Solving Analitico' }
    });

    if (problemSolvingSkill) {
      const familiesWithPS = await prisma.job_family_soft_skills.findMany({
        where: {
          soft_skill_id: problemSolvingSkill.id
        },
        include: {
          job_family: { select: { name: true } }
        },
        orderBy: {
          job_family: { name: 'asc' }
        }
      });

      console.log('\n🎯 Job families requiring "Problem Solving Analitico":');
      familiesWithPS.forEach(m => {
        console.log(`  - ${m.job_family.name} (priority: ${m.priority}, weight: ${m.weight})`);
      });
    }

    // Test 5: Get skills sorted by importance (weight) for Sales / Account
    const salesSkills = await prisma.job_family_soft_skills.findMany({
      where: {
        job_family: {
          name: 'Sales / Account'
        }
      },
      include: {
        soft_skills: { select: { name: true } }
      },
      orderBy: { weight: 'desc' }
    });

    console.log('\n💼 Sales / Account skills by importance (weight):');
    salesSkills.forEach((m, idx) => {
      console.log(`  ${idx + 1}. ${m.soft_skills.name} - Weight: ${m.weight}`);
    });

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testJobFamilySoftSkills();
