const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔧 Running Migration 037: Add CV extraction status values...\n');

    // 1. Update status comment
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
    console.log('✅ Updated status column comment');

    // 2. Add import_stats column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE cv_extractions
      ADD COLUMN IF NOT EXISTS import_stats JSONB DEFAULT NULL
    `);
    console.log('✅ Added import_stats column');

    // 3. Add comment to import_stats
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN cv_extractions.import_stats IS
      'Summary of data imported to database tables: {personal_info_updated, education_saved, work_experiences_saved, skills_saved, languages_saved, certifications_saved, roles_saved, import_timestamp}'
    `);
    console.log('✅ Added import_stats column comment');

    // 4. Add error_phase column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE cv_extractions
      ADD COLUMN IF NOT EXISTS error_phase TEXT DEFAULT NULL
    `);
    console.log('✅ Added error_phase column');

    // 5. Add comment to error_phase
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN cv_extractions.error_phase IS
      'Which phase failed: python_connection, python_extraction, database_save, unknown'
    `);
    console.log('✅ Added error_phase column comment');

    console.log('\n🎉 Migration 037 completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
