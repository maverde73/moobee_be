const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateUserNames() {
  console.log('🔧 Updating user names in database...\n');

  // Update Roberta Maiello
  const maiello = await prisma.employees.findFirst({
    where: { email: 'rmaiello@nexadata.it' }
  });

  if (maiello && (!maiello.first_name || !maiello.last_name)) {
    console.log('Updating Maiello employee record...');
    await prisma.employees.update({
      where: { id: maiello.id },
      data: {
        first_name: maiello.first_name || 'Roberta',
        last_name: maiello.last_name || 'Maiello'
      }
    });
    console.log('✅ Updated');
  } else if (maiello) {
    console.log(`Maiello already has names: ${maiello.first_name} ${maiello.last_name}`);
  }

  // Ensure all Nexadata employees have names
  const nexaEmployees = await prisma.employees.findMany({
    where: {
      email: { endsWith: '@nexadata.it' },
      OR: [
        { first_name: null },
        { last_name: null },
        { first_name: '' },
        { last_name: '' }
      ]
    }
  });

  if (nexaEmployees.length > 0) {
    console.log(`\nFound ${nexaEmployees.length} employees without names. Updating...`);
    
    for (const emp of nexaEmployees) {
      // Extract name from email
      const emailParts = emp.email.split('@')[0];
      const firstName = emailParts.charAt(0).toUpperCase() + emailParts.slice(1);
      
      await prisma.employees.update({
        where: { id: emp.id },
        data: {
          first_name: emp.first_name || firstName,
          last_name: emp.last_name || 'User'
        }
      });
      console.log(`  Updated: ${emp.email}`);
    }
  }

  await prisma.$disconnect();
  console.log('\n✨ Done!');
}

updateUserNames();
