const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const extractions = await prisma.cv_extractions.findMany({
    where: { employee_id: 80 },
    orderBy: { created_at: 'desc' },
    take: 3,
    select: {
      id: true,
      status: true,
      created_at: true,
      extraction_result: true
    }
  });

  for (const ext of extractions) {
    console.log('\n=== Extraction', ext.id, '===');
    console.log('Status:', ext.status);
    console.log('Created:', ext.created_at);
    console.log('Has extraction_result:', !!ext.extraction_result);

    if (ext.extraction_result) {
      const result = ext.extraction_result;
      console.log('Personal info:', !!result.personal_info);
      console.log('Education count:', result.education?.length || 0);
      console.log('Work exp count:', result.work_experience?.length || 0);
    }

    // Check if data was saved
    const eduCount = await prisma.employee_education.count({
      where: {
        employee_id: 80,
        cv_extraction_id: ext.id
      }
    });
    console.log('Education records saved:', eduCount);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
