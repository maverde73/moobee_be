/**
 * Run Migration 045: Add retry_count to cv_extractions
 * Date: 14 October 2025, 17:30
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Starting migration 045: Add retry_count to cv_extractions...');

    // Execute each statement separately
    console.log('Adding retry_count column...');
    await prisma.$executeRaw`
      ALTER TABLE cv_extractions
      ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0
    `;

    console.log('Adding comment...');
    await prisma.$executeRaw`
      COMMENT ON COLUMN cv_extractions.retry_count IS 'Number of import retry attempts by background worker (max 3)'
    `;

    console.log('Creating index...');
    await prisma.$executeRaw`
      CREATE INDEX idx_cv_extractions_status_retry ON cv_extractions(status, retry_count) WHERE status = 'extracted'
    `;

    console.log('✅ Migration 045 completed successfully');

    // Verify column was added
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'cv_extractions'
      AND column_name = 'retry_count'
    `;

    if (result.length > 0) {
      console.log('✅ Verified: retry_count column exists');
      console.log('   Type:', result[0].data_type);
      console.log('   Default:', result[0].column_default);
    } else {
      console.log('⚠️  Warning: retry_count column not found after migration');
    }

    // Check index
    const indexResult = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'cv_extractions'
      AND indexname = 'idx_cv_extractions_status_retry'
    `;

    if (indexResult.length > 0) {
      console.log('✅ Verified: Index idx_cv_extractions_status_retry exists');
    } else {
      console.log('⚠️  Warning: Index not found after migration');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
