const axios = require('axios');

async function testAssessmentAPI() {
  const baseURL = 'http://localhost:3000/api';
  
  console.log('1. Test senza autenticazione:');
  try {
    const res1 = await axios.get(`${baseURL}/assessments/templates`);
    console.log('   ✅ Pubblico - Templates trovati:', res1.data.data.length);
    console.log('   Primo template:', res1.data.data[0]?.name);
  } catch (err) {
    console.log('   ❌ Errore:', err.response?.status, err.response?.data?.message);
  }

  console.log('\n2. Test con parametri:');
  try {
    const res2 = await axios.get(`${baseURL}/assessments/templates?limit=50`);
    console.log('   ✅ Templates trovati:', res2.data.data.length);
    console.log('   Templates:', res2.data.data.map(t => ({ id: t.id, name: t.name, type: t.type })));
  } catch (err) {
    console.log('   ❌ Errore:', err.response?.status);
  }

  console.log('\n3. Test template singolo:');
  try {
    const templates = await axios.get(`${baseURL}/assessments/templates`);
    if (templates.data.data.length > 0) {
      const firstId = templates.data.data[0].id;
      const res3 = await axios.get(`${baseURL}/assessments/templates/${firstId}`);
      console.log('   ✅ Template trovato:', res3.data.name);
    }
  } catch (err) {
    console.log('   ❌ Errore:', err.response?.status);
  }
}

testAssessmentAPI();
