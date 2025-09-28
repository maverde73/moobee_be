/**
 * Generate a test token for API testing
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Test user data matching the tenant we're working with
const testUser = {
  id: 'f6b96b8e-2d72-48c5-9b56-de01c81d3b3b',
  tenantId: 'bcfd81a9-7e40-4692-8008-469f3ca223f7', // The tenant with engagement templates
  email: 'hr@test.com',
  role: 'hr_manager'
};

// Generate token with 7 day expiry
const token = jwt.sign(
  {
    id: testUser.id,
    tenantId: testUser.tenantId,
    email: testUser.email,
    role: testUser.role
  },
  process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
  { expiresIn: '7d' }
);

console.log('Generated test token:\n');
console.log(token);
console.log('\nUser info:', testUser);
console.log('\nToken expires in 7 days');