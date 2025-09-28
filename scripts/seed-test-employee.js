const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedTestEmployee() {
  try {
    // First, check if we have a tenant
    let tenant = await prisma.tenants.findFirst();

    if (!tenant) {
      // Create a test tenant if none exists
      tenant = await prisma.tenants.create({
        data: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'Test Company',
          code: 'TEST001',
          industry: 'Technology',
          size: 'medium',
          subscription_plan: 'professional',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log('✅ Created test tenant:', tenant.name);
    }

    // Check if we have a department
    let department = await prisma.departments.findFirst({
      where: { tenant_id: tenant.id }
    });

    if (!department) {
      // Create a test department
      department = await prisma.departments.create({
        data: {
          department_name: 'Engineering',
          department_code: 'ENG',
          manager_id: null,
          parent_department_id: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          tenant_id: tenant.id
        }
      });
      console.log('✅ Created test department:', department.department_name);
    }

    // Check if admin employee exists
    const existingEmployee = await prisma.employees.findFirst({
      where: {
        email: 'admin@moobee.com',
        tenant_id: tenant.id
      }
    });

    if (existingEmployee) {
      console.log('ℹ️  Admin employee already exists');
    } else {
      // Create admin employee
      const adminEmployee = await prisma.employees.create({
        data: {
          email: 'admin@moobee.com',
          first_name: 'Admin',
          last_name: 'User',
          employee_code: 'EMP001',
          position: 'System Administrator',
          department_id: department.id,
          phone: '+1234567890',
          is_active: true,
          tenant_id: tenant.id,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      console.log('✅ Created admin employee:', adminEmployee.email);

      // Skip role assignment for now - roles table has different schema
      console.log('ℹ️  Skipping role assignment (roles table schema mismatch)');
    }

    // Create additional test employees
    const testEmployees = [
      {
        email: 'john.doe@moobee.com',
        first_name: 'John',
        last_name: 'Doe',
        employee_code: 'EMP002',
        position: 'Senior Developer'
      },
      {
        email: 'jane.smith@moobee.com',
        first_name: 'Jane',
        last_name: 'Smith',
        employee_code: 'EMP003',
        position: 'Product Manager'
      },
      {
        email: 'bob.johnson@moobee.com',
        first_name: 'Bob',
        last_name: 'Johnson',
        employee_code: 'EMP004',
        position: 'UX Designer'
      }
    ];

    for (const empData of testEmployees) {
      const existing = await prisma.employees.findFirst({
        where: {
          email: empData.email,
          tenant_id: tenant.id
        }
      });

      if (!existing) {
        await prisma.employees.create({
          data: {
            ...empData,
            department_id: department.id,
            phone: '+1234567890',
            is_active: true,
            tenant_id: tenant.id,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        console.log(`✅ Created employee: ${empData.email}`);
      }
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('🔐 Login credentials:');
    console.log('   Email: admin@moobee.com');
    console.log('   Password: Password123!');
    console.log('   (Note: Password validation is hardcoded in authService.js for demo purposes)');

  } catch (error) {
    console.error('❌ Error seeding test employee:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestEmployee();