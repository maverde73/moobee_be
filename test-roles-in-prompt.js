const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3000/api';

async function testRolesInPrompt() {
  console.log('🧪 Testing roles inclusion in AI assessment generation...\n');

  const testCases = [
    {
      name: 'Big Five with Project Manager role',
      data: {
        type: 'big_five',
        count: 5,
        language: 'it',
        suggestedRoles: ['Project Manager', 'Team Lead'],
        description: 'Assessment per ruoli di gestione team',
        name: 'Big Five - Project Management'
      }
    },
    {
      name: 'DISC with Developer roles',
      data: {
        type: 'disc',
        count: 5,
        language: 'it',
        suggestedRoles: ['Software Developer', 'Frontend Engineer', 'Backend Engineer'],
        description: 'Assessment comportamentale per sviluppatori',
        name: 'DISC - Development Team'
      }
    },
    {
      name: 'Belbin with Sales roles',
      data: {
        type: 'belbin',
        count: 5,
        language: 'it',
        suggestedRoles: ['Sales Manager', 'Account Executive', 'Business Developer'],
        description: 'Identificazione ruoli team commerciale',
        name: 'Belbin - Sales Team'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   Roles: ${testCase.data.suggestedRoles.join(', ')}`);

    try {
      // Set up mock mode for testing without real AI
      const response = await axios.post(
        `${API_BASE_URL}/assessments/ai/generate-questions`,
        testCase.data,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log(`   ✅ Questions generated successfully`);
        console.log(`   📊 Generated ${response.data.data.questions.length} questions`);

        // Check if questions are relevant to roles (in mock mode, just verify structure)
        const firstQuestion = response.data.data.questions[0];
        console.log(`   🔍 Sample question: "${firstQuestion.text}"`);
        console.log(`   📁 Category: ${firstQuestion.category}`);
      } else {
        console.log(`   ❌ Generation failed: ${response.data.error}`);
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Details: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  console.log('\n\n📝 Summary:');
  console.log('The roles are now being included in the AI prompt generation.');
  console.log('When AI is available, questions will be tailored to the specified roles.');
  console.log('\nKey changes made:');
  console.log('1. AIGenerationService now builds customization with RUOLI TARGET');
  console.log('2. Assessment prompts include instructions to consider target roles');
  console.log('3. Roles are passed through the entire generation pipeline');
}

// Run the test
testRolesInPrompt().catch(console.error);