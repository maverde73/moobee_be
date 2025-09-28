const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyMoobeeTenant() {
  console.log('\n========================================');
  console.log('   VERIFICA TENANT MOOBEE E UTENTI     ');
  console.log('========================================\n');

  try {
    // Verifica tenant Moobee
    const tenant = await prisma.tenants.findFirst({
      where: {
        OR: [
          { name: 'Moobee' },
          { companyName: 'Moobee HR Platform' }
        ]
      }
    });

    if (!tenant) {
      console.log('❌ ERRORE: Tenant Moobee non trovato nel database!');
      return;
    }

    console.log('✅ TENANT MOOBEE TROVATO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ID:           ${tenant.id}`);
    console.log(`  Nome:         ${tenant.name}`);
    console.log(`  Azienda:      ${tenant.companyName}`);
    console.log(`  Email:        ${tenant.email}`);
    console.log(`  Piano:        ${tenant.plan}`);
    console.log(`  Max Utenti:   ${tenant.maxUsers}`);
    console.log(`  Attivo:       ${tenant.isActive ? '✅ Sì' : '❌ No'}`);
    console.log(`  Città:        ${tenant.city || 'N/A'}`);
    console.log(`  Paese:        ${tenant.country || 'N/A'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verifica utenti del tenant
    const tenantUsers = await prisma.tenant_users.findMany({
      where: {
        tenantId: tenant.id
      },
      orderBy: [
        { role: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    if (tenantUsers.length === 0) {
      console.log('⚠️  ATTENZIONE: Nessun utente trovato per il tenant Moobee!');
    } else {
      console.log(`📋 UTENTI DEL TENANT (${tenantUsers.length} trovati):`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const roleMap = {
        'super_admin': '👑 Super Admin',
        'admin': '🔧 Admin',
        'hr': '👥 HR Manager',
        'user': '👤 Utente'
      };

      tenantUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${roleMap[user.role] || user.role}`);
        console.log(`   Email:     ${user.email}`);
        console.log(`   Nome:      ${user.firstName} ${user.lastName}`);
        console.log(`   Attivo:    ${user.isActive ? '✅' : '❌'}`);
        console.log(`   Ultimo Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString('it-IT') : 'Mai effettuato'}`);
        console.log('');
      });
    }

    // Verifica credenziali super admin
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔐 CREDENZIALI SUPER ADMIN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const superAdmin = tenantUsers.find(u => u.email === 'superadmin@moobee.com');
    if (superAdmin) {
      console.log('  ✅ Super Admin configurato correttamente');
      console.log('  📧 Email:    superadmin@moobee.com');
      console.log('  🔑 Password: SuperAdmin123! (come da FE_tenant LoginPage)');
      console.log('\n  ℹ️  Nota: La password deve essere configurata nel sistema di autenticazione');
    } else {
      console.log('  ❌ Super Admin NON trovato!');
      console.log('  Eseguire nuovamente create-moobee-tenant.sql');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verifica ruoli disponibili
    const roles = await prisma.$queryRaw`
      SELECT DISTINCT role, COUNT(*) as count
      FROM tenant_users
      WHERE "tenantId" = ${tenant.id}
      GROUP BY role
      ORDER BY role`;

    console.log('📊 RIEPILOGO RUOLI:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    roles.forEach(r => {
      console.log(`  ${r.role}: ${r.count} utente/i`);
    });

    console.log('\n✅ VERIFICA COMPLETATA CON SUCCESSO!\n');
    console.log('🚀 Prossimi passi:');
    console.log('  1. Configurare il sistema di autenticazione per gestire le password');
    console.log('  2. Testare il login con superadmin@moobee.com / SuperAdmin123!');
    console.log('  3. Accedere a Prisma Studio (http://localhost:5555) per gestire i dati');

  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMoobeeTenant().catch(console.error);