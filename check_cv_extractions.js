const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExtractions() {
  try {
    const extractions = await prisma.cv_extractions.findMany({
      where: { status: 'completed' },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true,
        employee_id: true,
        original_filename: true,
        status: true,
        created_at: true
      }
    });

    console.log('📄 Available CV Extractions:');
    console.log('='.repeat(80));

    if (extractions.length === 0) {
      console.log('❌ No completed extractions found in database');
    } else {
      extractions.forEach((ext, idx) => {
        console.log(`\n${idx + 1}. ID: ${ext.id}`);
        console.log(`   Employee: ${ext.employee_id}`);
        console.log(`   File: ${ext.original_filename}`);
        console.log(`   Status: ${ext.status}`);
        console.log(`   Created: ${ext.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkExtractions();
