const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countAssessments() {
  try {
    const count = await prisma.assessmentTemplate.count();
    console.log('Total assessments in database:', count);

    const templates = await prisma.assessmentTemplate.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true
      }
    });

    console.log('\nAll templates:');
    templates.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name} (${t.type}) - Active: ${t.isActive}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countAssessments();