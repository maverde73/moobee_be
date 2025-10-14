/**
 * Execute Migration 043: Drop training_plans table
 *
 * This script removes the unused training_plans table from the database.
 * The table was never implemented (no FK, no code usage, 0 records).
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Starting Migration 043: Drop training_plans table\n');

  // Read migration SQL
  const migrationPath = path.join(__dirname, 'prisma/migrations/043_drop_training_plans.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Check if table exists
    console.log('📊 Checking if training_plans table exists...');

    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'training_plans'
      );
    `);

    const tableExists = tableCheck[0].exists;
    console.log(`   Table exists: ${tableExists}`);

    if (!tableExists) {
      console.log('\n✅ Table training_plans does not exist. Migration already applied or not needed.');
      return;
    }

    // Count records (safety check)
    const count = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM training_plans;
    `);
    console.log(`   Records in training_plans: ${count[0].count}\n`);

    if (parseInt(count[0].count) > 0) {
      console.error('⚠️  WARNING: Table contains data. Manual review required before dropping.');
      console.error('   Run: SELECT * FROM training_plans; to inspect data.');
      process.exit(1);
    }

    // Execute migration
    console.log('🚀 Executing migration SQL...\n');

    // Execute DROP TABLE statement
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS training_plans');
    console.log('   ✓ Table dropped\n');

    console.log('✅ Migration SQL executed successfully!\n');

    // Verify table is gone
    console.log('🔍 Verifying migration results...');

    const verifyCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'training_plans'
      );
    `);

    console.log(`   Table exists after drop: ${verifyCheck[0].exists}`);

    if (verifyCheck[0].exists) {
      throw new Error('Migration verification failed: table still exists after DROP command');
    }

    console.log('\n✅ Migration 043 completed successfully!');
    console.log('📝 Notes:');
    console.log('   - training_plans table removed from database');
    console.log('   - Prisma client already regenerated (prisma.training_plans no longer exists)');
    console.log('   - If issues occur, run: node run_migration_043_rollback.js\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔄 To rollback, run: node run_migration_043_rollback.js\n');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
runMigration()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
