/**
 * Simple API Test
 */

const axios = require('axios');

async function testAPI() {
  try {
    // 1. Login
    console.log('🔐 Login...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'john.doe@example.com',
      password: 'Password123!'
    });

    const token = loginRes.data.accessToken;
    console.log('✅ Login successful, token:', token ? 'received' : 'missing');

    // 2. Test role requirements
    console.log('\n📊 Testing role skill requirements...');
    try {
      const res = await axios.get('http://localhost:3000/api/roles/37/skill-requirements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Role requirements response:', res.data.success ? 'SUCCESS' : 'FAILED');
      if (res.data.success) {
        console.log(`   Role: ${res.data.roleName}`);
        console.log(`   Total requirements: ${res.data.totalRequirements}`);
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // 3. Test templates for role
    console.log('\n📋 Testing recommended templates...');
    try {
      const res = await axios.get('http://localhost:3000/api/assessments/roles/37/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Templates response:', res.data.success ? 'SUCCESS' : 'FAILED');
      if (res.data.success) {
        console.log(`   Templates found: ${res.data.count}`);
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Fatal error:', error.response?.data || error.message);
  }
}

testAPI();