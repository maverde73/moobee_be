const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRoles() {
  try {
    // Get distinct roles from employee_roles table
    const employeeRoles = await prisma.employee_roles.findMany({
      distinct: ['role_name'],
      select: {
        role_name: true
      },
      where: {
        role_name: {
          not: null
        }
      },
      take: 30
    });

    console.log('Found roles:', employeeRoles.length);

    // Filter and prepare role list
    const rolesList = employeeRoles
      .filter(r => r.role_name)
      .map(r => r.role_name);

    console.log('Available roles:');
    rolesList.forEach((role, i) => {
      console.log(`${i + 1}. ${role}`);
    });

    return rolesList;
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getRoles();