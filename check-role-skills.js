const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoleSoftSkills() {
  try {
    // Get roles with their soft skills
    const roles = await prisma.roles.findMany({
      where: {
        id: {
          in: [12, 22, 30]
        }
      },
      include: {
        role_soft_skills: {
          include: {
            soft_skills: true
          }
        }
      }
    });

    console.log('Roles with soft skills:');
    roles.forEach(role => {
      console.log(`\nRole ${role.id}: ${role.name}`);
      if (role.role_soft_skills && role.role_soft_skills.length > 0) {
        const skills = role.role_soft_skills.map(rs => rs.soft_skills?.name).filter(Boolean);
        console.log('  Associated Soft Skills:', skills);
      } else {
        console.log('  No soft skills associated');
      }
    });

    // Also check if there's assessment data with soft skills
    const assessment = await prisma.assessment_templates.findUnique({
      where: { id: 27 },
      include: {
        assessment_questions: true
      }
    });

    if (assessment) {
      console.log('\n\nAssessment Template 27:');
      console.log('Name:', assessment.name);
      console.log('Questions count:', assessment.assessment_questions?.length || 0);
      console.log('Suggested roles:', assessment.suggestedRoles);
      console.log('Target soft skills:', assessment.targetSoftSkillIds);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoleSoftSkills();