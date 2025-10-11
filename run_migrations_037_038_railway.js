/**
 * Run Migrations 037 and 038 on Railway Database
 *
 * Migration 037: Add import_stats and error_phase fields
 * Migration 038: Update CHECK constraint to allow 'extracted' and 'importing' status values
 *
 * IMPORTANT: Run this ONLY on Railway production database
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const prisma = new PrismaClient();

  try {
    console.log('🚀 Starting Migrations 037 and 038 on Railway Database\n');

    // Migration 037: Add import_stats and error_phase
    console.log('📋 Running Migration 037: Add import_stats and error_phase fields...');

    // Execute each SQL command separately
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN cv_extractions.status IS
      'Extraction status:
      - pending: Upload completed, waiting for Python extraction
      - processing: Python is extracting data from CV
      - extracted: Python finished extraction, JSON ready
      - importing: BE_nodejs is saving data to database tables
      - completed: All data saved to database successfully
      - failed: Error occurred in any phase'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE cv_extractions
      ADD COLUMN IF NOT EXISTS import_stats JSONB DEFAULT NULL
    `);

    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN cv_extractions.import_stats IS
      'Summary of data imported to database tables: {personal_info_updated, education_saved, work_experiences_saved, skills_saved, languages_saved, certifications_saved, roles_saved, import_timestamp}'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE cv_extractions
      ADD COLUMN IF NOT EXISTS error_phase TEXT DEFAULT NULL
    `);

    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN cv_extractions.error_phase IS
      'Which phase failed: python_connection, python_extraction, database_save, unknown'
    `);

    console.log('✅ Migration 037 completed successfully\n');

    // Migration 038: Update CHECK constraint
    console.log('📋 Running Migration 038: Update status CHECK constraint...');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE cv_extractions
      DROP CONSTRAINT IF EXISTS check_cv_extractions_status
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE cv_extractions
      ADD CONSTRAINT check_cv_extractions_status
      CHECK (status IN ('pending', 'processing', 'extracted', 'importing', 'completed', 'failed'))
    `);

    await prisma.$executeRawUnsafe(`
      COMMENT ON CONSTRAINT check_cv_extractions_status ON cv_extractions IS
      'Valid status values: pending, processing, extracted, importing, completed, failed'
    `);

    console.log('✅ Migration 038 completed successfully\n');

    // Verify the changes
    console.log('🔍 Verifying changes...');

    // Check if import_stats column exists
    const hasImportStats = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cv_extractions'
        AND column_name = 'import_stats'
    `;
    console.log('  import_stats column exists:', hasImportStats.length > 0 ? '✅' : '❌');

    // Check if error_phase column exists
    const hasErrorPhase = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cv_extractions'
        AND column_name = 'error_phase'
    `;
    console.log('  error_phase column exists:', hasErrorPhase.length > 0 ? '✅' : '❌');

    // Check CHECK constraint
    const checkConstraint = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'check_cv_extractions_status'
    `;

    if (checkConstraint.length > 0) {
      console.log('  CHECK constraint definition:', checkConstraint[0].definition);
      const definition = checkConstraint[0].definition.toLowerCase();
      const hasExtracted = definition.includes('extracted');
      const hasImporting = definition.includes('importing');
      console.log('  Contains "extracted":', hasExtracted ? '✅' : '❌');
      console.log('  Contains "importing":', hasImporting ? '✅' : '❌');
    } else {
      console.log('  CHECK constraint not found: ❌');
    }

    console.log('\n🎉 All migrations completed successfully!');
    console.log('\n📊 New status values available:');
    console.log('  - pending: Upload completed, waiting for Python extraction');
    console.log('  - processing: Python is extracting data from CV');
    console.log('  - extracted: Python finished extraction, JSON ready ✨ NEW');
    console.log('  - importing: BE_nodejs is saving data to database tables ✨ NEW');
    console.log('  - completed: All data saved to database successfully');
    console.log('  - failed: Error occurred in any phase');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some fields already exist. This is OK if migrations were partially applied.');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigrations();
