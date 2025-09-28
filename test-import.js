const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testImport() {
  try {
    // First login as super admin
    console.log('Logging in as super admin...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@moobee.com',
      password: 'SecureAdminPass123!'
    });

    const token = loginResponse.data.access_token;
    console.log('Login successful, token obtained');

    // Prepare the CSV file
    const csvPath = '/home/mgiurelli/sviluppo/moobee/docs/utenti nexa.csv';
    const form = new FormData();
    form.append('file', fs.createReadStream(csvPath), 'utenti nexa.csv');

    // Upload the CSV
    console.log('\nUploading CSV file...');
    const importResponse = await axios.post(
      'http://localhost:3000/api/tenants/b1234567-89ab-cdef-0123-456789abcdef/users/import',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('\nImport Response:', JSON.stringify(importResponse.data, null, 2));

    // Now check if users were created
    console.log('\nFetching users to verify import...');
    const usersResponse = await axios.get(
      'http://localhost:3000/api/tenants/b1234567-89ab-cdef-0123-456789abcdef/users',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log(`\nTotal users after import: ${usersResponse.data.users.length}`);
    if (usersResponse.data.users.length > 0) {
      console.log('\nFirst 5 users:');
      usersResponse.data.users.slice(0, 5).forEach(user => {
        console.log(`- ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role}`);
      });
    }

  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testImport();