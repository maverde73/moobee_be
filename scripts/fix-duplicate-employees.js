const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDuplicateEmployees() {
  console.log('=== FIX DUPLICATE EMPLOYEES ===\n');

  try {
    // Trova tutti i duplicati
    const duplicates = await prisma.$queryRaw`
      SELECT email, tenant_id, COUNT(*) as count
      FROM employees
      GROUP BY email, tenant_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log(`Found ${duplicates.length} duplicate email/tenant combinations\n`);

    for (const dup of duplicates) {
      console.log(`\nProcessing: ${dup.email} (tenant: ${dup.tenant_id})`);

      // Ottieni tutti i record duplicati
      const duplicateRecords = await prisma.employees.findMany({
        where: {
          email: dup.email,
          tenant_id: dup.tenant_id
        },
        orderBy: {
          created_at: 'asc' // Mantieni il più vecchio
        }
      });

      if (duplicateRecords.length <= 1) continue;

      const keepRecord = duplicateRecords[0]; // Mantieni il primo (più vecchio)
      const deleteRecords = duplicateRecords.slice(1); // Elimina gli altri

      console.log(`  Keeping: ID ${keepRecord.id} (created: ${keepRecord.created_at})`);

      for (const delRecord of deleteRecords) {
        console.log(`  Deleting: ID ${delRecord.id} (created: ${delRecord.created_at})`);

        // Prima controlla se ci sono riferimenti
        const hasReferences = await checkReferences(delRecord.id);

        if (hasReferences) {
          console.log(`    ⚠️  Has references - merging to ID ${keepRecord.id}`);
          await mergeReferences(delRecord.id, keepRecord.id);
        }

        // Ora elimina il duplicato
        await prisma.employees.delete({
          where: { id: delRecord.id }
        });

        console.log(`    ✅ Deleted`);
      }
    }

    // Verifica finale
    const finalCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as duplicate_count
      FROM (
        SELECT email, tenant_id
        FROM employees
        GROUP BY email, tenant_id
        HAVING COUNT(*) > 1
      ) as dups
    `;

    console.log(`\n✅ Fix completed. Remaining duplicates: ${finalCheck[0].duplicate_count}`);

  } catch (error) {
    console.error('❌ Error fixing duplicates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkReferences(employeeId) {
  // Controlla se ci sono riferimenti in altre tabelle
  // Per ora assumiamo che non ci siano riferimenti diretti
  // perché usiamo tenant_users.id negli assignments
  return false;
}

async function mergeReferences(fromId, toId) {
  // Merge eventuali riferimenti dal record duplicato a quello principale
  // Da implementare se necessario
  console.log(`    Merging references from ${fromId} to ${toId}`);
}

// Esegui
fixDuplicateEmployees()
  .then(() => {
    console.log('\n✅ Duplicate fix completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });