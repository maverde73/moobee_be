const prisma = require('./src/config/database');

async function checkEmployee() {
  try {
    const employee = await prisma.employees.findUnique({
      where: { id: 166 },
      include: {
        tenant_user: true,
        departments_employees_department_idTodepartments: true
      }
    });

    if (employee) {
      console.log('✅ Employee ID 166 trovato:');
      console.log('Nome:', employee.first_name, employee.last_name);
      console.log('Email:', employee.email);
      console.log('Tenant ID:', employee.tenant_id);
      console.log('Department:', employee.departments_employees_department_idTodepartments?.department_name || 'N/D');
      console.log('Has tenant_user:', !!employee.tenant_user);
    } else {
      console.log('❌ Employee ID 166 NON trovato');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Errore:', error);
    await prisma.$disconnect();
  }
}

checkEmployee();