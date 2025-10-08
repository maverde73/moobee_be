const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setPasswords() {
  console.log('\n🔐 Checking and setting passwords for CV sample employees...\n');

  const cvEmployees = [
    { email: 'alomonaco@nexadata.it', name: 'Andrea Lomonaco' },
    { email: 'chuang@nexadata.it', name: 'Claudio Huang' },
    { email: 'adompe@nexadata.it', name: 'Alessandro Dompè' },
    { email: 'fvalentini@nexadata.it', name: 'Fabio Valentini' },
    { email: 'fcifaldi@nexadata.it', name: 'Francesco Cifaldi' },
    { email: 'ptirelli@nexadata.it', name: 'Paola Tirelli' },
    { email: 'acutolo@nexadata.it', name: 'Andrea Cutolo' },
    { email: 'tromano@nexadata.it', name: 'Thomas Romano' },
    { email: 'azoia@nexadata.it', name: 'Alessandro Zoia' },
    { email: 'apacetti@nexadata.it', name: 'Alessandro Pacetti' },
    { email: 'mlamacchia@nexadata.it', name: 'Matteo Lamacchia' },
    { email: 'mcarnevale@nexadata.it', name: 'Mirco Carnevale' },
    { email: 'screscenzi@nexadata.it', name: 'Simone Crescenzi' },
    { email: 'rortenzi@nexadata.it', name: 'Roberto Ortenzi' },
    { email: 'agiampa@nexadata.it', name: 'Andrea Giampà' },
    { email: 'gnardoni@nexadata.it', name: 'Giampaolo Nardoni' },
    { email: 'evoytovich@nexadata.it', name: 'Elena Voytovich' },
    { email: 'fprosperi@nexadata.it', name: 'Flavio Prosperi' },
    { email: 'lfanicchia@nexadata.it', name: 'Leonardo Fanicchia' },
    { email: 'cabdelmessih@nexadata.it', name: 'Christian Abd El Messih' },
    { email: 'rbova@nexadata.it', name: 'Renato Bova' },
    { email: 'mesposito@nexadata.it', name: 'Marco Esposito' },
    { email: 'asardaro@nexadata.it', name: 'Alessio Sardaro' },
    { email: 'vsellan@nexadata.it', name: 'Valerio Sellan' },
    { email: 'dsimone@nexadata.it', name: 'Davide Simone' },
    { email: 'rbiasco@nexadata.it', name: 'Rosario Biasco' },
    { email: 'elisagiurelli@nexadata.it', name: 'Elisa Giurelli' }
  ];

  const targetPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(targetPassword, 10);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const emp of cvEmployees) {
    const employee = await prisma.employees.findFirst({
      where: { email: emp.email }
    });

    if (!employee) {
      console.log(`⚠️  Not found: ${emp.name} (${emp.email})`);
      notFoundCount++;
      continue;
    }

    // Check if password is correct
    let needsUpdate = true;
    if (employee.password_hash) {
      const isValid = await bcrypt.compare(targetPassword, employee.password_hash);
      if (isValid) {
        console.log(`✓ ${emp.name}: Password already correct`);
        needsUpdate = false;
      }
    }

    if (needsUpdate) {
      await prisma.employees.update({
        where: { id: employee.id },
        data: {
          password_hash: hashedPassword,
          must_change_password: false
        }
      });
      console.log(`✅ ${emp.name}: Password set to "${targetPassword}"`);
      updatedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   ✓ Already correct: ${cvEmployees.length - updatedCount - notFoundCount}`);
  console.log(`   ⚠️  Not found: ${notFoundCount}`);
  console.log(`\n🔐 All CV sample employees now have password: "${targetPassword}"\n`);

  await prisma.$disconnect();
}

setPasswords();
