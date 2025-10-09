/**
 * Run Migration 035: Allow Multiple Current Roles
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🚀 Starting Migration 035: Allow Multiple Current Roles');
    console.log('=' .repeat(60));

    console.log('\n🔧 Step 1: Drop existing unique constraint...');

    // Drop the old unique index from migration 014
    try {
      await prisma.$executeRaw`DROP INDEX IF EXISTS idx_employee_roles_unique`;
      console.log('✅ Dropped idx_employee_roles_unique');
    } catch (error) {
      console.log('ℹ️  Index might not exist:', error.message);
    }

    console.log('\n🔧 Step 2: Create new unique constraint (employee_id, role_id, sub_role_id)...');

    // Create new unique index on combination
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_roles_combo_unique
      ON employee_roles(employee_id, role_id, COALESCE(sub_role_id, 0))
    `;
    console.log('✅ Created idx_employee_roles_combo_unique');

    // Get stats
    const roleCount = await prisma.employee_roles.count();
    const multiCurrentRoles = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT employee_id) as count
      FROM employee_roles
      WHERE is_current = true
      GROUP BY employee_id
      HAVING COUNT(*) > 1
    `;

    console.log('\n✅ Migration 035 completed successfully!');
    console.log('=' .repeat(60));
    console.log('\n📊 Statistics:');
    console.log(`   Total roles: ${roleCount}`);
    console.log(`   Employees with multiple current roles: ${multiCurrentRoles.length || 0}`);
    console.log('\n📊 Changes applied:');
    console.log('   ✓ Removed single-role-per-employee constraint');
    console.log('   ✓ Employees can now have multiple current roles');
    console.log('   ✓ Kept constraint on (employee_id, role_id, sub_role_id)');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
