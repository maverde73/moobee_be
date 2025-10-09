const CVDataSaveService = require('./src/services/cvDataSaveService');

async function forceSave() {
  // Get the latest extraction for employee 80
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const extraction = await prisma.cv_extractions.findFirst({
    where: { employee_id: 80 },
    orderBy: { created_at: 'desc' }
  });
  
  if (!extraction) {
    console.log('❌ No extraction found for employee 80');
    process.exit(1);
  }
  
  console.log(`\n🔄 Forcing save for extraction: ${extraction.id}\n`);

  try {
    const result = await CVDataSaveService.saveExtractedDataToTables(extraction.id);

    if (result.success) {
      console.log('\n✅ Data saved successfully!');
      console.log('📊 Stats:', JSON.stringify(result.stats, null, 2));
    } else {
      console.error('\n❌ Failed to save data:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }

  await prisma.$disconnect();
  process.exit(0);
}

forceSave();
