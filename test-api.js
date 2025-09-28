const jwt = require('jsonwebtoken');
require('dotenv').config();

// Generate a test token for Nexadata
// Use the actual tenant UUID from the database
const testUser = {
  id: 'test-user-id',
  email: 'rmaiello@nexadata.it',  // Use a real user email
  tenant_id: 'f5eafcce-26af-4699-aa97-dd8829621406',  // Actual Nexadata tenant UUID
  tenantId: 'f5eafcce-26af-4699-aa97-dd8829621406',  // Also add without underscore
  role: 'HR_MANAGER'
};

const token = jwt.sign(testUser, process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production', {
  expiresIn: '1h'
});

console.log('Token:', token);

// Test the API
const axios = require('axios');

async function testAPI() {
  try {
    const response = await axios.get('http://localhost:3000/api/employees', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 3
      }
    });

    console.log('\n=== API Response ===');
    console.log('Success:', response.data.success);

    if (response.data.data?.employees) {
      console.log('\n=== Employees ===');
      response.data.data.employees.forEach(emp => {
        console.log(`ID: ${emp.id}`);
        console.log(`Name: ${emp.name}`);
        console.log(`First: ${emp.first_name}`);
        console.log(`Last: ${emp.last_name}`);
        console.log(`Email: ${emp.email}`);
        console.log('---');
      });
    }
  } catch (error) {
    if (error.response) {
      console.log('Error:', error.response.status, error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testAPI();