const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setSuperAdminPassword() {
  console.log('\n🔐 Impostazione password per Super Admin...\n');

  try {
    // Password da impostare
    const plainPassword = 'SuperAdmin123!';

    // Genera hash della password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    console.log('✅ Password hashata generata');

    // Aggiorna super admin
    const result = await prisma.tenant_users.updateMany({
      where: {
        email: 'superadmin@moobee.com'
      },
      data: {
        password: hashedPassword
      }
    });

    if (result.count > 0) {
      console.log(`✅ Password impostata per ${result.count} utente/i`);
      console.log('\n📋 Credenziali Super Admin:');
      console.log('  Email: superadmin@moobee.com');
      console.log('  Password: SuperAdmin123!');
      console.log('\n✅ Puoi ora effettuare il login con queste credenziali!\n');
    } else {
      console.log('⚠️ Nessun utente superadmin@moobee.com trovato');
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setSuperAdminPassword().catch(console.error);