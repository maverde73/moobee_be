/**
 * Test custom prompt and AI configuration
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testCustomPrompt() {
  console.log('🧪 Testing Custom AI Prompt Generation\n');

  // Test configuration
  const testConfig = {
    type: 'big_five',
    name: 'Test Big Five with Custom Prompt',
    count: 3,
    language: 'it',
    suggestedRoles: ['Developer', 'Manager'],
    description: 'Test assessment with custom AI configuration',

    // Custom AI configuration
    provider: 'openai',
    model: 'gpt-5',
    temperature: 0.8,
    maxTokens: 4000,
    customPrompt: `
Crea 3 domande per un assessment Big Five della personalità.
Le domande devono essere:
- Specifiche per ruoli IT (Developer e Manager)
- In italiano professionale
- Focalizzate su situazioni lavorative reali
- Una per Estroversione, una per Coscienziosità, una per Apertura mentale

Ogni domanda deve avere 5 opzioni di risposta su scala Likert da "Fortemente in disaccordo" a "Fortemente d'accordo".
`
  };

  try {
    console.log('📤 Sending request with custom configuration:');
    console.log('   Provider:', testConfig.provider);
    console.log('   Model:', testConfig.model);
    console.log('   Custom Prompt Length:', testConfig.customPrompt.length, 'chars');
    console.log('   Temperature:', testConfig.temperature);
    console.log('');

    const response = await axios.post(
      `${API_URL}/assessments/ai/generate-questions`,
      testConfig
    );

    if (response.data.success) {
      const { questions, metadata } = response.data.data;

      console.log('✅ Generation successful!');
      console.log('');
      console.log('📊 Metadata:');
      console.log('   Questions generated:', metadata.count);
      console.log('   Language:', metadata.language);
      console.log('   Is Mock:', metadata.isMock || false);
      console.log('   Is Fallback:', metadata.isFallback || false);
      console.log('');

      console.log('📝 Generated Questions:');
      questions.forEach((q, i) => {
        console.log(`\n   ${i + 1}. ${q.text}`);
        console.log(`      Category: ${q.category || 'N/A'}`);

        // Check if generation metadata is present
        if (q.generatedWith) {
          console.log(`      Generated with: ${q.generatedWith.provider} / ${q.generatedWith.model}`);
          console.log(`      Custom Prompt Used: ${q.generatedWith.customPrompt ? 'YES' : 'NO'}`);
        }

        if (q.options && q.options.length > 0) {
          console.log(`      Options: ${q.options.length} choices`);
        }
      });

      // Verify JSON structure
      console.log('\n🔍 Verifying JSON structure:');
      const firstQuestion = questions[0];
      console.log('   Has text:', !!firstQuestion.text);
      console.log('   Has options:', Array.isArray(firstQuestion.options));
      console.log('   Option structure valid:',
        firstQuestion.options &&
        firstQuestion.options[0] &&
        'text' in firstQuestion.options[0] &&
        'value' in firstQuestion.options[0]
      );

    } else {
      console.error('❌ Generation failed:', response.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\n⚠️  Authentication required. The API needs a valid JWT token.');
      console.log('   Please login first and add the token to this script.');
    }
  }
}

// Run test
testCustomPrompt();