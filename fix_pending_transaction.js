const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPendingTransactions() {
  try {
    console.log('[Fix] Attempting to rollback pending transactions...');

    // Try to execute a simple query to force rollback
    await prisma.$executeRawUnsafe(`ROLLBACK`);
    console.log('✅ ROLLBACK executed');

    // Check for blocking queries
    const blockingQueries = await prisma.$queryRawUnsafe(`
      SELECT
        pid,
        usename,
        application_name,
        state,
        query,
        state_change
      FROM pg_stat_activity
      WHERE state = 'idle in transaction'
      OR state = 'idle in transaction (aborted)'
      ORDER BY state_change;
    `);

    console.log('\n📊 Blocking/Idle Transactions:');
    if (blockingQueries.length === 0) {
      console.log('   ✅ No idle transactions found');
    } else {
      console.table(blockingQueries);

      // Terminate idle transactions
      for (const query of blockingQueries) {
        console.log(`\n🔪 Terminating PID ${query.pid} (${query.state})...`);
        try {
          await prisma.$executeRawUnsafe(`SELECT pg_terminate_backend(${query.pid})`);
          console.log(`   ✅ PID ${query.pid} terminated`);
        } catch (err) {
          console.log(`   ⚠️  Could not terminate PID ${query.pid}: ${err.message}`);
        }
      }
    }

    // Check current connections
    const connections = await prisma.$queryRawUnsafe(`
      SELECT
        datname,
        count(*) as connections,
        sum(case when state = 'active' then 1 else 0 end) as active,
        sum(case when state = 'idle' then 1 else 0 end) as idle
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
      GROUP BY datname;
    `);

    console.log('\n📈 Current Database Connections:');
    console.table(connections);

    console.log('\n✅ Database transaction cleanup completed!');
    console.log('   You can now run CV extraction without errors.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);

    // If ROLLBACK fails, it means we're not in a transaction - that's OK
    if (error.message.includes('no transaction is in progress')) {
      console.log('✅ No active transaction to rollback (this is OK)');
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixPendingTransactions();
