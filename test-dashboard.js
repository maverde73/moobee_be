const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function testDashboard() {
  try {
    // Get Nexadata tenant
    const tenant = await prisma.tenants.findFirst({
      where: {
        OR: [
          { name: 'Nexa data srl' },
          { domain: 'nexadata.it' }
        ]
      }
    });

    if (!tenant) {
      console.log('Nexadata tenant not found');
      return;
    }

    // Get rmaiello user
    const user = await prisma.tenant_users.findFirst({
      where: {
        email: 'rmaiello@nexadata.it',
        tenant_id: tenant.id
      }
    });

    if (user) {
      const payload = {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production', { expiresIn: '1h' });

      console.log('User found:', user.email);
      console.log('\nTesting dashboard with:');
      console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/dashboard/personal`);

      // Make the actual request
      const { default: fetch } = await import('node-fetch');
      const response = await fetch('http://localhost:3000/api/dashboard/personal', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('\nDashboard response successful!');
        console.log('Employee:', data.employee?.firstName, data.employee?.lastName);
        console.log('Position:', data.employee?.position);
        console.log('Skills count:', data.skills?.length || 0);
      } else {
        const error = await response.text();
        console.log('\nDashboard request failed:', response.status);
        console.log('Error:', error);
      }
    } else {
      console.log('User rmaiello@nexadata.it not found');
    }
  } catch(error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboard();