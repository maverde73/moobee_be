const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function importUsers() {
  try {
    console.log('Starting direct import of Nexa Data users...');

    const tenantId = 'b1234567-89ab-cdef-0123-456789abcdef';

    // First, find or create IT and HR departments
    let itDept = await prisma.departments.findFirst({
      where: {
        tenant_id: tenantId,
        department_name: 'IT'
      }
    });

    if (!itDept) {
      itDept = await prisma.departments.create({
        data: {
          tenant_id: tenantId,
          department_name: 'IT',
          is_active: true
        }
      });
      console.log('Created IT department with ID:', itDept.id);
    } else {
      console.log('Found IT department with ID:', itDept.id);
    }

    let hrDept = await prisma.departments.findFirst({
      where: {
        tenant_id: tenantId,
        OR: [
          { department_name: 'HR' },
          { department_name: 'Human Resources' }
        ]
      }
    });

    if (!hrDept) {
      hrDept = await prisma.departments.create({
        data: {
          tenant_id: tenantId,
          department_name: 'HR',
          is_active: true
        }
      });
      console.log('Created HR department with ID:', hrDept.id);
    } else {
      console.log('Found HR department with ID:', hrDept.id);
    }

    // Sample users to import (first 5 from CSV)
    const users = [
      { email: 'afigliolini@nexadata.it', firstName: 'Alessandro', lastName: 'Figliolini', role: 'employee' },
      { email: 'azoia@nexadata.it', firstName: 'Alessandro', lastName: 'Zoia', role: 'employee' },
      { email: 'afichera@nexadata.it', firstName: 'Anita', lastName: 'Fichera', role: 'hr' },
      { email: 'egiurelli@nexadata.it', firstName: 'Elena', lastName: 'Giurelli', role: 'hr' },
      { email: 'mgiurelli@nexadata.it', firstName: 'Massimiliano', lastName: 'Giurelli', role: 'hr' }
    ];

    const defaultPassword = await bcrypt.hash('Tmp_pwd', 10);
    let created = 0, skipped = 0;

    for (const user of users) {
      try {
        // Check if user already exists
        const existing = await prisma.tenant_users.findFirst({
          where: {
            email: user.email,
            tenant_id: tenantId
          }
        });

        if (existing) {
          console.log(`User ${user.email} already exists, skipping`);
          skipped++;
          continue;
        }

        // Determine department based on role
        const departmentId = user.role === 'hr' ? hrDept.id : itDept.id;

        // Create user in both tables using transaction
        await prisma.$transaction(async (tx) => {
          // Create in tenant_users
          const tenantUser = await tx.tenant_users.create({
            data: {
              tenant_id: tenantId,
              email: user.email,
              password_hash: defaultPassword,
              first_name: user.firstName,
              last_name: user.lastName,
              role: user.role,
              is_active: true
            }
          });

          // Create in employees
          await tx.employees.create({
            data: {
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              department_id: departmentId,
              tenant_id: tenantId,
              is_active: true,
              hire_date: null
            }
          });

          console.log(`✓ Created user: ${user.email} (${user.role}) in department ${departmentId}`);
        });

        created++;
      } catch (error) {
        console.error(`Error creating user ${user.email}:`, error.message);
      }
    }

    console.log(`\nImport complete: ${created} created, ${skipped} skipped`);

    // Now verify the users were created
    const allUsers = await prisma.tenant_users.findMany({
      where: {
        tenant_id: tenantId
      },
      select: {
        email: true,
        first_name: true,
        last_name: true,
        role: true
      }
    });

    console.log(`\nTotal users in tenant_users: ${allUsers.length}`);
    allUsers.forEach(u => {
      console.log(`- ${u.email} (${u.first_name} ${u.last_name}) - Role: ${u.role}`);
    });

  } catch (error) {
    console.error('Import error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importUsers();