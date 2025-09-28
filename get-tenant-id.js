const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getTenantId() {
  try {
    const tenants = await prisma.tenants.findMany({
      take: 1,
      select: {
        id: true,
        name: true
      }
    });

    if (tenants.length > 0) {
      console.log('First tenant:');
      console.log('ID:', tenants[0].id);
      console.log('Name:', tenants[0].name);
    } else {
      console.log('No tenants found. Creating one...');
      const newTenant = await prisma.tenants.create({
        data: {
          slug: 'test-company',
          name: 'Test Company',
          email: 'admin@test.com',
          subscription_plan: 'trial',
          max_employees: 100
        }
      });
      console.log('Created tenant:');
      console.log('ID:', newTenant.id);
      console.log('Name:', newTenant.name);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getTenantId();