const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findEmployees() {
  const cvNames = [
    'Andrea Lomonaco',
    'Claudio Huang',
    'Alessandro Dompè',
    'Fabio Valentini',
    'Francesco Cifaldi',
    'Paola Tirelli',
    'Andrea Cutolo',
    'Thomas Romano',
    'Alessandro Zoia',
    'Pacetti',
    'Matteo Lamacchia',
    'Mirco Carnevale',
    'Simone Crescenzi',
    'Roberto Ortenzi',
    'Giampà',
    'Antonio Russo',
    'Giampaolo Nardoni',
    'Elena Voytovich',
    'Flavio Prosperi',
    'Leonardo Fanicchia',
    'Mauro Giambenedetti',
    'Christian Abd El Messih',
    'Renato Bova',
    'Marco Esposito',
    'Alessio Sardaro',
    'Valerio Sellan',
    'Davide Simone',
    'Rosario Biasco',
    'Elisa'
  ];

  console.log('\n🔍 Searching for employees with CVs...\n');

  for (const name of cvNames) {
    const parts = name.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const employees = await prisma.employees.findMany({
      where: {
        OR: [
          { first_name: { contains: firstName, mode: 'insensitive' } },
          { last_name: { contains: lastName, mode: 'insensitive' } }
        ],
        is_active: true
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        tenant_id: true
      }
    });

    if (employees.length > 0) {
      console.log(`✓ ${name}:`);
      employees.forEach(emp => {
        console.log(`  ID: ${emp.id} | ${emp.first_name} ${emp.last_name} | ${emp.email}`);
      });
    }
  }

  await prisma.$disconnect();
}

findEmployees();
