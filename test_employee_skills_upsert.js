const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpsert() {
  console.log('🧪 Testing employee_skills UPSERT functionality');
  console.log('='.repeat(80));

  const employeeId = 91;  // Yan Huang
  const skillId = 276;    // JavaScript
  const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406'; // Correct tenant_id for employee 91

  try {
    // Step 1: Check current state
    console.log('\n📊 Step 1: Current state');
    const current = await prisma.employee_skills.findUnique({
      where: {
        employee_id_skill_id: { employee_id: employeeId, skill_id: skillId }
      }
    });

    if (current) {
      console.log(`✅ Existing record found:`);
      console.log(`   ID: ${current.id}`);
      console.log(`   Proficiency: ${current.proficiency_level}`);
      console.log(`   Source: ${current.source}`);
      console.log(`   Created: ${current.created_at}`);
      console.log(`   Updated: ${current.updated_at}`);
    } else {
      console.log('⚠️  No existing record found');
    }

    // Step 2: Perform UPSERT (first time)
    console.log('\n⚙️  Step 2: Performing UPSERT (proficiency_level = 7)...');
    const result1 = await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: { employee_id: employeeId, skill_id: skillId }
      },
      update: {
        proficiency_level: 7,
        years_experience: 3,
        source: 'assessment',
        notes: 'Updated via upsert test',
        updated_at: new Date()
      },
      create: {
        employee_id: employeeId,
        skill_id: skillId,
        proficiency_level: 7,
        years_experience: 3,
        source: 'assessment',
        notes: 'Created via upsert test',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`✅ Upsert completed:`);
    console.log(`   ID: ${result1.id}`);
    console.log(`   Proficiency: ${result1.proficiency_level}`);
    console.log(`   Years exp: ${result1.years_experience}`);
    console.log(`   Notes: ${result1.notes}`);
    console.log(`   Updated: ${result1.updated_at}`);

    // Step 3: Perform UPSERT again (should UPDATE, not INSERT)
    console.log('\n⚙️  Step 3: Performing UPSERT again (proficiency_level = 9)...');
    const result2 = await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: { employee_id: employeeId, skill_id: skillId }
      },
      update: {
        proficiency_level: 9,
        years_experience: 5,
        notes: 'Updated AGAIN via upsert test',
        updated_at: new Date()
      },
      create: {
        employee_id: employeeId,
        skill_id: skillId,
        proficiency_level: 9,
        years_experience: 5,
        source: 'assessment',
        notes: 'Should not create!',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`✅ Second upsert completed:`);
    console.log(`   ID: ${result2.id} ${result2.id === result1.id ? '(SAME - UPDATE ✓)' : '(DIFFERENT - NEW RECORD ✗)'}`);
    console.log(`   Proficiency: ${result2.proficiency_level}`);
    console.log(`   Years exp: ${result2.years_experience}`);
    console.log(`   Notes: ${result2.notes}`);

    // Step 4: Verify total count
    console.log('\n📈 Step 4: Verify no duplicates created');
    const count = await prisma.employee_skills.count({
      where: {
        employee_id: employeeId,
        skill_id: skillId
      }
    });

    console.log(`   Total records for (employee_id=${employeeId}, skill_id=${skillId}): ${count}`);

    if (count === 1) {
      console.log('   ✅ PERFECT! Only 1 record exists (upsert worked!)');
    } else {
      console.log(`   ❌ ERROR! ${count} records exist (duplicates created!)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Test completed!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testUpsert();
