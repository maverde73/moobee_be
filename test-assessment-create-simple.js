const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testSimpleAssessmentCreation() {
  console.log('Testing Simple Assessment Template Creation...\n');

  const testTemplate = {
    name: 'Test Big Five Assessment',
    type: 'big_five',
    description: 'Test template for Big Five personality assessment',
    instructions: 'Complete all questions honestly',
    suggestedRoles: ['all'],
    suggestedFrequency: 'quarterly',
    questions: [
      {
        text: 'I enjoy social gatherings',
        type: 'likert',
        options: [
          { text: 'Strongly Disagree', value: 1 },
          { text: 'Disagree', value: 2 },
          { text: 'Neutral', value: 3 },
          { text: 'Agree', value: 4 },
          { text: 'Strongly Agree', value: 5 }
        ],
        category: 'extraversion',
        orderIndex: 1
      }
    ]
  };

  console.log('Sending template:', JSON.stringify(testTemplate, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    const response = await axios.post(
      `${API_URL}/assessments/templates`,
      testTemplate,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201 || response.status === 200) {
      console.log('✅ SUCCESS: Created template');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.log('❌ FAILED');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
}

// Run the test
testSimpleAssessmentCreation().catch(console.error);