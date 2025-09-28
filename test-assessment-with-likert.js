const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testAssessmentWithLikert() {
  console.log('Testing Assessment Template Creation with Likert Type...\n');

  const testTemplate = {
    name: 'Test Big Five Assessment - Likert',
    type: 'big_five',
    description: 'Test template with proper likert type',
    instructions: 'Complete all questions honestly',
    suggestedRoles: ['all'],
    suggestedFrequency: 'quarterly',
    aiCustomization: 'Focus on personality traits',
    questions: [
      {
        text: 'I enjoy social gatherings',
        type: 'likert',  // Using 'likert' not 'likert_scale'
        options: [
          { text: 'Strongly Disagree', value: 1, orderIndex: 1 },
          { text: 'Disagree', value: 2, orderIndex: 2 },
          { text: 'Neutral', value: 3, orderIndex: 3 },
          { text: 'Agree', value: 4, orderIndex: 4 },
          { text: 'Strongly Agree', value: 5, orderIndex: 5 }
        ],
        category: 'extraversion',
        orderIndex: 1,
        isRequired: true
      },
      {
        text: 'I prefer working alone',
        type: 'likert',
        options: [
          { text: 'Strongly Disagree', value: 1, orderIndex: 1 },
          { text: 'Disagree', value: 2, orderIndex: 2 },
          { text: 'Neutral', value: 3, orderIndex: 3 },
          { text: 'Agree', value: 4, orderIndex: 4 },
          { text: 'Strongly Agree', value: 5, orderIndex: 5 }
        ],
        category: 'extraversion',
        orderIndex: 2,
        isRequired: true
      }
    ]
  };

  console.log('Sending template with proper field structure...');
  console.log('Questions types:', testTemplate.questions.map(q => q.type));
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

      // Return the ID for cleanup
      return response.data.data?.id || response.data.id;
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.log('❌ FAILED');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${JSON.stringify(error.response.data, null, 2)}`);

      // Log specific validation errors if available
      if (error.response.data?.errors) {
        console.log('\nValidation Errors:');
        error.response.data.errors.forEach(err => {
          console.log(`  - ${err}`);
        });
      }
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
}

// Run the test
testAssessmentWithLikert()
  .then(templateId => {
    if (templateId) {
      console.log(`\n✅ Template created with ID: ${templateId}`);
    }
  })
  .catch(console.error);