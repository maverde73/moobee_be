const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAssessmentFix() {
  console.log('🔍 Testing Assessment Fix - Skill ID Mapping');
  console.log('='.repeat(60));

  try {
    // 1. Check React skill in skills table
    console.log('\n1️⃣ Checking React in skills master table:');
    const reactSkill = await prisma.skills.findFirst({
      where: {
        OR: [
          { Skill: { contains: 'React', mode: 'insensitive' } },
          { NameKnown_Skill: { contains: 'React', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        Skill: true,
        NameKnown_Skill: true
      }
    });

    if (reactSkill) {
      console.log(`   ✅ React found: ID ${reactSkill.id} - "${reactSkill.NameKnown_Skill || reactSkill.Skill}"`);
    } else {
      console.log('   ❌ React NOT found in skills table');
      return;
    }

    // 2. Check if there are any employee_skills records for employee 91
    console.log('\n2️⃣ Checking employee_skills for employee_id=91:');
    const employeeSkills = await prisma.employee_skills.findMany({
      where: { employee_id: 91 },
      select: {
        id: true,
        skill_id: true,
        proficiency_level: true,
        source: true
      },
      orderBy: { id: 'desc' },
      take: 5
    });

    if (employeeSkills.length > 0) {
      console.log(`   Found ${employeeSkills.length} employee_skills records (showing last 5):`);
      employeeSkills.forEach(es => {
        console.log(`   - employee_skills.id=${es.id}, skill_id=${es.skill_id}, level=${es.proficiency_level}, source=${es.source}`);
      });
    } else {
      console.log('   No employee_skills records found for employee 91');
    }

    // 3. Simulate the GET /api/employees/:id/skills response
    console.log('\n3️⃣ Simulating GET /api/employees/91/skills response:');

    const hardSkillsRaw = await prisma.$queryRaw`
      SELECT
        es.id,
        es.skill_id,
        COALESCE(s."NameKnown_Skill", s."Skill") as name_known_skill,
        s."Skill" as skill_name,
        es.proficiency_level,
        es.source
      FROM employee_skills es
      INNER JOIN skills s ON es.skill_id = s.id
      WHERE es.employee_id = 91
      LIMIT 5
    `;

    if (hardSkillsRaw.length > 0) {
      console.log(`   API would return ${hardSkillsRaw.length} skills (showing first 5):`);
      hardSkillsRaw.forEach(skill => {
        console.log(`   - {id: "${skill.id}", skill_id: ${skill.skill_id}, name: "${skill.name_known_skill || skill.skill_name}"}`);
      });

      console.log('\n   ⚠️  Frontend SHOULD use skill_id, NOT id!');
      console.log(`   - WRONG: id: hardSkill.id → would use employee_skills.id (${hardSkillsRaw[0].id})`);
      console.log(`   - CORRECT: id: hardSkill.skill_id → uses skills.id (${hardSkillsRaw[0].skill_id})`);
    } else {
      console.log('   No skills found');
    }

    // 4. Verify what skill_id 288 actually is
    console.log('\n4️⃣ Checking what skill_id 288 is (the wrong ID that was being saved):');
    const wrongSkill = await prisma.skills.findUnique({
      where: { id: 288 },
      select: {
        id: true,
        Skill: true,
        NameKnown_Skill: true
      }
    });

    if (wrongSkill) {
      console.log(`   ❌ ID 288 = "${wrongSkill.NameKnown_Skill || wrongSkill.Skill}"`);
      console.log('   This confirms the bug: employee_skills.id was being used instead of skill_id');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Fix Applied:');
    console.log('   File: FE_moobee/src/pages/Employee/HardSkillsAssessment/index.tsx');
    console.log('   Line 44: id: hardSkill.skill_id?.toString() || hardSkill.id');
    console.log('\n   This ensures the assessment uses the CORRECT skill_id from');
    console.log('   the skills master table, not the employee_skills junction table ID');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAssessmentFix();
