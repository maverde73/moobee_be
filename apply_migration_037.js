const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration037() {
  console.log('🚀 Applying Migration 037: Add UNIQUE constraint employee_skills');
  console.log('='.repeat(80));

  try {
    // Step 1: Check for duplicates first
    console.log('\n🔍 Step 1: Checking for duplicate (employee_id, skill_id) records...');
    const duplicates = await prisma.$queryRaw`
      SELECT employee_id, skill_id, COUNT(*) as count, ARRAY_AGG(id ORDER BY created_at DESC) as ids
      FROM employee_skills
      GROUP BY employee_id, skill_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(`\n⚠️  WARNING: Found ${duplicates.length} duplicate combinations!`);
      console.log('Duplicates (will keep most recent):');
      duplicates.forEach(d => {
        console.log(`   employee_id=${d.employee_id}, skill_id=${d.skill_id}, count=${d.count}`);
        console.log(`     IDs: ${d.ids.join(', ')} (keeping first, deleting others)`);
      });

      console.log('\n🗑️  Removing duplicates (keeping most recent by created_at)...');

      // Delete duplicates, keeping only the most recent (first in array due to ORDER BY created_at DESC)
      for (const dup of duplicates) {
        const idsToDelete = dup.ids.slice(1); // Skip first (most recent)

        for (const idToDelete of idsToDelete) {
          await prisma.$executeRaw`
            DELETE FROM employee_skills WHERE id = ${idToDelete}
          `;
          console.log(`     Deleted: id=${idToDelete}`);
        }
      }

      console.log(`\n✅ Removed ${duplicates.reduce((sum, d) => sum + d.count - 1, 0)} duplicate records`);
    } else {
      console.log('✅ No duplicates found. Safe to proceed.');
    }

    // Step 2: Add UNIQUE constraint
    console.log('\n⚙️  Step 2: Adding UNIQUE constraint...');
    await prisma.$executeRaw`
      ALTER TABLE employee_skills
      ADD CONSTRAINT employee_skills_employee_id_skill_id_key
      UNIQUE (employee_id, skill_id)
    `;
    console.log('✅ UNIQUE constraint added: employee_skills_employee_id_skill_id_key');

    // Step 3: Verify constraint
    console.log('\n🔍 Step 3: Verifying constraint...');
    const constraintCheck = await prisma.$queryRaw`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'employee_skills'
      AND constraint_name = 'employee_skills_employee_id_skill_id_key'
    `;

    if (constraintCheck.length > 0) {
      console.log(`✅ Constraint verified: ${constraintCheck[0].constraint_name} (${constraintCheck[0].constraint_type})`);
    } else {
      throw new Error('Failed to verify UNIQUE constraint creation');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Migration 037 completed successfully!');
    console.log('='.repeat(80));
    console.log('\n💡 Now the upsert will work correctly:');
    console.log('   - INSERT: Creates new record if (employee_id, skill_id) doesn\'t exist');
    console.log('   - UPDATE: Updates existing record if (employee_id, skill_id) exists');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    console.log('\n💡 To rollback, run: node BE_nodejs/prisma/migrations/037_add_unique_employee_skill/rollback.sql');
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration037();
