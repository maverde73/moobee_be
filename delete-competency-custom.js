const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteCompetencyAndCustomAssessments() {
  try {
    // Prima conta quanti assessment verranno eliminati
    const countBefore = await prisma.assessmentTemplate.count({
      where: {
        type: {
          in: ['competency', 'custom']
        }
      }
    });

    console.log(`Trovati ${countBefore} assessment di tipo 'competency' o 'custom' da eliminare...`);

    if (countBefore > 0) {
      // Elimina tutti gli assessment di tipo competency o custom
      const deleted = await prisma.assessmentTemplate.deleteMany({
        where: {
          type: {
            in: ['competency', 'custom']
          }
        }
      });

      console.log(`✅ Eliminati ${deleted.count} assessment di tipo 'competency' e 'custom'`);
    } else {
      console.log('✅ Nessun assessment di tipo competency o custom trovato nel database');
    }

    // Conta gli assessment rimanenti
    const remaining = await prisma.assessmentTemplate.count();
    console.log(`\nAssessment rimanenti nel database: ${remaining}`);

    // Mostra i tipi rimanenti
    const types = await prisma.assessmentTemplate.groupBy({
      by: ['type'],
      _count: true
    });

    console.log('\nDistribuzione per tipo:');
    types.forEach(t => {
      console.log(`- ${t.type}: ${t._count} assessment`);
    });

  } catch (error) {
    console.error('❌ Errore durante l\'eliminazione:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui la funzione
deleteCompetencyAndCustomAssessments();