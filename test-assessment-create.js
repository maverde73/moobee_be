const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testAssessmentCreation() {
  console.log('Testing Assessment Template Creation...\n');

  const testTemplates = [
    {
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
          orderIndex: 0
        }
      ]
    },
    {
      name: 'Test DiSC Assessment',
      type: 'disc',
      description: 'Test template for DiSC behavioral assessment',
      instructions: 'Select the option that best describes you',
      suggestedRoles: ['manager', 'team_lead'],
      suggestedFrequency: 'yearly',
      questions: []
    },
    {
      name: 'Test Belbin Assessment',
      type: 'belbin',
      description: 'Test template for Belbin team roles assessment',
      instructions: 'Answer based on your typical team behavior',
      suggestedRoles: ['developer', 'designer'],
      suggestedFrequency: 'once',
      questions: []
    }
  ];

  let successCount = 0;
  let failureCount = 0;

  for (const template of testTemplates) {
    try {
      console.log(`Testing: ${template.name} (${template.type})`);

      const response = await axios.post(
        `${API_URL}/assessments/templates`,
        template,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 201 || response.status === 200) {
        console.log(`✅ SUCCESS: Created ${template.type} template`);
        console.log(`   ID: ${response.data.id}`);
        console.log(`   Name: ${response.data.name}`);
        successCount++;
      } else {
        console.log(`⚠️  Unexpected status: ${response.status}`);
      }

    } catch (error) {
      console.log(`❌ FAILED: ${template.type}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      failureCount++;
    }

    console.log('');
  }

  console.log('='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`Total Tests: ${testTemplates.length}`);

  if (failureCount === 0) {
    console.log('\n🎉 All tests passed! Assessment creation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the error messages above.');
  }

  // Test invalid type (should fail)
  console.log('\n' + '='.repeat(50));
  console.log('Testing invalid type (should fail)...');
  console.log('='.repeat(50));

  try {
    const invalidTemplate = {
      name: 'Invalid Test',
      type: 'competency',  // This should be rejected
      description: 'This should fail',
      questions: []
    };

    const response = await axios.post(
      `${API_URL}/assessments/templates`,
      invalidTemplate,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('❌ ERROR: Invalid type was accepted! This is a problem.');

  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ CORRECT: Invalid type was properly rejected');
      console.log(`   Error message: ${JSON.stringify(error.response.data.errors)}`);
    } else {
      console.log('⚠️  Unexpected error:', error.message);
    }
  }
}

// Run the test
testAssessmentCreation().catch(console.error);