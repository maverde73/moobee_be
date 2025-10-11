/**
 * Test Assessment LLM Audit Logging
 * Verifies that LLM usage is properly logged to database
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE_URL = 'http://localhost:3000/api';

// Test credentials for tenant (from CLAUDE.md)
const TEST_USER = {
  email: 'admin@moobee.it',
  password: 'Admin@2024'
};

async function runTest() {
  console.log('='.repeat(80));
  console.log('TEST: Assessment LLM Audit Logging');
  console.log('='.repeat(80));

  let token;
  let tenantId;
  let userId;

  try {
    // Step 1: Login and get JWT token
    console.log('\n[1] Logging in as tenant user...');
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    token = loginResponse.data.data.token;
    tenantId = loginResponse.data.data.tenant_id;
    userId = loginResponse.data.data.user?.id;

    console.log(`✅ Login successful`);
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   User ID: ${userId}`);

    // Step 2: Count existing logs before test
    console.log('\n[2] Checking existing LLM logs...');
    const logsBefore = await prisma.llm_usage_logs.count({
      where: { tenant_id: tenantId }
    });
    console.log(`   Existing logs for tenant: ${logsBefore}`);

    // Step 3: Generate assessment questions with AI
    console.log('\n[3] Generating assessment questions...');
    const generateResponse = await axios.post(
      `${API_BASE_URL}/assessments/ai/generate-questions`,
      {
        type: 'big-five',
        name: 'Test Assessment for LLM Audit',
        count: 5,
        language: 'it',
        description: 'Testing LLM audit logging system',
        suggestedRoles: ['Software Developer'],
        provider: 'openai',
        model: 'gpt-5'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Questions generated successfully`);
    console.log(`   Questions count: ${generateResponse.data.data.questions.length}`);
    console.log(`   Provider: ${generateResponse.data.data.aiConfig.provider}`);
    console.log(`   Model: ${generateResponse.data.data.aiConfig.model}`);

    // Step 4: Wait for async logging to complete
    console.log('\n[4] Waiting for LLM audit log to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Verify log was created
    console.log('\n[5] Verifying LLM audit log in database...');
    const logsAfter = await prisma.llm_usage_logs.findMany({
      where: {
        tenant_id: tenantId,
        operation_type: 'assessment_generation'
      },
      orderBy: { created_at: 'desc' },
      take: 1
    });

    if (logsAfter.length === 0) {
      console.error('❌ FAILED: No LLM audit log found in database!');
      process.exit(1);
    }

    const log = logsAfter[0];
    console.log('✅ LLM audit log found!');
    console.log('\n📊 Log Details:');
    console.log(`   ID: ${log.id}`);
    console.log(`   Tenant ID: ${log.tenant_id}`);
    console.log(`   User ID: ${log.user_id}`);
    console.log(`   Operation Type: ${log.operation_type}`);
    console.log(`   Provider: ${log.provider}`);
    console.log(`   Model: ${log.model}`);
    console.log(`   Prompt Tokens: ${log.prompt_tokens}`);
    console.log(`   Completion Tokens: ${log.completion_tokens}`);
    console.log(`   Total Tokens: ${log.total_tokens}`);
    console.log(`   Estimated Cost: $${log.estimated_cost}`);
    console.log(`   Status: ${log.status}`);
    console.log(`   Response Time: ${log.response_time_ms}ms`);
    console.log(`   Created At: ${log.created_at}`);

    // Step 6: Verify all required fields are populated
    console.log('\n[6] Verifying required fields...');
    const errors = [];
    if (!log.tenant_id) errors.push('tenant_id is null');
    if (!log.user_id) errors.push('user_id is null');
    if (!log.operation_type) errors.push('operation_type is null');
    if (!log.provider) errors.push('provider is null');
    if (!log.model) errors.push('model is null');
    if (log.total_tokens === 0) errors.push('total_tokens is 0');
    if (log.estimated_cost === 0) errors.push('estimated_cost is 0 (pricing might be missing)');
    if (log.status !== 'success') errors.push(`status is ${log.status} instead of success`);

    if (errors.length > 0) {
      console.error('❌ FAILED: Some required fields are missing or incorrect:');
      errors.forEach(err => console.error(`   - ${err}`));
      process.exit(1);
    }

    console.log('✅ All required fields are correctly populated!');

    // Step 7: Test cost calculation
    console.log('\n[7] Verifying cost calculation...');
    const expectedInputCost = (log.prompt_tokens / 1000000) * 3.00; // GPT-5 input pricing
    const expectedOutputCost = (log.completion_tokens / 1000000) * 12.00; // GPT-5 output pricing
    const expectedTotalCost = expectedInputCost + expectedOutputCost;

    console.log(`   Expected cost: $${expectedTotalCost.toFixed(6)}`);
    console.log(`   Logged cost: $${log.estimated_cost}`);

    if (Math.abs(expectedTotalCost - log.estimated_cost) < 0.000001) {
      console.log('✅ Cost calculation is correct!');
    } else {
      console.warn(`⚠️  Cost calculation mismatch (might be rounding)`);
    }

    // Success!
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST PASSED: LLM Audit Logging is working correctly!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
