/**
 * Run Migration 040: Create cv_files table
 * Date: 2025-10-10
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Running Migration 040: Create cv_files table');

    // Execute each statement separately (Prisma doesn't support multi-statement)

    // 1. Create table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS cv_files (
        id SERIAL PRIMARY KEY,
        extraction_id UUID NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        original_filename VARCHAR(255),
        uploaded_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_cv_files_extraction
          FOREIGN KEY (extraction_id)
          REFERENCES cv_extractions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_cv_files_tenant
          FOREIGN KEY (tenant_id)
          REFERENCES tenants(id)
          ON DELETE CASCADE
      )
    `;
    console.log('  ✓ Table cv_files created');

    // 2. Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cv_files_extraction ON cv_files(extraction_id)`;
    console.log('  ✓ Index idx_cv_files_extraction created');

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cv_files_tenant ON cv_files(tenant_id)`;
    console.log('  ✓ Index idx_cv_files_tenant created');

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cv_files_uploaded_at ON cv_files(uploaded_at DESC)`;
    console.log('  ✓ Index idx_cv_files_uploaded_at created');

    console.log('✅ Migration 040 completed successfully');

    // Verify table exists
    const result = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'cv_files'
    `;

    console.log('📋 Verification:', result);

    if (result && result.length > 0) {
      console.log('✅ Table cv_files created and verified');
    } else {
      console.log('⚠️  Table cv_files not found after migration');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
