const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    // Controlla TUTTI gli utenti del tenant (attivi e non)
    const allUsers = await prisma.tenant_users.findMany({
      where: { tenant_id: 'b1234567-89ab-cdef-0123-456789abcdef' },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        is_active: true,
        role: true
      }
    });

    console.log('\n=== TUTTI GLI UTENTI DEL TENANT ===');
    console.log(`Totale utenti: ${allUsers.length}`);

    allUsers.forEach(u => {
      const status = u.is_active ? '✅ ATTIVO' : '❌ DISATTIVATO';
      console.log(`  ${status} - ${u.first_name} ${u.last_name} (${u.email}) - Role: ${u.role || 'N/A'}`);
    });

    // Conta gli attivi
    const activeUsers = allUsers.filter(u => u.is_active);
    const inactiveUsers = allUsers.filter(u => !u.is_active);

    console.log('\n📊 STATISTICHE:');
    console.log(`  Utenti attivi: ${activeUsers.length}`);
    console.log(`  Utenti disattivati: ${inactiveUsers.length}`);

    if (activeUsers.length === 0) {
      console.log('\n⚠️  PROBLEMA: Nessun utente attivo!');
      console.log('Questo spiega perché la lista è vuota nel frontend.');
    }

  } catch (error) {
    console.error('Errore:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();