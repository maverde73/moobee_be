// Script to create test users for unified authentication system
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creating test users for unified authentication...\n');

    // Get or create default tenant
    let tenant = await prisma.tenants.findFirst({
      where: {
        OR: [
          { slug: 'moobee' },
          { id: 'b1234567-89ab-cdef-0123-456789abcdef' }
        ]
      }
    });

    if (!tenant) {
      tenant = await prisma.tenants.create({
        data: {
          slug: 'moobee',
          name: 'Moobee Platform',
          domain: 'moobee.com',
          email: 'admin@moobee.com',
          subscription_plan: 'enterprise',
          subscription_status: 'active'
        }
      });
      console.log('✅ Created Moobee tenant');
    } else {
      console.log('✅ Using existing tenant:', tenant.name);
    }

    // Test users data
    const testUsers = [
      {
        email: 'superadmin@moobee.com',
        password: 'SuperAdmin123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin'
      },
      {
        email: 'admin@moobee.com',
        password: 'Admin123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
      },
      {
        email: 'hr@moobee.com',
        password: 'HR123!',
        firstName: 'HR',
        lastName: 'Manager',
        role: 'hr'
      },
      {
        email: 'employee@moobee.com',
        password: 'Employee123!',
        firstName: 'John',
        lastName: 'Employee',
        role: 'employee'
      }
    ];

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.tenant_users.findFirst({
        where: { email: userData.email }
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists, updating password...`);

        // Update password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        await prisma.tenant_users.update({
          where: { id: existingUser.id },
          data: {
            password_hash: hashedPassword,
            role: userData.role,
            is_active: true
          }
        });

        console.log(`✅ Updated ${userData.email} with password: ${userData.password}`);
      } else {
        // Create new user
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // If role is employee or hr, create employee record first
        let employeeId = null;
        if (userData.role === 'employee' || userData.role === 'hr') {
          const employee = await prisma.employees.create({
            data: {
              first_name: userData.firstName,
              last_name: userData.lastName,
              email: userData.email,
              hire_date: new Date(),
              tenant_id: tenant.id,
              position: userData.role === 'hr' ? 'HR Manager' : 'Software Developer',
              is_active: true
            }
          });
          employeeId = employee.id;
        }

        // Create tenant_user
        await prisma.tenant_users.create({
          data: {
            tenant_id: tenant.id,
            email: userData.email,
            password_hash: hashedPassword,
            role: userData.role,
            employee_id: employeeId,
            is_active: true
          }
        });

        console.log(`✅ Created ${userData.email} with password: ${userData.password}`);
      }
    }

    console.log('\n🎉 Test users created successfully!');
    console.log('\n📝 Login credentials:');
    console.log('-------------------');
    testUsers.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email} / ${user.password}`);
    });

    console.log('\n🔗 Redirection logic:');
    console.log('-------------------');
    console.log('super_admin, admin → http://localhost:5174 (FE_tenant)');
    console.log('hr, employee → http://localhost:5173 (FE_moobee)');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();