const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplate() {
  try {
    const template = await prisma.assessment_templates.findUnique({
      where: { id: 102 },
      select: {
        id: true,
        name: true,
        type: true,
        job_family_id: true,
        assessment_template_soft_skill: {
          select: {
            softSkillId: true,
            soft_skills: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log('Template 102:', JSON.stringify(template, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplate();
