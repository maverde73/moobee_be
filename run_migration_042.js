/**
 * Execute Migration 042: Rename user_soft_skills to employee_soft_skill_assessments
 *
 * This script applies the SQL migration that renames the table and updates
 * columns, constraints, and indexes for consistency.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Starting Migration 042: Rename user_soft_skills → employee_soft_skill_assessments\n');

  // Read migration SQL
  const migrationPath = path.join(__dirname, 'prisma/migrations/042_rename_user_soft_skills.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolon but keep transactions together
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  try {
    // Verify current state
    console.log('📊 Checking current state...');

    // Check if old table exists
    const oldTableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'user_soft_skills'
      );
    `);

    const oldTableExists = oldTableCheck[0].exists;
    console.log(`   Old table (user_soft_skills) exists: ${oldTableExists}`);

    if (!oldTableExists) {
      console.log('\n⚠️  Table user_soft_skills does not exist. Migration may have already been applied.');
      console.log('   Checking if new table exists...');

      const newTableCheck = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'employee_soft_skill_assessments'
        );
      `);

      if (newTableCheck[0].exists) {
        console.log('✅ New table (employee_soft_skill_assessments) already exists.');
        console.log('   Migration appears to have been applied previously.');
        return;
      } else {
        throw new Error('Neither old nor new table exists. Database state unclear.');
      }
    }

    // Count records
    const count = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM user_soft_skills;
    `);
    console.log(`   Records in user_soft_skills: ${count[0].count}\n`);

    // Execute migration
    console.log('🚀 Executing migration SQL...\n');

    // Parse SQL file and execute each statement
    const sqlContent = migrationSQL
      .replace(/BEGIN;/g, '')
      .replace(/COMMIT;/g, '')
      .replace(/--.*$/gm, '') // Remove comments
      .trim();

    // Split statements and filter out verification queries
    const sqlStatements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('SELECT'));

    console.log(`   Found ${sqlStatements.length} statements to execute\n`);

    // Execute in a transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < sqlStatements.length; i++) {
        const stmt = sqlStatements[i];
        console.log(`   [${i + 1}/${sqlStatements.length}] Executing: ${stmt.split('\n')[0].substring(0, 60)}...`);
        await tx.$executeRawUnsafe(stmt);
      }
    });

    console.log('\n✅ Migration SQL executed successfully!\n');

    // Verify new state
    console.log('🔍 Verifying migration results...');

    const newTableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'employee_soft_skill_assessments'
      );
    `);

    console.log(`   New table (employee_soft_skill_assessments) exists: ${newTableCheck[0].exists}`);

    // Check columns
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'employee_soft_skill_assessments'
      ORDER BY ordinal_position;
    `);

    console.log('\n   Columns in new table:');
    columns.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    // Check indexes
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'employee_soft_skill_assessments';
    `);

    console.log('\n   Indexes:');
    indexes.forEach(idx => {
      console.log(`     - ${idx.indexname}`);
    });

    // Check constraints
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'employee_soft_skill_assessments';
    `);

    console.log('\n   Constraints:');
    constraints.forEach(con => {
      console.log(`     - ${con.constraint_name} (${con.constraint_type})`);
    });

    console.log('\n✅ Migration 042 completed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Update CLAUDE.md to document this migration');
    console.log('   2. Test that the application works correctly');
    console.log('   3. If issues occur, run: node run_migration_042_rollback.js\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔄 To rollback, run: node run_migration_042_rollback.js\n');
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
