const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  try {
    console.log('Checking/Creating Moobee tenant and super admin...');

    // Check if Moobee tenant exists
    let tenant = await prisma.tenants.findUnique({
      where: { id: 'bec3cb9d-173e-4790-aaa0-98d7aa7ea387' }
    });

    if (!tenant) {
      // Create Moobee tenant
      tenant = await prisma.tenants.create({
        data: {
          id: 'bec3cb9d-173e-4790-aaa0-98d7aa7ea387',
          slug: 'moobee',
          name: 'Moobee',
          email: 'info@moobee.com',
          is_deleted: false,
          is_active: true,
          subscription_plan: 'enterprise',
          subscription_status: 'active',
          max_employees: 1000,
          isActive: true,
          plan: 'enterprise',
          maxUsers: 1000
        }
      });
      console.log('✅ Tenant created:', tenant.name);
    } else {
      console.log('✅ Tenant already exists:', tenant.name);
    }

    // Check if super admin user exists
    let user = await prisma.tenant_users.findFirst({
      where: {
        email: 'superadmin@moobee.com',
        tenant_id: tenant.id
      }
    });

    if (!user) {
      // Create super admin user
      const passwordHash = await bcrypt.hash('SuperAdmin123!', 10);
      user = await prisma.tenant_users.create({
        data: {
          id: uuidv4(),
          tenant_id: tenant.id,
          email: 'superadmin@moobee.com',
          password_hash: passwordHash,
          role: 'super_admin',
          is_active: true
        }
      });
      console.log('✅ Super admin created:', user.email);
    } else {
      console.log('✅ Super admin already exists:', user.email);
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('Login credentials:');
    console.log('Email: superadmin@moobee.com');
    console.log('Password: SuperAdmin123!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();