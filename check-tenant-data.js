const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTenantData() {
  console.log('🔍 Checking tenant data...\n');

  try {
    // Check all tenants
    const tenants = await prisma.tenants.findMany();
    console.log('All tenants in database:');
    tenants.forEach(t => {
      console.log(`  - ID: ${t.id}, Name: ${t.name}, Slug: ${t.slug}, Active: ${t.is_active}`);
    });

    // Check Nexa Data employees
    const nexaEmployees = await prisma.employees.findMany({
      where: {
        OR: [
          { email: { endsWith: '@nexadata.it' } },
          { email: { contains: 'nexadata' } }
        ]
      },
      select: {
        id: true,
        email: true,
        tenant_id: true,
        first_name: true,
        last_name: true
      }
    });

    console.log('\nNexa Data employees:');
    nexaEmployees.forEach(e => {
      console.log(`  - ${e.email} (${e.first_name} ${e.last_name}) - Tenant ID: ${e.tenant_id}`);
    });

    // Check tenant_users for rmaiello
    const rmaiello = await prisma.tenant_users.findFirst({
      where: { email: 'rmaiello@nexadata.it' }
    });

    if (rmaiello) {
      console.log('\nRoberta Maiello user:');
      console.log(`  - Email: ${rmaiello.email}`);
      console.log(`  - Role: ${rmaiello.role}`);
      console.log(`  - Tenant ID: ${rmaiello.tenant_id}`);
      console.log(`  - Active: ${rmaiello.is_active}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenantData();
