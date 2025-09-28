/**
 * Script per verificare i modelli AI disponibili da OpenAI e Anthropic
 */

require('dotenv').config();

async function checkOpenAIModels() {
  console.log('\n🔍 Checking OpenAI Models...\n');

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error('OpenAI API Error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();

    // Filtra e ordina modelli chat
    const chatModels = data.data
      .filter(model => {
        const id = model.id.toLowerCase();
        return id.includes('gpt') && !id.includes('instruct') && !id.includes('0301') && !id.includes('0314');
      })
      .sort((a, b) => {
        // Ordina per nome per trovare GPT-5 se esiste
        const orderMap = {
          'gpt-5': 1,
          'gpt-4': 2,
          'gpt-3.5': 3
        };

        const aOrder = Object.keys(orderMap).find(key => a.id.includes(key));
        const bOrder = Object.keys(orderMap).find(key => b.id.includes(key));

        return (orderMap[aOrder] || 999) - (orderMap[bOrder] || 999);
      });

    console.log(`Found ${chatModels.length} chat models:\n`);

    chatModels.forEach(model => {
      console.log(`  📌 ${model.id}`);
      console.log(`     Created: ${new Date(model.created * 1000).toLocaleDateString()}`);
      console.log(`     Owner: ${model.owned_by}`);

      // Check for GPT-5
      if (model.id.includes('gpt-5')) {
        console.log(`     ⭐ GPT-5 FOUND! ⭐`);
      }
      console.log('');
    });

    // Cerca specificamente GPT-5
    const gpt5Models = data.data.filter(m => m.id.toLowerCase().includes('gpt-5'));
    if (gpt5Models.length > 0) {
      console.log('🎉 GPT-5 Models Available:');
      gpt5Models.forEach(m => console.log(`   - ${m.id}`));
    } else {
      console.log('❌ No GPT-5 models found in the API response');
    }

  } catch (error) {
    console.error('Error fetching OpenAI models:', error.message);
  }
}

async function checkAnthropicModels() {
  console.log('\n🔍 Checking Anthropic Models...\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API Error:', response.status, errorText);
      return;
    }

    const data = await response.json();

    if (!data.data) {
      // Anthropic potrebbe non avere endpoint /models pubblico
      console.log('Note: Anthropic might not have a public /models endpoint');
      console.log('Response:', JSON.stringify(data, null, 2));

      // Prova modelli conosciuti
      console.log('\n📋 Known Anthropic models (may be available):');
      const knownModels = [
        'claude-opus-4-1-20250805',  // Opus 4.1
        'claude-3-opus-20240229',
        'claude-3-5-sonnet-20241022',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1',
        'claude-2.0'
      ];

      knownModels.forEach(model => {
        console.log(`   - ${model}`);
        if (model.includes('opus-4')) {
          console.log(`     ⭐ OPUS 4.1 (se disponibile) ⭐`);
        }
      });

      return;
    }

    console.log(`Found ${data.data.length} models:\n`);

    data.data.forEach(model => {
      console.log(`  📌 ${model.id || model.model}`);
      if (model.display_name) {
        console.log(`     Name: ${model.display_name}`);
      }
      if (model.created_at) {
        console.log(`     Created: ${new Date(model.created_at).toLocaleDateString()}`);
      }

      // Check for Opus 4.1
      const modelId = (model.id || model.model || '').toLowerCase();
      if (modelId.includes('opus-4') || modelId.includes('opus-4.1')) {
        console.log(`     ⭐ OPUS 4.1 FOUND! ⭐`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error fetching Anthropic models:', error.message);

    // Lista modelli conosciuti come fallback
    console.log('\n📋 Known Anthropic models that might be available:');
    console.log('   - claude-opus-4-1-20250805 (Opus 4.1 - Latest)');
    console.log('   - claude-3-5-sonnet-20241022 (Sonnet 3.5)');
    console.log('   - claude-3-opus-20240229 (Opus 3)');
  }
}

async function checkSpecificModels() {
  console.log('\n🎯 Checking Specific Models...\n');

  // Check for GPT-5
  try {
    console.log('Checking GPT-5...');
    const response = await fetch('https://api.openai.com/v1/models/gpt-5', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    if (response.ok) {
      const model = await response.json();
      console.log('✅ GPT-5 is available!');
      console.log('   Details:', JSON.stringify(model, null, 2));
    } else {
      console.log('❌ GPT-5 not found (404 or other error)');
    }
  } catch (error) {
    console.log('❌ Error checking GPT-5:', error.message);
  }

  // Check for Opus 4.1
  console.log('\nNote: Claude Opus 4.1 (claude-opus-4-1-20250805) is the model you are currently using!');
  console.log('This is the latest and most advanced Anthropic model.');
}

// Run all checks
async function main() {
  console.log('🤖 AI Model Availability Check');
  console.log('================================');

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error('❌ No API keys found in .env file');
    return;
  }

  if (process.env.OPENAI_API_KEY) {
    await checkOpenAIModels();
  } else {
    console.log('⚠️  OpenAI API key not configured');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    await checkAnthropicModels();
  } else {
    console.log('⚠️  Anthropic API key not configured');
  }

  await checkSpecificModels();
}

main().catch(console.error);