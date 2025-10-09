const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpsertFinal() {
  console.log('🧪 FINAL TEST: Upsert with corrected Prisma schema');
  console.log('='.repeat(80));

  const employeeId = 91;
  const skillId = 276; // JavaScript
  const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

  try {
    // Check current state
    console.log('\n📊 Current state:');
    const before = await prisma.employee_skills.findMany({
      where: { employee_id: employeeId, skill_id: skillId }
    });
    console.log(`   Records found: ${before.length}`);
    if (before.length > 0) {
      console.log(`   Existing: ID=${before[0].id}, proficiency=${before[0].proficiency_level}`);
    }

    // FIRST UPSERT: Set proficiency to 5
    console.log('\n⚙️  Test 1: Upsert with proficiency_level = 5');
    const result1 = await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: {
          employee_id: employeeId,
          skill_id: skillId
        }
      },
      update: {
        proficiency_level: 5,
        years_experience: 2,
        source: 'assessment',
        updated_at: new Date()
      },
      create: {
        employee_id: employeeId,
        skill_id: skillId,
        proficiency_level: 5,
        years_experience: 2,
        source: 'assessment',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`   Result: ID=${result1.id}, proficiency=${result1.proficiency_level}`);
    const id1 = result1.id;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // SECOND UPSERT: Change proficiency to 8
    console.log('\n⚙️  Test 2: Upsert SAME skill with proficiency_level = 8');
    const result2 = await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: {
          employee_id: employeeId,
          skill_id: skillId
        }
      },
      update: {
        proficiency_level: 8,
        years_experience: 4,
        updated_at: new Date()
      },
      create: {
        employee_id: employeeId,
        skill_id: skillId,
        proficiency_level: 8,
        years_experience: 4,
        source: 'assessment',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`   Result: ID=${result2.id}, proficiency=${result2.proficiency_level}`);
    const id2 = result2.id;

    // CRITICAL CHECK
    console.log('\n🔍 CRITICAL CHECK:');
    if (id1 === id2) {
      console.log(`   ✅ SUCCESS! Same ID (${id1}) - Record was UPDATED, not created!`);
    } else {
      console.log(`   ❌ FAILURE! Different IDs (${id1} vs ${id2}) - New record was created!`);
    }

    // Count total records
    const total = await prisma.employee_skills.count({
      where: { employee_id: employeeId, skill_id: skillId }
    });

    console.log(`\n📈 Final count: ${total} record(s) for (employee_id=${employeeId}, skill_id=${skillId})`);

    if (total === 1 && id1 === id2) {
      console.log('\n' + '='.repeat(80));
      console.log('🎉 UPSERT WORKS PERFECTLY! Problem SOLVED!');
      console.log('='.repeat(80));
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('❌ UPSERT STILL NOT WORKING! Issue persists...');
      console.log('='.repeat(80));
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testUpsertFinal();
