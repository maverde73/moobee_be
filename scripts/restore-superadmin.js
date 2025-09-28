/**
 * Script to restore superadmin user after database reset
 * Run with: node scripts/restore-superadmin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function restoreSuperAdmin() {
  try {
    console.log('🔄 Restoring superadmin user...');

    // Check if superadmin already exists
    const existing = await prisma.tenant_users.findFirst({
      where: { email: 'superadmin@moobee.com' }
    });

    if (existing) {
      console.log('✅ Superadmin already exists');
      return;
    }

    // Hash the default password
    const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);

    // Create superadmin user with generated UUID
    const superadminId = uuidv4();
    const superadmin = await prisma.tenant_users.create({
      data: {
        id: superadminId,
        email: 'superadmin@moobee.com',
        password_hash: hashedPassword,
        role: 'super_admin',
        tenant_id: 'GLOBAL', // Super admin doesn't belong to a specific tenant
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log('✅ Superadmin user restored successfully');
    console.log('📧 Email: superadmin@moobee.com');
    console.log('🔑 Password: SuperAdmin123!');
    console.log('🆔 User ID:', superadmin.id);

  } catch (error) {
    console.error('❌ Error restoring superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSuperAdmin();