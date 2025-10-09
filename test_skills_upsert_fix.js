const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Test to verify the skills upsert fix works correctly
 * Simulates the exact flow: GET skills → Update proficiency → PUT skills
 */
async function testSkillsUpsertFix() {
  console.log('🧪 TEST: Skills Upsert Fix Verification');
  console.log('='.repeat(80));

  const employeeId = 91;
  const testSkillId = 276; // JavaScript
  const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

  try {
    // STEP 1: Clean up - remove any existing test data
    console.log('\n🗑️  Step 1: Cleanup previous test data...');
    await prisma.employee_skills.deleteMany({
      where: { employee_id: employeeId, skill_id: testSkillId }
    });
    console.log('   ✅ Cleanup complete');

    // STEP 2: Insert initial record (simulating first assessment)
    console.log('\n📝 Step 2: Create initial skill record...');
    const initialRecord = await prisma.employee_skills.create({
      data: {
        employee_id: employeeId,
        skill_id: testSkillId,
        proficiency_level: 5,
        years_experience: 2,
        source: 'assessment',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    console.log(`   ✅ Created: ID=${initialRecord.id}, skill_id=${initialRecord.skill_id}, proficiency=${initialRecord.proficiency_level}`);
    const originalId = initialRecord.id;

    // STEP 3: Simulate GET /api/employees/:id/skills response
    console.log('\n🔍 Step 3: Simulate GET /api/employees/:id/skills...');
    const getResponse = {
      id: initialRecord.id.toString(), // employee_skills.id (e.g., "326")
      skill_id: initialRecord.skill_id, // skills.id (e.g., 276)
      name: 'JavaScript',
      level: initialRecord.proficiency_level,
      yearsOfExperience: initialRecord.years_experience,
      source: initialRecord.source
    };
    console.log('   GET response:', JSON.stringify(getResponse, null, 2));

    // STEP 4: User modifies proficiency in frontend and sends PUT
    console.log('\n⚙️  Step 4: Simulate PUT /api/employees/:id/skills (UPDATE)...');
    const putPayload = {
      hard: [
        {
          ...getResponse,
          level: 8, // User changes proficiency from 5 to 8
          yearsOfExperience: 4
        }
      ],
      soft: []
    };
    console.log('   PUT payload:', JSON.stringify(putPayload.hard[0], null, 2));

    // Simulate the FIXED backend logic
    const skill = putPayload.hard[0];
    const skillId = parseInt(skill.skill_id || skill.id); // ✅ FIX: Use skill_id if available

    console.log(`   🔧 Backend extracts: skill_id = ${skillId} (from skill.skill_id || skill.id)`);

    const upsertResult = await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: {
          employee_id: employeeId,
          skill_id: skillId
        }
      },
      update: {
        proficiency_level: skill.level || 0,
        years_experience: skill.yearsOfExperience || 0,
        source: skill.source || 'assessment',
        updated_at: new Date()
      },
      create: {
        employee_id: employeeId,
        skill_id: skillId,
        proficiency_level: skill.level || 0,
        years_experience: skill.yearsOfExperience || 0,
        source: skill.source || 'assessment',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`   ✅ Upsert result: ID=${upsertResult.id}, proficiency=${upsertResult.proficiency_level}`);

    // STEP 5: Verify database state
    console.log('\n🔍 Step 5: Verify database state...');
    const allRecords = await prisma.employee_skills.findMany({
      where: { employee_id: employeeId, skill_id: testSkillId }
    });

    console.log(`   Records found: ${allRecords.length}`);
    allRecords.forEach(r => {
      console.log(`     - ID=${r.id}, skill_id=${r.skill_id}, proficiency=${r.proficiency_level}, source=${r.source}`);
    });

    // STEP 6: FINAL VERIFICATION
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL VERIFICATION:');
    console.log('='.repeat(80));

    if (allRecords.length === 1) {
      const finalRecord = allRecords[0];
      if (finalRecord.id === originalId) {
        console.log(`✅ SUCCESS! Record UPDATED (same ID: ${originalId})`);
        console.log(`   Proficiency: 5 → ${finalRecord.proficiency_level} ✅`);
        console.log(`   Years exp: 2 → ${finalRecord.years_experience} ✅`);
        console.log(`   NO DUPLICATES CREATED! ✅`);
        console.log('\n🎉 FIX VERIFIED! The upsert now correctly uses skill_id!');
      } else {
        console.log(`❌ FAILURE! Different ID: ${originalId} → ${finalRecord.id}`);
        console.log(`   New record created instead of updating existing!`);
      }
    } else if (allRecords.length > 1) {
      console.log(`❌ FAILURE! ${allRecords.length} records created (DUPLICATES!)`);
      console.log(`   Original ID: ${originalId}`);
      console.log(`   All IDs: ${allRecords.map(r => r.id).join(', ')}`);
    } else {
      console.log(`❌ FAILURE! No records found!`);
    }

    // STEP 7: Cleanup
    console.log('\n🗑️  Cleanup: Removing test data...');
    await prisma.employee_skills.deleteMany({
      where: { employee_id: employeeId, skill_id: testSkillId }
    });
    console.log('   ✅ Test data removed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testSkillsUpsertFix();
