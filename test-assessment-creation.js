const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testAssessmentCreation() {
  console.log('🧪 Testing Assessment Creation with AI Fields...\n');

  // Test data with all the AI fields
  const assessmentData = {
    name: 'Test Assessment with AI Fields',
    type: 'big_five',
    description: 'Testing that all AI fields are saved correctly',
    isActive: true,
    suggestedRoles: ['Developer', 'Manager'],
    targetSoftSkillIds: [1, 2, 3],
    // AI-specific fields
    aiPrompt: 'Generate questions for evaluating leadership and communication skills in a software development context',
    instructions: 'Please answer all questions honestly based on your recent work experiences',
    suggestedFrequency: 'quarterly',
    aiModel: 'gpt-4-turbo',
    aiTemperature: 0.7,
    aiMaxTokens: 4000,
    aiLanguage: 'it',
    scoringAlgorithm: 'weighted',
    softSkillsEnabled: true,
    questions: [
      {
        text: 'How do you handle conflicts in your team?',
        type: 'text',
        category: 'leadership',
        order: 1,
        isRequired: true,
        options: []
      },
      {
        text: 'Rate your communication skills',
        type: 'likert',
        category: 'communication',
        order: 2,
        isRequired: true,
        options: [
          { text: 'Poor', value: 1, orderIndex: 1 },
          { text: 'Fair', value: 2, orderIndex: 2 },
          { text: 'Good', value: 3, orderIndex: 3 },
          { text: 'Very Good', value: 4, orderIndex: 4 },
          { text: 'Excellent', value: 5, orderIndex: 5 }
        ]
      }
    ]
  };

  try {
    console.log('📤 Sending POST request to /api/assessments/templates...');
    console.log('Data being sent:', JSON.stringify(assessmentData, null, 2));

    const response = await axios.post(`${API_URL}/api/assessments/templates`, assessmentData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ Assessment created successfully!');
    console.log('Response status:', response.status);
    console.log('Created assessment:', JSON.stringify(response.data, null, 2));

    // Verify the created assessment
    if (response.data && response.data.data && response.data.data.id) {
      console.log('\n🔍 Fetching created assessment to verify fields...');
      const getResponse = await axios.get(`${API_URL}/api/assessments/templates/${response.data.data.id}`);

      console.log('\n📋 Verification Results:');
      const created = getResponse.data.data || getResponse.data;

      const fieldsToCheck = [
        'aiPrompt',
        'instructions',
        'suggestedFrequency',
        'aiModel',
        'aiTemperature',
        'aiMaxTokens',
        'aiLanguage'
      ];

      let allFieldsCorrect = true;
      fieldsToCheck.forEach(field => {
        const expected = assessmentData[field];
        const actual = created[field];
        const match = expected == actual; // Use == to handle number/string comparison
        console.log(`  ${match ? '✅' : '❌'} ${field}: ${actual} ${match ? '' : `(expected: ${expected})`}`);
        if (!match) allFieldsCorrect = false;
      });

      if (allFieldsCorrect) {
        console.log('\n🎉 SUCCESS: All AI fields were saved correctly!');
      } else {
        console.log('\n⚠️ WARNING: Some fields were not saved correctly');
      }

      // Check questions
      if (created.questions && created.questions.length > 0) {
        console.log(`\n📝 Questions created: ${created.questions.length}`);
        created.questions.forEach(q => {
          console.log(`  - ${q.text} (isRequired: ${q.isRequired})`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Error creating assessment:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testAssessmentCreation().then(() => {
  console.log('\n✨ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});