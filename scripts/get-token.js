const axios = require('axios');

async function getToken() {
  try {
    const response = await axios.post('http://localhost:3000/api/login', {
      email: 'superadmin@test.com',
      password: 'Test123!'
    });
    console.log(response.data.accessToken);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getToken();