const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPasswordReset() {
  console.log('\n🔍 VERIFICA CAMPO password_reset_token\n');
  console.log('='.repeat(50));

  const tenant = await prisma.tenants.findFirst({
    where: { slug: 'nexadata' }
  });

  // Conta utenti con e senza password_reset_token
  const usersWithReset = await prisma.tenant_users.count({
    where: {
      tenant_id: tenant.id,
      password_reset_token: { not: null }
    }
  });

  const usersWithoutReset = await prisma.tenant_users.count({
    where: {
      tenant_id: tenant.id,
      password_reset_token: null
    }
  });

  console.log(`📊 Utenti CON forza cambio password: ${usersWithReset}`);
  console.log(`📊 Utenti SENZA forza cambio password: ${usersWithoutReset}`);

  // Mostra alcuni esempi
  console.log('\n📝 Esempi utenti con forza cambio password:');
  const examplesWithReset = await prisma.tenant_users.findMany({
    where: {
      tenant_id: tenant.id,
      password_reset_token: { not: null }
    },
    take: 5,
    select: {
      email: true,
      password_reset_token: true,
      password_reset_expires_at: true
    }
  });

  examplesWithReset.forEach(user => {
    const expires = user.password_reset_expires_at ?
      new Date(user.password_reset_expires_at).toLocaleDateString() : 'N/A';
    console.log(`   ${user.email}: Token=${user.password_reset_token?.substring(0, 8)}... Scade=${expires}`);
  });

  console.log('\n📝 Utenti test (dovrebbero NON avere forza cambio):');
  const testUsers = await prisma.tenant_users.findMany({
    where: {
      tenant_id: tenant.id,
      email: {
        in: ['giulia.verdi@nexadata.it', 'marco.rossi@nexadata.it']
      }
    },
    select: {
      email: true,
      password_reset_token: true
    }
  });

  testUsers.forEach(user => {
    console.log(`   ${user.email}: ${user.password_reset_token ? '❌ HA RESET TOKEN' : '✅ NO RESET TOKEN'}`);
  });

  await prisma.$disconnect();
}

checkPasswordReset().catch(console.error);