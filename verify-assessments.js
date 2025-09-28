const prisma = require('./src/config/database');

async function verifyAssessments() {
  try {
    // Conta tutti gli assessment
    const total = await prisma.assessmentTemplate.count();
    
    // Conta per tipo
    const byType = await prisma.assessmentTemplate.groupBy({
      by: ['type'],
      _count: true,
      orderBy: {
        type: 'asc'
      }
    });
    
    console.log('\n✨ ASSESSMENT CREATI CON SUCCESSO ✨');
    console.log('=====================================');
    console.log(`📊 Totale assessment nel database: ${total}`);
    console.log('\n📈 Distribuzione per tipo:');
    byType.forEach(item => {
      const emoji = item.type === 'big_five' ? '🔵' : 
                   item.type === 'disc' ? '🟡' : 
                   item.type === 'belbin' ? '🟢' : '⚫';
      console.log(`   ${emoji} ${item.type.toUpperCase()}: ${item._count} assessment`);
    });
    
    // Mostra ultimi 5 creati
    const latest = await prisma.assessmentTemplate.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      select: { id: true, name: true, type: true }
    });
    
    console.log('\n🎯 Ultimi 5 assessment creati:');
    latest.forEach(a => {
      console.log(`   ID ${a.id}: ${a.name} (${a.type})`);
    });
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAssessments();
