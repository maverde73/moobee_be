const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3000/api/login', {
      email: 'admin@moobee.com',
      password: 'SecureAdminPass123!'
    });

    console.log('✅ Login successful!');
    console.log('Token:', response.data.accessToken);

    // Now test fetching users
    if (response.data.accessToken) {
      const usersResponse = await axios.get(
        'http://localhost:3000/api/tenants/b1234567-89ab-cdef-0123-456789abcdef/users',
        {
          headers: {
            'Authorization': `Bearer ${response.data.accessToken}`
          }
        }
      );

      console.log('\n✅ Users fetched successfully!');
      console.log('Full response:', JSON.stringify(usersResponse.data, null, 2));

      const users = usersResponse.data.data || usersResponse.data.users || [];
      console.log('Number of users:', users.length);

      if (users.length > 0) {
        console.log('\nUsers list:');
        users.forEach(user => {
          console.log(`  - ${user.first_name} ${user.last_name} (${user.email})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testLogin();