/**
 * Direct Test of LLM Audit Service
 * Tests the singleton Prisma fix by directly calling the service
 */

const LLMAuditService = require('./src/services/llmAuditService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDirectLogging() {
  console.log('='.repeat(80));
  console.log('TEST: LLM Audit Service - Direct Database Write');
  console.log('='.repeat(80));

  try {
    // Use a real tenant_id from the database
    console.log('\n[1] Finding an existing tenant...');
    const tenant = await prisma.tenants.findFirst({
      select: { id: true, name: true }
    });

    if (!tenant) {
      console.error('❌ No tenants found in database');
      process.exit(1);
    }

    console.log(`✅ Using tenant: ${tenant.name} (${tenant.id})`);

    // Count logs before
    console.log('\n[2] Counting existing logs...');
    const logsBefore = await prisma.llm_usage_logs.count({
      where: { tenant_id: tenant.id }
    });
    console.log(`   Existing logs: ${logsBefore}`);

    // Test the service directly
    console.log('\n[3] Calling LLMAuditService.logUsage()...');
    const testData = {
      tenantId: tenant.id,
      operationType: 'test_operation',
      provider: 'openai',
      model: 'gpt-5',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      },
      status: 'success',
      responseTime: 1234,
      entityType: 'test',
      entityId: 'test-123',
      userId: null, // User might not exist
      metadata: { test: true }
    };

    console.log('   Test data:', JSON.stringify(testData, null, 2));

    const logEntry = await LLMAuditService.logUsage(testData);

    if (!logEntry) {
      console.error('❌ FAILED: logUsage() returned null');
      process.exit(1);
    }

    console.log('✅ logUsage() returned successfully');
    console.log(`   Log ID: ${logEntry.id}`);
    console.log(`   Estimated Cost: $${logEntry.estimated_cost}`);

    // Verify it's actually in the database
    console.log('\n[4] Verifying log was saved to database...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief wait

    const savedLog = await prisma.llm_usage_logs.findUnique({
      where: { id: logEntry.id }
    });

    if (!savedLog) {
      console.error('❌ FAILED: Log not found in database!');
      console.error('   Log ID searched:', logEntry.id);
      process.exit(1);
    }

    console.log('✅ Log verified in database!');
    console.log('\n📊 Saved Log Details:');
    console.log(`   ID: ${savedLog.id}`);
    console.log(`   Tenant ID: ${savedLog.tenant_id}`);
    console.log(`   Operation Type: ${savedLog.operation_type}`);
    console.log(`   Provider: ${savedLog.provider}`);
    console.log(`   Model: ${savedLog.model}`);
    console.log(`   Total Tokens: ${savedLog.total_tokens}`);
    console.log(`   Estimated Cost: $${savedLog.estimated_cost}`);
    console.log(`   Status: ${savedLog.status}`);
    console.log(`   Created At: ${savedLog.created_at}`);

    // Count logs after
    console.log('\n[5] Verifying log count increased...');
    const logsAfter = await prisma.llm_usage_logs.count({
      where: { tenant_id: tenant.id }
    });
    console.log(`   Logs after test: ${logsAfter}`);
    console.log(`   Increase: ${logsAfter - logsBefore}`);

    if (logsAfter !== logsBefore + 1) {
      console.error(`❌ FAILED: Expected ${logsBefore + 1} logs, found ${logsAfter}`);
      process.exit(1);
    }

    // Verify cost calculation
    console.log('\n[6] Verifying cost calculation...');
    const expectedInputCost = (100 / 1000000) * 3.00; // GPT-5 input pricing
    const expectedOutputCost = (50 / 1000000) * 12.00; // GPT-5 output pricing
    const expectedTotalCost = parseFloat((expectedInputCost + expectedOutputCost).toFixed(6));

    console.log(`   Expected: $${expectedTotalCost}`);
    console.log(`   Actual: $${savedLog.estimated_cost}`);

    if (Math.abs(expectedTotalCost - savedLog.estimated_cost) < 0.000001) {
      console.log('✅ Cost calculation is correct!');
    } else {
      console.warn('⚠️  Cost calculation mismatch');
    }

    // Success!
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST PASSED: Singleton Prisma fix is working!');
    console.log('   Records are successfully saved to the database.');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDirectLogging().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
