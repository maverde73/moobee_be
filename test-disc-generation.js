const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testDiscGeneration() {
  console.log('Testing DISC Assessment Generation\n');
  console.log('='.repeat(50));

  const requestBody = {
    type: 'disc',
    name: 'Test DISC Assessment',
    description: 'Testing DISC generation with Likert scale',
    count: 5,
    language: 'it',
    suggestedRoles: ['manager'],
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000
  };

  console.log('Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    const response = await axios.post(
      `${API_URL}/assessments/ai/generate-questions`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SUCCESS: Questions generated');
    console.log('\nResponse Status:', response.status);
    console.log('\nMetadata:');
    console.log(JSON.stringify(response.data.data.metadata, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log('GENERATED QUESTIONS:');
    console.log('='.repeat(50) + '\n');

    const questions = response.data.data.questions;
    questions.forEach((q, index) => {
      console.log(`\nQuestion ${index + 1}:`);
      console.log(`  Text: ${q.text}`);
      console.log(`  Type: ${q.type}`);
      console.log(`  Category: ${q.category}`);

      if (q.options && q.options.length > 0) {
        console.log('  Options:');
        q.options.forEach(opt => {
          console.log(`    - ${opt.text} (value: ${opt.value})`);
        });
      } else {
        console.log('  ⚠️  NO OPTIONS FOUND!');
      }
    });

    // Check if options are Likert scale
    console.log('\n' + '='.repeat(50));
    console.log('VALIDATION:');
    console.log('='.repeat(50) + '\n');

    const hasLikertOptions = questions.every(q =>
      q.options &&
      q.options.length === 5 &&
      q.options.some(opt => opt.text.toLowerCase().includes('accordo'))
    );

    if (hasLikertOptions) {
      console.log('✅ All questions have Likert scale options');
    } else {
      console.log('❌ Questions are missing Likert scale options!');

      // Check what we actually got
      const firstQuestion = questions[0];
      if (firstQuestion) {
        console.log('\nFirst question structure:');
        console.log(JSON.stringify(firstQuestion, null, 2));
      }
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
testDiscGeneration()
  .then(() => console.log('\n✅ Test completed'))
  .catch(console.error);