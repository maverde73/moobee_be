/**
 * Script to restore essential data after database reset
 * Run with: node scripts/restore-all-data.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function restoreAllData() {
  try {
    console.log('🔄 Restoring essential data...\n');

    // 1. Create or find global tenant
    let globalTenant = await prisma.tenants.findFirst({
      where: { slug: 'global' }
    });

    if (!globalTenant) {
      const tenantId = uuidv4();
      globalTenant = await prisma.tenants.create({
        data: {
          id: tenantId,
          slug: 'global',
          name: 'Global Admin Tenant',
          domain: 'moobee.com',
          is_active: true,
          created_at: new Date()
        }
      });
      console.log('✅ Created global tenant');
    } else {
      console.log('ℹ️  Global tenant already exists');
    }

    // 2. Create superadmin user
    const existingAdmin = await prisma.tenant_users.findFirst({
      where: { email: 'superadmin@moobee.com' }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      const adminId = uuidv4();

      const superadmin = await prisma.tenant_users.create({
        data: {
          id: adminId,
          email: 'superadmin@moobee.com',
          password_hash: hashedPassword,
          role: 'super_admin',
          tenant_id: globalTenant.id,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      console.log('✅ Created superadmin user');
      console.log('📧 Email: superadmin@moobee.com');
      console.log('🔑 Password: SuperAdmin123!');
    } else {
      console.log('ℹ️  Superadmin already exists');
    }

    // 3. Create demo tenant
    let demoTenant = await prisma.tenants.findFirst({
      where: { slug: 'demo' }
    });

    if (!demoTenant) {
      const demoTenantId = uuidv4();
      demoTenant = await prisma.tenants.create({
        data: {
          id: demoTenantId,
          slug: 'demo',
          name: 'Demo Company',
          domain: 'demo.moobee.com',
          is_active: true,
          created_at: new Date()
        }
      });
      console.log('✅ Created demo tenant');
    } else {
      console.log('ℹ️  Demo tenant already exists');
    }

    // 4. Create demo admin user
    const existingDemoAdmin = await prisma.tenant_users.findFirst({
      where: {
        email: 'admin@demo.com',
        tenant_id: demoTenant.id
      }
    });

    if (!existingDemoAdmin) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      const demoAdminId = uuidv4();

      await prisma.tenant_users.create({
        data: {
          id: demoAdminId,
          email: 'admin@demo.com',
          password_hash: hashedPassword,
          role: 'admin',
          tenant_id: demoTenant.id,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      console.log('✅ Created demo admin user');
      console.log('📧 Email: admin@demo.com');
      console.log('🔑 Password: Admin123!');
    } else {
      console.log('ℹ️  Demo admin already exists');
    }

    console.log('\n✨ Data restoration complete!');
    console.log('\n📝 Available logins:');
    console.log('  Super Admin: superadmin@moobee.com / SuperAdmin123!');
    console.log('  Demo Admin: admin@demo.com / Admin123!');

  } catch (error) {
    console.error('❌ Error restoring data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreAllData();