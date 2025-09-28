const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserRole() {
  console.log('🔍 Checking user roles in database...\n');

  try {
    // Check HR user role
    const hrUser = await prisma.tenant_users.findFirst({
      where: { email: 'rmaiello@nexadata.it' }
    });

    if (hrUser) {
      console.log('User: rmaiello@nexadata.it');
      console.log('Current role:', hrUser.role);
      console.log('Tenant ID:', hrUser.tenant_id);
      console.log('Is active:', hrUser.is_active);

      // Update role to 'hr_manager' if needed
      if (hrUser.role !== 'hr_manager') {
        console.log('\n⚠️  Role is not hr_manager, updating...');

        await prisma.tenant_users.update({
          where: { id: hrUser.id },
          data: { role: 'hr_manager' }
        });

        console.log('✅ Role updated to hr_manager');
      } else {
        console.log('✅ Role is already hr_manager');
      }
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await prisma.$disconnect();
}

checkUserRole();