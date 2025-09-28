const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLink() {
  // Find employee 79
  const employee = await prisma.employees.findFirst({
    where: { id: 79 }
  });

  if (employee) {
    console.log('Employee 79:', employee.email);
    
    // Find matching tenant_user
    const tenantUser = await prisma.tenant_users.findFirst({
      where: { email: employee.email }
    });

    if (tenantUser) {
      console.log('Tenant user found:', {
        email: tenantUser.email,
        employee_id: tenantUser.employee_id,
        role: tenantUser.role
      });

      if (!tenantUser.employee_id) {
        console.log('\nUpdating employee_id link...');
        await prisma.tenant_users.update({
          where: { id: tenantUser.id },
          data: { employee_id: 79 }
        });
        console.log('✅ Updated!');
      }
    }
  }

  await prisma.$disconnect();
}

checkLink();
