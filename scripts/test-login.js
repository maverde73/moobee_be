const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3000/api/login', {
      email: 'superadmin@test.com',
      password: 'Test123!'
    });

    console.log('Success:', response.data);

    if (response.data.access_token) {
      console.log('\n✅ Access token received!');
      console.log('Token:', response.data.access_token);
    } else if (response.data.token) {
      console.log('\n✅ Token received!');
      console.log('Token:', response.data.token);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testLogin();