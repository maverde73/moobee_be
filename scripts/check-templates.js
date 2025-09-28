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

    response.data.data.forEach((template, index) => {
      const roles = template.suggested_roles ?
        (typeof template.suggested_roles === 'object' ?
          Object.values(template.suggested_roles).join(', ') :
          'N/A') : 'N/A';

      const questionsCount = template._count?.questions || template.questions?.length || 0;

      console.log(`${index + 1}. ${template.title || template.name}`);
      console.log(`   Tipo: ${template.type}`);
      console.log(`   Ruoli: ${roles}`);
      console.log(`   Domande: ${questionsCount}`);
      console.log(`   AI Model: ${template.ai_model || 'N/A'}`);
      console.log(`   Status: ${template.status}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkTemplates();