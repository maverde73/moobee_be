const jwt = require('jsonwebtoken');
require('dotenv').config();

// Create a test token for super_admin
const payload = {
  id: 1,
  username: 'superadmin@test.com',
  role: 'super_admin',
  tenantId: null,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};

const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production');

console.log('Super Admin Test Token:');
console.log(token);
console.log('\nPayload:', payload);