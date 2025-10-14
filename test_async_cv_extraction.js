/**
 * Test Async CV Extraction with Background Worker
 * Tests the new database queue solution
 * Date: 14 October 2025, 18:25
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const API_URL = 'http://localhost:3000/api';
const CV_PATH = '/home/mgiurelli/sviluppo/moobee/cv_samples/Europass-CV-Flavio-Prosperi.pdf';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAsyncCVExtraction() {
  let extractionId = null;
  let employeeId = null;
  let authToken = null;

  try {
    console.log('🧪 Starting Async CV Extraction Test\n');

    // Step 0: Login to get auth token
    console.log('0️⃣  Logging in...');
    try {
      const loginResponse = await axios.post(`${API_URL}/unified/login`, {
        email: 'hr@acme.com',  // HR user from tenant ABC123
        password: 'Test1234!'
      });
      authToken = loginResponse.data.access_token;
      console.log(`✅ Logged in successfully\n`);
    } catch (loginError) {
      console.log('⚠️  Login failed, trying to use tenant user directly...');
      // Use a known tenant user
      const tenantUser = await prisma.tenant_users.findFirst({
        where: { tenant_id: '018cdf07-f23b-7e29-a912-e75f40c67dd6' }
      });
      if (tenantUser) {
        console.log(`   Using tenant user: ${tenantUser.email}\n`);
      }
    }

    // Step 1: Create test employee directly in database (no auth needed)
    console.log('1️⃣  Creating test employee...');
    const employee = await prisma.employees.create({
      data: {
        first_name: 'Test',
        last_name: 'AsyncCV',
        email: `test.asynccv.${Date.now()}@example.com`,
        tenant_id: '018cdf07-f23b-7e29-a912-e75f40c67dd6'  // Tenant ABC123
      }
    });
    employeeId = employee.id;
    console.log(`✅ Employee created: ID ${employeeId}\n`);

    // Step 2: Upload CV using NEW async endpoint
    console.log('2️⃣  Uploading CV (async endpoint)...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(CV_PATH));
    formData.append('employee_id', employeeId);

    const uploadResponse = await axios.post(`${API_URL}/cv/extract-mvp`, formData, {
      headers: {
        ...formData.getHeaders(),
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
    });

    extractionId = uploadResponse.data.extraction_id;
    console.log(`✅ CV uploaded successfully`);
    console.log(`   Extraction ID: ${extractionId}`);
    console.log(`   Status: ${uploadResponse.data.status}\n`);

    // Step 3: Poll for completion
    console.log('3️⃣  Polling for status changes...\n');

    let status = 'pending';
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes max (10s interval)

    while (status !== 'completed' && status !== 'failed' && pollCount < maxPolls) {
      await sleep(10000); // Poll every 10 seconds
      pollCount++;

      const statusResponse = await axios.get(`${API_URL}/cv/extraction-status/${extractionId}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      const newStatus = statusResponse.data.status;

      if (newStatus !== status) {
        status = newStatus;
        const elapsed = statusResponse.data.elapsed_time || 0;
        console.log(`   [${elapsed}s] Status: ${status.toUpperCase()}`);

        if (status === 'processing') {
          console.log('      → Python is extracting data from CV...');
        } else if (status === 'extracted') {
          console.log('      → Python completed! Data written to database.');
          console.log('      → Waiting for background worker to import...');
        } else if (status === 'importing') {
          console.log('      → Background worker is importing data to tables...');
        }
      }
    }

    console.log('');

    // Step 4: Verify results
    if (status === 'completed') {
      console.log('4️⃣  Verifying imported data...\n');

      // Get extraction record
      const extraction = await prisma.cv_extractions.findUnique({
        where: { id: extractionId }
      });

      console.log(`✅ Extraction completed in ${extraction.processing_time_seconds}s`);
      console.log(`   LLM Tokens: ${extraction.llm_tokens_used || 0}`);
      console.log(`   LLM Cost: $${extraction.llm_cost || 0}`);
      console.log(`   Retry Count: ${extraction.retry_count || 0}\n`);

      // Check imported data
      const skills = await prisma.employee_skills.count({
        where: { employee_id: employeeId }
      });

      const roles = await prisma.employee_roles.count({
        where: { employee_id: employeeId }
      });

      const education = await prisma.employee_education.count({
        where: { employee_id: employeeId }
      });

      const workExp = await prisma.employee_work_experiences.count({
        where: { employee_id: employeeId }
      });

      console.log('📊 Imported Data Summary:');
      console.log(`   Skills: ${skills}`);
      console.log(`   Roles: ${roles}`);
      console.log(`   Education: ${education}`);
      console.log(`   Work Experiences: ${workExp}\n`);

      if (extraction.import_stats) {
        console.log('📋 Import Stats:', JSON.stringify(extraction.import_stats, null, 2));
      }

      console.log('\n✅ TEST PASSED: Async CV extraction completed successfully!\n');

    } else if (status === 'failed') {
      const extraction = await prisma.cv_extractions.findUnique({
        where: { id: extractionId }
      });

      console.log('❌ TEST FAILED: Extraction failed');
      console.log(`   Error: ${extraction.error_message}`);
      console.log(`   Phase: ${extraction.error_phase}`);
      console.log(`   Retry Count: ${extraction.retry_count || 0}\n`);

    } else {
      console.log(`⏰ TEST TIMEOUT: Status still '${status}' after ${pollCount * 10}s\n`);
    }

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  } finally {
    // Cleanup: Delete test employee
    if (employeeId) {
      try {
        await prisma.employee_skills.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_roles.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_education.deleteMany({ where: { employee_id: employeeId } });
        await prisma.employee_work_experiences.deleteMany({ where: { employee_id: employeeId } });
        if (extractionId) {
          await prisma.cv_extractions.delete({ where: { id: extractionId } });
        }
        await prisma.employees.delete({ where: { id: employeeId } });
        console.log('🧹 Test employee and data cleaned up\n');
      } catch (cleanupError) {
        console.error('⚠️  Cleanup error:', cleanupError.message);
      }
    }

    await prisma.$disconnect();
  }
}

testAsyncCVExtraction();
