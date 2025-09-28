const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const employees = await prisma.employee.findMany({
      take: 5,
      select: {
        email: true,
        name: true,
        isActive: true
      }
    });

    if (employees.length > 0) {
      console.log('Available employees:');
      employees.forEach(e => {
        console.log('  -', e.email, '(' + e.name + ')',
          e.isActive ? 'Active' : 'Inactive');
      });
    } else {
      console.log('No employees found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
