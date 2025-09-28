/**
 * Test Certification API
 * @created 2025-09-27 18:31
 */

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3000/api';

// Generate test token
function generateTestToken() {
  return jwt.sign(
    {
      id: 'test-user',
      email: 'test@nexadata.it',
      tenantId: '3cd9555b-c4ba-4051-a043-316b395d6ba0',
      role: 'HR_MANAGER'
    },
    process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
    { expiresIn: '1h' }
  );
}

async function testCertificationAPI() {
  const token = generateTestToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('\n🔧 Testing Certification API with token...\n');

  try {
    // Test 1: Get categories
    console.log('📂 Test 1: Get Categories');
    const categories = await axios.get(`${API_URL}/certifications/categories`, { headers });
    console.log('✅ Categories:', categories.data.data);

    // Test 2: Get levels
    console.log('\n📊 Test 2: Get Levels');
    const levels = await axios.get(`${API_URL}/certifications/levels`, { headers });
    console.log('✅ Levels:', levels.data.data);

    // Test 3: Get all certifications
    console.log('\n📋 Test 3: Get All Certifications');
    const certs = await axios.get(`${API_URL}/certifications?limit=5`, { headers });
    console.log(`✅ Found ${certs.data.pagination.total} certifications`);
    console.log('Sample:', certs.data.data.slice(0, 2).map(c => `${c.code}: ${c.name}`));

    // Test 4: Search certifications
    console.log('\n🔍 Test 4: Search for AWS');
    const search = await axios.get(`${API_URL}/certifications?search=AWS`, { headers });
    console.log(`✅ Found ${search.data.data.length} matches`);
    search.data.data.forEach(c => {
      console.log(`  - ${c.name} (${c.provider})`);
    });

    // Test 5: Filter by category
    console.log('\n🏷️ Test 5: Filter by CLOUD category');
    const cloud = await axios.get(`${API_URL}/certifications?category=CLOUD`, { headers });
    console.log(`✅ Found ${cloud.data.data.length} cloud certifications`);

    // Test 6: Get single certification
    if (certs.data.data.length > 0) {
      const firstCert = certs.data.data[0];
      console.log(`\n📌 Test 6: Get certification by ID (${firstCert.code})`);
      const single = await axios.get(`${API_URL}/certifications/${firstCert.id}`, { headers });
      console.log('✅ Certification details:');
      console.log(`  - Name: ${single.data.data.name}`);
      console.log(`  - Provider: ${single.data.data.provider || 'N/A'}`);
      console.log(`  - Category: ${single.data.data.category}`);
      console.log(`  - Level: ${single.data.data.level || 'N/A'}`);
    }

    console.log('\n✅ All API tests passed successfully!\n');

  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

testCertificationAPI();