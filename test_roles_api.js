const axios = require('axios');

async function testRolesAPI() {
  try {
    // Login
    const loginRes = await axios.post('http://localhost:3000/api/login', {
      email: 'fvalentini@nexadata.it',
      password: 'Password123!'
    });

    const token = loginRes.data.accessToken;
    console.log('✅ Login successful\n');

    // Get full profile
    const profileRes = await axios.get('http://localhost:3000/api/employees/91/full', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('📋 Full Profile Response:');
    console.log(JSON.stringify(profileRes.data, null, 2));

    // Get roles endpoint
    const rolesRes = await axios.get('http://localhost:3000/api/employees/91/roles', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('\n📋 Roles Endpoint Response:');
    console.log(JSON.stringify(rolesRes.data, null, 2));

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testRolesAPI();
