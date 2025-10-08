const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔧 Applying migration 033: Add seniority to employee_roles...');

    // Add seniority column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE employee_roles
      ADD COLUMN IF NOT EXISTS seniority VARCHAR(50);
    `);
    console.log('✅ Column seniority added');

    // Add comment
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN employee_roles.seniority IS 'Seniority level extracted from CV (e.g., Junior, Mid, Senior, Lead, Principal)';
    `);
    console.log('✅ Comment added');

    // Create index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_employee_roles_seniority ON employee_roles(seniority);
    `);
    console.log('✅ Index created');

    console.log('🎉 Migration 033 applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
