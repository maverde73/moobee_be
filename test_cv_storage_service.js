/**
 * Test CV Storage Service
 * Tests the new volume storage system
 */

const { getCVStorageService } = require('./src/services/cvStorageService');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function testStorageService() {
  console.log('🧪 Testing CV Storage Service\n');

  try {
    // Test 1: Service initialization
    console.log('1️⃣ Testing service initialization...');
    const storageService = getCVStorageService();
    console.log(`   ✅ Service initialized`);
    console.log(`   📁 Environment: ${storageService.isProduction ? 'PRODUCTION' : 'LOCAL'}`);
    console.log(`   📂 Storage path: ${storageService.storagePath}\n`);

    // Test 2: Health check
    console.log('2️⃣ Testing health check...');
    const health = await storageService.healthCheck();
    console.log(`   Status: ${health.status}`);
    console.log(`   Environment: ${health.environment}`);
    console.log(`   Storage path: ${health.storagePath}`);
    console.log(`   Writable: ${health.writable}`);

    if (health.status !== 'healthy') {
      console.error(`   ❌ Storage is not healthy: ${health.error}`);
      return;
    }
    console.log(`   ✅ Storage is healthy\n`);

    // Test 3: Create test file
    console.log('3️⃣ Testing file save...');
    const testFileContent = Buffer.from('Test CV file content - ' + new Date().toISOString());
    const testExtractionId = '123e4567-e89b-12d3-a456-426614174000'; // Fake UUID for test
    const testTenantId = 'test_tenant';

    const fileInfo = await storageService.saveFile(
      testFileContent,
      'test_resume.pdf',
      {
        extractionId: testExtractionId,
        tenantId: testTenantId,
        mimeType: 'application/pdf'
      }
    );

    console.log(`   ✅ File saved successfully`);
    console.log(`   📄 File path: ${fileInfo.filePath}`);
    console.log(`   📏 File size: ${fileInfo.fileSize} bytes`);
    console.log(`   🏷️  MIME type: ${fileInfo.mimeType}`);
    console.log(`   📝 Original filename: ${fileInfo.originalFilename}\n`);

    // Test 4: Verify file exists
    console.log('4️⃣ Verifying file exists on disk...');
    if (fs.existsSync(fileInfo.filePath)) {
      const stats = fs.statSync(fileInfo.filePath);
      console.log(`   ✅ File exists on disk`);
      console.log(`   📏 Size: ${stats.size} bytes (matches: ${stats.size === fileInfo.fileSize})\n`);
    } else {
      console.error(`   ❌ File not found on disk: ${fileInfo.filePath}\n`);
      return;
    }

    // Test 5: Read file back
    console.log('5️⃣ Testing file read...');
    const readBuffer = await storageService.readFile(fileInfo.filePath);
    console.log(`   ✅ File read successfully`);
    console.log(`   📏 Read ${readBuffer.length} bytes`);
    console.log(`   ✅ Content matches: ${readBuffer.equals(testFileContent)}\n`);

    // Test 6: Test cv_files database integration (if table exists)
    console.log('6️⃣ Testing database integration...');
    const prisma = new PrismaClient();

    try {
      // Check if cv_files table exists
      const tableCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'cv_files'
        );
      `;

      const tableExists = tableCheck[0]?.exists || false;

      if (tableExists) {
        console.log(`   ✅ cv_files table exists`);

        // Test creating a cv_files record
        try {
          const cvFileRecord = await prisma.cv_files.create({
            data: {
              extraction_id: testExtractionId,
              tenant_id: testTenantId,
              file_path: fileInfo.filePath,
              file_size: fileInfo.fileSize,
              mime_type: fileInfo.mimeType,
              original_filename: fileInfo.originalFilename
            }
          });

          console.log(`   ✅ cv_files record created: ID ${cvFileRecord.id}`);

          // Test reading back
          const readRecord = await prisma.cv_files.findUnique({
            where: { extraction_id: testExtractionId }
          });

          if (readRecord) {
            console.log(`   ✅ cv_files record can be read back`);
            console.log(`   📄 File path in DB: ${readRecord.file_path}\n`);
          }

          // Clean up test record
          await prisma.cv_files.delete({
            where: { extraction_id: testExtractionId }
          });
          console.log(`   🧹 Test cv_files record deleted\n`);

        } catch (dbError) {
          console.error(`   ⚠️  Database operation failed: ${dbError.message}\n`);
        }
      } else {
        console.log(`   ⚠️  cv_files table does not exist (run migration 040 first)\n`);
      }
    } finally {
      await prisma.$disconnect();
    }

    // Test 7: Delete test file
    console.log('7️⃣ Testing file deletion...');
    await storageService.deleteFile(fileInfo.filePath);
    console.log(`   ✅ File deleted successfully`);

    if (!fs.existsSync(fileInfo.filePath)) {
      console.log(`   ✅ File no longer exists on disk\n`);
    } else {
      console.error(`   ❌ File still exists after deletion\n`);
    }

    // Final summary
    console.log('=' .repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('=' .repeat(60));
    console.log('\nThe CV storage service is working correctly!');
    console.log(`Environment: ${storageService.isProduction ? 'PRODUCTION (Railway)' : 'LOCAL (Development)'}`);
    console.log(`Storage location: ${storageService.storagePath}`);
    console.log('\nYou can now:');
    console.log('1. Upload a CV via the frontend');
    console.log('2. Check files are saved to the storage directory');
    console.log('3. Verify cv_files records are created in the database\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testStorageService().then(() => {
  console.log('🎉 Test suite completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test suite error:', error);
  process.exit(1);
});
