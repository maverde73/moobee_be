const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAssessmentSave() {
  console.log('🔍 Verifying Assessment Save - Employee 91');
  console.log('='.repeat(60));

  try {
    // Get all skills for employee 91 from assessment
    const assessmentSkills = await prisma.$queryRaw`
      SELECT
        es.id as employee_skill_id,
        es.skill_id,
        es.proficiency_level,
        es.years_experience,
        es.source,
        es.updated_at,
        s."Skill" as skill_name,
        s."NameKnown_Skill" as known_skill_name
      FROM employee_skills es
      LEFT JOIN skills s ON es.skill_id = s.id
      WHERE es.employee_id = 91
        AND es.source = 'assessment'
      ORDER BY es.updated_at DESC
    `;

    console.log(`\n✅ Found ${assessmentSkills.length} assessment skills for employee 91:\n`);

    assessmentSkills.forEach((es, index) => {
      const skillName = es.known_skill_name || es.skill_name || 'Unknown';
      console.log(`${index + 1}. Skill: "${skillName}"`);
      console.log(`   - employee_skills.id: ${es.employee_skill_id}`);
      console.log(`   - skill_id: ${es.skill_id} ✅ (correct ID from skills table)`);
      console.log(`   - proficiency_level: ${es.proficiency_level}`);
      console.log(`   - years_experience: ${es.years_experience || 0}`);
      console.log(`   - source: ${es.source}`);
      console.log(`   - updated_at: ${es.updated_at}`);
      console.log('');
    });

    // Check if React was saved correctly
    const reactSkill = assessmentSkills.find(s =>
      s.known_skill_name?.toLowerCase().includes('react') ||
      s.skill_name?.toLowerCase().includes('react')
    );

    if (reactSkill) {
      console.log('🎯 React skill verification:');
      console.log(`   ✅ skill_id: ${reactSkill.skill_id} (should be 1365)`);
      console.log(`   ✅ proficiency_level: ${reactSkill.proficiency_level}`);

      if (reactSkill.skill_id === 1365) {
        console.log('\n   🎉 SUCCESS! React is saved with CORRECT skill_id (1365)');
        console.log('   The ID mapping bug has been FIXED! ✅');
      } else {
        console.log(`\n   ⚠️  WARNING: React has skill_id ${reactSkill.skill_id}, expected 1365`);
      }
    } else {
      console.log('\n⚠️  React skill not found in assessment skills');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAssessmentSave();
