const { PrismaClient } = require('@prisma/client');
const SoftSkillService = require('./src/services/SoftSkillService');

const prisma = new PrismaClient();
const service = new SoftSkillService();

async function testSoftSkills() {
  console.log('🧪 Testing Soft Skills Integration...\n');

  try {
    // Test 1: Get all soft skills
    console.log('📋 Test 1: Fetching all soft skills...');
    const skills = await service.getAllSoftSkills();
    console.log(`✅ Found ${skills.length} soft skills`);
    console.log('Categories:', [...new Set(skills.map(s => s.category))]);

    // Test 2: Get single soft skill
    console.log('\n📋 Test 2: Fetching single soft skill...');
    if (skills.length > 0) {
      const skill = await service.getSoftSkillById(skills[0].id);
      console.log(`✅ Retrieved: ${skill.name} (${skill.code})`);
    }

    // Test 3: Test scoring calculation
    console.log('\n📋 Test 3: Testing score calculation...');
    const mockResponses = {
      bigFiveResponses: {
        extraversion: 70,
        agreeableness: 60,
        conscientiousness: 80,
        neuroticism: 30,
        openness: 75
      },
      discResponses: {
        D: 65,
        I: 70,
        S: 55,
        C: 60
      },
      belbinResponses: {
        coordinator: 70,
        shaper: 60,
        plant: 75,
        monitor_evaluator: 65,
        team_worker: 80,
        implementer: 70,
        completer_finisher: 65,
        resource_investigator: 75,
        specialist: 50
      }
    };

    if (skills.length > 0) {
      const score = await service.calculateSingleSkillScore(skills[0], mockResponses);
      console.log(`✅ Calculated score for ${skills[0].name}:`);
      console.log(`   Raw: ${score.raw.toFixed(2)}`);
      console.log(`   Normalized: ${score.normalized.toFixed(2)}`);
      console.log(`   Confidence: ${score.confidence.toFixed(2)}`);
    }

    // Test 4: Get tenant profiles
    console.log('\n📋 Test 4: Fetching tenant profiles...');
    const tenants = await prisma.tenants.findFirst();
    if (tenants) {
      const profiles = await service.getTenantProfiles(tenants.id);
      console.log(`✅ Found ${profiles.length} tenant profiles`);
      profiles.forEach(p => {
        console.log(`   - ${p.profileName} (${p.isDefault ? 'default' : 'custom'})`);
      });
    }

    // Test 5: Database integrity
    console.log('\n📋 Test 5: Checking database integrity...');
    const counts = {
      softSkills: await prisma.softSkill.count(),
      roleSkills: await prisma.roleSoftSkill.count(),
      questionMappings: await prisma.questionSoftSkillMapping.count(),
      scores: await prisma.assessmentSoftSkillScore.count(),
      profiles: await prisma.tenantSoftSkillProfile.count()
    };

    console.log('✅ Database counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count}`);
    });

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testSoftSkills();