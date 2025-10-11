const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLLMLogs() {
  try {
    console.log('🔍 Checking llm_usage_logs table...\n');

    // Check if table exists and get latest logs
    const logs = await prisma.$queryRaw`
      SELECT
        operation_type,
        provider,
        model,
        total_tokens,
        estimated_cost,
        status,
        created_at,
        tenant_id,
        user_id
      FROM llm_usage_logs
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (logs.length === 0) {
      console.log('❌ NO LOGS FOUND - Table is empty');
      console.log('\n📝 This confirms the bug: no LLM calls are being logged');
    } else {
      console.log(`✅ Found ${logs.length} recent logs:\n`);
      logs.forEach((log, i) => {
        console.log(`${i + 1}. ${log.operation_type} - ${log.provider}/${log.model}`);
        console.log(`   Tokens: ${log.total_tokens}, Cost: $${log.estimated_cost}`);
        console.log(`   Status: ${log.status}, Date: ${log.created_at}`);
        console.log(`   Tenant: ${log.tenant_id}, User: ${log.user_id}\n`);
      });
    }

    // Count total logs
    const count = await prisma.llm_usage_logs.count();
    console.log(`\n📊 Total LLM logs in database: ${count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLLMLogs();
