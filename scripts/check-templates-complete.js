const axios = require('axios');

async function checkTemplates() {
  try {
    // Login first
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      email: 'superadmin@test.com',
      password: 'Test123!'
    });

    const token = loginResponse.data.accessToken;

    // Get templates
    const response = await axios.get('http://localhost:3000/api/engagement/templates?page=1&limit=20', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`\n✅ Trovati ${response.data.data.length} template di engagement:\n`);
    console.log('=' .repeat(80));

    response.data.data.forEach((template, index) => {
      const roles = template.suggested_roles ?
        (typeof template.suggested_roles === 'object' ?
          Object.values(template.suggested_roles).join(', ') :
          'N/A') : 'N/A';

      const questionsCount = template._count?.questions || template.questions?.length || 0;
      const promptSaved = template.ai_prompt ? `SI (${template.ai_prompt.length} caratteri)` : 'NO';

      console.log(`📋 Template ${index + 1}: ${template.title || template.name}`);
      console.log(`   Tipo: ${template.type}`);
      console.log(`   Status: ${template.status}`);
      console.log(`   Ruoli: ${roles}`);
      console.log(`   Domande: ${questionsCount}`);
      console.log(`   AI Provider: ${template.ai_provider || 'N/A'}`);
      console.log(`   AI Model: ${template.ai_model || 'N/A'}`);
      console.log(`   Prompt salvato: ${promptSaved}`);

      if (template.ai_prompt) {
        // Mostra prime 100 caratteri del prompt
        const promptPreview = template.ai_prompt.substring(0, 100);
        console.log(`   Anteprima prompt: "${promptPreview}..."`);
      }

      console.log('-' .repeat(80));
    });

    // Statistiche
    const totalTemplates = response.data.data.length;
    const templatesWithPrompt = response.data.data.filter(t => t.ai_prompt).length;
    const templatesWithQuestions = response.data.data.filter(t => (t._count?.questions || t.questions?.length || 0) > 0).length;

    console.log('\n📊 STATISTICHE:');
    console.log(`   Template totali: ${totalTemplates}`);
    console.log(`   Con prompt salvato: ${templatesWithPrompt} (${Math.round(templatesWithPrompt/totalTemplates*100)}%)`);
    console.log(`   Con domande generate: ${templatesWithQuestions} (${Math.round(templatesWithQuestions/totalTemplates*100)}%)`);
    console.log('');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkTemplates();