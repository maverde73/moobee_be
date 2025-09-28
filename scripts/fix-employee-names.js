const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEmployeeNames() {
  try {
    console.log('\n=== Fixing Employee Names ===\n');

    // 1. Check employees without names
    const employeesWithoutNames = await prisma.employees.findMany({
      where: {
        tenant_id: 'nexadata'  // Focus on nexadata first
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        position: true
      }
    });

    console.log(`Found ${employeesWithoutNames.length} Nexadata employees\n`);

    // Check which ones have empty names
    const emptyNames = employeesWithoutNames.filter(e => !e.first_name || !e.last_name || e.first_name === '' || e.last_name === '');
    console.log(`Employees with missing names: ${emptyNames.length}\n`);

    // 2. Try to get names from email
    for (const employee of employeesWithoutNames) {
      let firstName = employee.first_name;
      let lastName = employee.last_name;

      // If still no name, extract from email
      if (!firstName && !lastName && employee.email) {
        const emailPart = employee.email.split('@')[0];
        // Try to parse email like "nome.cognome@domain.com"
        if (emailPart.includes('.')) {
          const parts = emailPart.split('.');
          firstName = firstName || parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          lastName = lastName || parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        } else {
          // Use email prefix as first name
          firstName = firstName || emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
        }
      }

      // Update if we have new data
      if (firstName !== employee.first_name || lastName !== employee.last_name) {
        console.log(`Updating Employee ID ${employee.id}:`);
        console.log(`  Email: ${employee.email}`);
        console.log(`  Old: "${employee.first_name || 'NULL'}" "${employee.last_name || 'NULL'}"`);
        console.log(`  New: "${firstName || 'NULL'}" "${lastName || 'NULL'}"`);

        await prisma.employees.update({
          where: { id: employee.id },
          data: {
            first_name: firstName || null,
            last_name: lastName || null
          }
        });
        console.log('  ✓ Updated\n');
      }
    }

    // 3. Verify results
    const stillWithoutNames = await prisma.employees.count({
      where: {
        AND: [
          { OR: [{ first_name: null }, { first_name: '' }] },
          { OR: [{ last_name: null }, { last_name: '' }] }
        ]
      }
    });

    console.log('\n=== Summary ===');
    console.log(`Employees still without names: ${stillWithoutNames}`);

    // Show some examples of updated employees
    const examples = await prisma.employees.findMany({
      where: {
        tenant_id: 'nexadata'
      },
      take: 5,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true
      }
    });

    console.log('\n=== Sample Nexadata Employees ===');
    examples.forEach(e => {
      console.log(`${e.first_name} ${e.last_name} (${e.email})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmployeeNames();