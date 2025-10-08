const axios = require('axios');

async function testLogin() {
  console.log('\n🧪 Testing login for CV sample employees...\n');

  const testUsers = [
    'mlamacchia@nexadata.it',
    'alomonaco@nexadata.it',
    'fvalentini@nexadata.it'
  ];

  for (const email of testUsers) {
    try {
      const response = await axios.post('http://localhost:3000/api/login', {
        email,
        password: 'Password123!'
      });

      if (response.data.success) {
        console.log(`✅ ${email.padEnd(30)} - Login OK`);
        console.log(`   Role: ${response.data.userType}`);
        console.log(`   Must change pwd: ${response.data.mustChangePassword || false}`);
      } else {
        console.log(`❌ ${email.padEnd(30)} - ${response.data.message}`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${email.padEnd(30)} - ${error.response.data.message || error.response.statusText}`);
      } else {
        console.log(`❌ ${email.padEnd(30)} - ${error.message}`);
      }
    }
  }

  console.log('\n');
}

testLogin();
