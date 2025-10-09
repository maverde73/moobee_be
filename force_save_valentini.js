const CVDataSaveService = require('./src/services/cvDataSaveService');

async function forceSave() {
  const extractionId = 'a45e3c52-f4f1-4ee3-87d4-6af0db48216d';

  console.log(`\n🔄 Forcing save for extraction: ${extractionId}\n`);

  try {
    const result = await CVDataSaveService.saveExtractedDataToTables(extractionId);

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

  process.exit(0);
}

forceSave();
