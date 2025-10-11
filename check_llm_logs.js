const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLLMLogs() {
  try {
    // Check total logs
    const totalLogs = await prisma.llm_usage_logs.count();
    console.log(`\n📊 Total LLM logs in database: ${totalLogs}`);

    if (totalLogs > 0) {
      // Get latest logs
      const latestLogs = await prisma.llm_usage_logs.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          tenant_id: true,
          operation_type: true,
          total_tokens: true,
          estimated_cost: true,
          status: true,
          entity_type: true,
          entity_id: true,
          created_at: true
        }
      });

      console.log('\n📋 Latest 10 logs:\n');
      latestLogs.forEach(log => {
        console.log(`- ${log.operation_type}: ${log.total_tokens} tokens, $${log.estimated_cost}, ${log.status} (entity: ${log.entity_type}/${log.entity_id}) @ ${log.created_at}`);
      });

      // Group by operation type
      const byOperation = await prisma.$queryRaw`
        SELECT
          operation_type,
          COUNT(*) as count,
          SUM(total_tokens) as total_tokens,
          SUM(estimated_cost) as total_cost
        FROM llm_usage_logs
        GROUP BY operation_type
        ORDER BY count DESC
      `;

      console.log('\n📈 Breakdown by operation:\n');
      byOperation.forEach(row => {
        console.log(`- ${row.operation_type}: ${row.count} calls, ${row.total_tokens} tokens, $${parseFloat(row.total_cost).toFixed(6)}`);
      });
    } else {
      console.log('\n⚠️  No LLM logs found in database.');
      console.log('\n🔍 Possible reasons:');
      console.log('1. CV upload didn\'t complete successfully');
      console.log('2. Python backend not passing tenant_id/employee_id');
      console.log('3. Internal API endpoint not reachable from Python');
      console.log('4. Logging silently failed (check Python logs)');
    }

  } catch (error) {
    console.error('❌ Error checking LLM logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLLMLogs();
