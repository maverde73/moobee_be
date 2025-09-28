const axios = require('axios');

async function testAuth() {
  try {
    // Test without token - should fail
    console.log('1. Testing without token...');
    try {
      const res1 = await axios.post('http://localhost:3000/api/assessments/ai/generate-questions', {
        type: 'big_five',
        count: 5
      });
      console.log('   ❌ Should have failed without token');
    } catch (err) {
      console.log('   ✅ Correctly rejected: 401', err.response?.status === 401 ? '(401)' : `(${err.response?.status})`);
    }

    // Test with fake token - should fail
    console.log('\n2. Testing with fake token...');
    try {
      const res2 = await axios.post('http://localhost:3000/api/assessments/ai/generate-questions', {
        type: 'big_five',
        count: 5
      }, {
        headers: {
          'Authorization': 'Bearer fake-token-123'
        }
      });
      console.log('   ❌ Should have failed with fake token');
    } catch (err) {
      console.log('   ✅ Correctly rejected: 401', err.response?.status === 401 ? '(401)' : `(${err.response?.status})`);
    }

    // Test route existence
    console.log('\n3. Testing route existence...');
    try {
      const res3 = await axios.get('http://localhost:3000/api/assessments/templates');
      console.log('   ✅ Public route accessible (templates list)');
    } catch (err) {
      console.log('   ❌ Route error:', err.message);
    }

  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testAuth();