const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function generateToken() {
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

    // Get an employee from Nexadata (role is lowercase in DB)
    const employee = await prisma.tenant_users.findFirst({
      where: {
        tenant_id: tenant.id,
        role: 'employee'
      }
    });

    if (employee) {
      const payload = {
        id: employee.id,
        tenant_id: employee.tenant_id,
        email: employee.email,
        role: employee.role
      };

      const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production', { expiresIn: '1h' });
      console.log('Employee:', employee.email);
      console.log('Token:', token);
      console.log('\nTest the API with:');
      console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/assessments/my-assignments?status=ASSIGNED,IN_PROGRESS`);
    } else {
      console.log('No employee found');
    }
  } catch(error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateToken();