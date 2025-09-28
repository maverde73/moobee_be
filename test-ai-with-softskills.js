/**
 * Test script per verificare la generazione AI con soft skills
 */

const axios = require('axios');

async function testAIGenerationWithSoftSkills() {
  console.log('🧪 Testing AI generation with role soft skills...\n');

  // Dati di test con soft skills per il ruolo Bioinformatics Scientists (ID: 37)
  const testData = {
    type: 'big-five',
    name: 'Assessment Big Five per Bioinformatics Scientists',
    description: 'Valutazione personalità per ruolo scientifico',
    count: 10,
    language: 'it',
    questionType: 'multiple_choice',
    suggestedRoles: ['37:Bioinformatics Scientists'],
    roleSoftSkills: [
      {
        roleId: 37,
        roleName: 'Bioinformatics Scientists',
        skills: [
          {
            name: 'Capacità Decisionale',
            nameEn: 'Decision Making',
            priority: 1,
            minScore: 85,
            category: 'adaptive'
          },
          {
            name: 'Resilienza',
            nameEn: 'Resilience',
            priority: 2,
            minScore: 80,
            category: 'adaptive'
          },
          {
            name: 'Comunicazione Efficace',
            nameEn: 'Effective Communication',
            priority: 3,
            minScore: 75,
            category: 'relational'
          },
          {
            name: 'Lavoro di Squadra',
            nameEn: 'Teamwork',
            priority: 4,
            minScore: 70,
            category: 'collaborative'
          },
          {
            name: 'Problem Solving',
            nameEn: 'Problem Solving',
            priority: 5,
            minScore: 65,
            category: 'cognitive'
          }
        ]
      }
    ]
  };

  try {
    console.log('📤 Sending request to AI generation endpoint...');
    console.log('Roles included:', testData.suggestedRoles);
    console.log('Soft skills included:', testData.roleSoftSkills.length > 0 ? 'Yes' : 'No');
    console.log('Skills count:', testData.roleSoftSkills[0].skills.length);

    const response = await axios.post(
      'http://localhost:3000/api/assessments/ai/generate-questions',
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('\n✅ AI Generation successful!');
      console.log('Questions generated:', response.data.data.questions.length);

      // Verifica se il prompt include i soft skills
      if (response.data.data.aiConfig && response.data.data.aiConfig.prompt) {
        const prompt = response.data.data.aiConfig.prompt;
        const hasSoftSkills = prompt.includes('SOFT SKILLS CRITICI') ||
                             prompt.includes('RUOLI TARGET');

        console.log('\n📋 Prompt Analysis:');
        console.log('Contains soft skills section:', hasSoftSkills ? '✅ Yes' : '❌ No');

        if (hasSoftSkills) {
          console.log('\n🎯 Soft skills successfully included in the prompt!');
          console.log('The AI will generate questions tailored to evaluate:');
          testData.roleSoftSkills[0].skills.forEach(skill => {
            console.log(`  - ${skill.name} (Priority ${skill.priority}, Min: ${skill.minScore}%)`);
          });
        }
      }

      // Mostra le prime 3 domande generate
      console.log('\n📝 Sample questions generated:');
      response.data.data.questions.slice(0, 3).forEach((q, i) => {
        console.log(`\n${i + 1}. ${q.text}`);
        console.log(`   Category: ${q.category}`);
      });

      // Check metadata
      if (response.data.data.metadata) {
        const meta = response.data.data.metadata;
        console.log('\n📊 Generation metadata:');
        console.log(`  - Type: ${meta.type}`);
        console.log(`  - Language: ${meta.language}`);
        console.log(`  - Is Mock: ${meta.isMock ? 'Yes ⚠️' : 'No ✅'}`);
        console.log(`  - Is Fallback: ${meta.isFallback ? 'Yes ⚠️' : 'No ✅'}`);
      }

    } else {
      console.error('❌ Generation failed:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Error during test:', error.response?.data || error.message);
  }
}

// Run the test
testAIGenerationWithSoftSkills()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });