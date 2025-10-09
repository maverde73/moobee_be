const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration036() {
  console.log('🚀 Applying Migration 036: Add employee_skills FK to employees');
  console.log('='.repeat(80));

  try {
    // Read migration SQL
    const migrationPath = path.join(__dirname, 'prisma/migrations/036_add_employee_skills_fk/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📝 Migration SQL:');
    console.log('-'.repeat(80));
    console.log(migrationSQL);
    console.log('-'.repeat(80));

    // Check for orphaned records first
    console.log('\n🔍 Checking for orphaned employee_skills records...');
    const orphanedSkills = await prisma.$queryRaw`
      SELECT es.id, es.employee_id, es.skill_id
      FROM employee_skills es
      LEFT JOIN employees e ON es.employee_id = e.id
      WHERE e.id IS NULL
    `;

    if (orphanedSkills.length > 0) {
      console.log(`\n⚠️  WARNING: Found ${orphanedSkills.length} orphaned employee_skills records!`);
      console.log('These records reference non-existent employees:');
      orphanedSkills.forEach(s => {
        console.log(`   - employee_skills.id=${s.id}, employee_id=${s.employee_id} (NOT FOUND)`);
      });

      console.log('\n❌ Cannot apply migration with orphaned records.');
      console.log('Options:');
      console.log('1. Delete orphaned records: DELETE FROM employee_skills WHERE employee_id NOT IN (SELECT id FROM employees);');
      console.log('2. Fix employee_id references to valid employees');
      console.log('\nAborting migration.');
      return;
    }

    console.log('✅ No orphaned records found. Safe to proceed.');

    // Execute migration commands separately
    console.log('\n⚙️  Executing migration...');

    console.log('  1. Adding foreign key constraint...');
    await prisma.$executeRaw`
      ALTER TABLE employee_skills
      ADD CONSTRAINT fk_employee_skills_employee
      FOREIGN KEY (employee_id)
      REFERENCES employees(id)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `;

    console.log('  2. Creating index...');
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id
      ON employee_skills(employee_id)
    `;

    console.log('\n✅ Migration 036 applied successfully!');

    // Verify FK was created
    const fkCheck = await prisma.$queryRaw`
      SELECT constraint_name, delete_rule, update_rule
      FROM information_schema.referential_constraints
      WHERE constraint_name = 'fk_employee_skills_employee'
    `;

    if (fkCheck.length > 0) {
      console.log('\n✅ Foreign key verified:');
      console.log(`   Constraint: ${fkCheck[0].constraint_name}`);
      console.log(`   ON DELETE: ${fkCheck[0].delete_rule}`);
      console.log(`   ON UPDATE: ${fkCheck[0].update_rule}`);
    }

    // Verify index was created
    const indexCheck = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'employee_skills'
      AND indexname = 'idx_employee_skills_employee_id'
    `;

    if (indexCheck.length > 0) {
      console.log('\n✅ Index verified: idx_employee_skills_employee_id');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Migration 036 completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    console.log('\n💡 To rollback, run: psql < prisma/migrations/036_add_employee_skills_fk/rollback.sql');
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration036();
