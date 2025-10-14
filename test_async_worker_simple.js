/**
 * Simple Test: Background Worker with Direct Python Call
 * Tests the worker by calling Python directly and verifying import
 * Date: 14 October 2025, 18:35
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PYTHON_URL = 'http://localhost:8001/api/v1/cv-analyzer';
const CV_PATH = '/home/mgiurelli/sviluppo/moobee/cv_samples/Europass-CV-Flavio-Prosperi.pdf';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWorkerFlow() {
  let extractionId = null;
  let employeeId = null;

  try {
    console.log('🧪 Testing Background Worker Flow\n');

    // Step 1: Create test employee
    console.log('1️⃣  Creating test employee...');
    const employee = await prisma.employees.create({
      data: {
        first_name: 'Test',
        last_name: 'Worker',
        email: `test.worker.${Date.now()}@example.com`,
        tenant_id: '018cdf07-f23b-7e29-a912-e75f40c67dd6'
      }
    });
    employeeId = employee.id;
    console.log(`✅ Employee created: ID ${employeeId}\n`);

    // Step 2: Create CV extraction record
    console.log('2️⃣  Creating CV extraction record...');
    const extraction = await prisma.cv_extractions.create({
      data: {
        tenant_id: '018cdf07-f23b-7e29-a912-e75f40c67dd6',
        employee_id: employeeId,
        original_filename: 'test-cv.pdf',
        status: 'pending'
      }
    });
    extractionId = extraction.id;
    console.log(`✅ Extraction record created: ${extractionId}\n`);

    // Step 3: Call Python async endpoint
    console.log('3️⃣  Calling Python async endpoint...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(CV_PATH));
    formData.append('extraction_id', extractionId);
    formData.append('parallel', 'true');
    formData.append('which', 'both');

    const pythonResponse = await axios.post(`${PYTHON_URL}/analyze-file-async`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer secret-shared-token-moobee-2025',
        'X-Request-ID': `test-${Date.now()}`,
        'X-Tenant-ID': '018cdf07-f23b-7e29-a912-e75f40c67dd6'
      },
      timeout: 30000
    });

    console.log(`✅ Python accepted job:`);
    console.log(`   Status: ${pythonResponse.data.status}`);
    console.log(`   Message: ${pythonResponse.data.message}\n`);

    // Step 4: Poll database for status changes
    console.log('4️⃣  Monitoring database for status changes...\n');

    let status = 'pending';
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes

    while (status !== 'completed' && status !== 'failed' && pollCount < maxPolls) {
      await sleep(5000); // Check every 5 seconds
      pollCount++;

      const currentExtraction = await prisma.cv_extractions.findUnique({
        where: { id: extractionId }
      });

      const newStatus = currentExtraction.status;

      if (newStatus !== status) {
        status = newStatus;
        const elapsed = Math.floor((new Date() - new Date(extraction.created_at)) / 1000);
        console.log(`   [${elapsed}s] Status: ${status.toUpperCase()}`);

        if (status === 'processing') {
          console.log('      ✓ Python background task started');
        } else if (status === 'extracted') {
          console.log('      ✓ Python completed extraction, data in database');
          console.log(`      ✓ Tokens used: ${currentExtraction.llm_tokens_used || 0}`);
          console.log(`      ✓ Cost: $${currentExtraction.llm_cost || 0}`);
          console.log('      → Waiting for Node.js worker to import...');
        } else if (status === 'importing') {
          console.log('      ✓ Node.js background worker started importing');
        }
      }
    }

    console.log('');

    // Step 5: Verify results
    if (status === 'completed') {
      console.log('5️⃣  Verifying imported data...\n');

      const finalExtraction = await prisma.cv_extractions.findUnique({
        where: { id: extractionId }
      });

      console.log(`✅ Extraction completed!`);
      console.log(`   Processing time: ${finalExtraction.processing_time_seconds}s`);
      console.log(`   LLM tokens: ${finalExtraction.llm_tokens_used || 0}`);
      console.log(`   LLM cost: $${finalExtraction.llm_cost || 0}`);
      console.log(`   Retry count: ${finalExtraction.retry_count || 0}\n`);

      // Check imported data
      const [skills, roles, education, workExp, languages] = await Promise.all([
        prisma.employee_skills.count({ where: { employee_id: employeeId } }),
        prisma.employee_roles.count({ where: { employee_id: employeeId } }),
        prisma.employee_education.count({ where: { employee_id: employeeId } }),
        prisma.employee_work_experiences.count({ where: { employee_id: employeeId } }),
        prisma.employee_languages.count({ where: { employee_id: employeeId } })
      ]);

      console.log('📊 Imported Data Summary:');
      console.log(`   Skills: ${skills}`);
      console.log(`   Roles: ${roles}`);
      console.log(`   Education: ${education}`);
      console.log(`   Work Experiences: ${workExp}`);
      console.log(`   Languages: ${languages}\n`);

      if (finalExtraction.import_stats) {
        console.log('📋 Import Stats:');
        console.log(JSON.stringify(finalExtraction.import_stats, null, 2));
      }

      console.log('\n✅ TEST PASSED: Background worker flow completed successfully!\n');

    } else if (status === 'failed') {
      const failedExtraction = await prisma.cv_extractions.findUnique({
        where: { id: extractionId }
      });

      console.log('❌ TEST FAILED: Extraction failed');
      console.log(`   Error: ${failedExtraction.error_message}`);
      console.log(`   Phase: ${failedExtraction.error_phase}`);
      console.log(`   Retry count: ${failedExtraction.retry_count || 0}\n`);

    } else {
      console.log(`⏰ TEST TIMEOUT: Status still '${status}' after ${pollCount * 5}s\n`);
    }

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
  } finally {
    // Cleanup
    if (employeeId) {
      try {
        console.log('🧹 Cleaning up test data...');
        await prisma.employee_skills.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_roles.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_education.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_work_experiences.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_languages.deleteMany({ where: { employee_id: employeeId } });
        if (extractionId) {
          await prisma.cv_extractions.delete({ where: { id: extractionId } }).catch(() => {});
        }
        await prisma.employees.delete({ where: { id: employeeId } });
        console.log('✅ Cleanup complete\n');
      } catch (cleanupError) {
        console.error('⚠️  Cleanup error:', cleanupError.message);
      }
    }

    await prisma.$disconnect();
  }
}

testWorkerFlow();
