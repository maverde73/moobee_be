const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('SecureAdminPass123!', 10);

    const superAdmin = await prisma.tenant_users.upsert({
      where: {
        email_tenant_id: {
          email: 'admin@moobee.com',
          tenant_id: 'b1234567-89ab-cdef-0123-456789abcdef'
        }
      },
      update: {
        password_hash: hashedPassword,
        role: 'super_admin',
        first_name: 'Super',
        last_name: 'Admin',
        is_active: true
      },
      create: {
        tenant_id: 'b1234567-89ab-cdef-0123-456789abcdef', // Nexa Data tenant
        email: 'admin@moobee.com',
        password_hash: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'super_admin',
        is_active: true
      }
    });

    console.log('Super admin created/updated successfully:', superAdmin.email);
  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();