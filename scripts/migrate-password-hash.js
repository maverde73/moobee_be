const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePasswordHash() {
  console.log('\n🔄 Migrazione password a password_hash...\n');

  try {
    // Copia password esistente in password_hash
    const result = await prisma.$executeRaw`
      UPDATE tenant_users
      SET password_hash = password
      WHERE password IS NOT NULL AND password_hash IS NULL`;

    console.log(`✅ Migrati ${result} record`);

    // Verifica super admin
    const superAdmin = await prisma.tenant_users.findFirst({
      where: { email: 'superadmin@moobee.com' },
      select: {
        email: true,
        password: true,
        password_hash: true
      }
    });

    console.log('\n📋 Stato Super Admin:');
    console.log('  Email:', superAdmin.email);
    console.log('  Ha password:', superAdmin.password ? '✅' : '❌');
    console.log('  Ha password_hash:', superAdmin.password_hash ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePasswordHash().catch(console.error);