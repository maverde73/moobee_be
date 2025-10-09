const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDomainKnowledge() {
  try {
    // Get latest CV extraction for employee 91
    const extraction = await prisma.cv_extractions.findFirst({
      where: { employee_id: 91 },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        extraction_result: true,
        created_at: true
      }
    });

    if (!extraction) {
      console.log('❌ No extraction found for employee 91');
      return;
    }

    console.log('\n📄 CV Extraction ID:', extraction.id);
    console.log('📅 Created:', extraction.created_at);
    console.log('\n🔍 Domain Knowledge from extraction_result:');
    console.log(JSON.stringify(extraction.extraction_result.domain_knowledge, null, 2));

    // Check if saved to employee_domain_knowledge
    const savedDomains = await prisma.employee_domain_knowledge.findMany({
      where: { employee_id: 91 },
      select: {
        domain_type: true,
        domain_value: true,
        source: true,
        created_at: true
      }
    });

    console.log(`\n💾 Saved to employee_domain_knowledge: ${savedDomains.length} records`);
    if (savedDomains.length > 0) {
      savedDomains.forEach(d => {
        console.log(`   - ${d.domain_type}: ${d.domain_value} (${d.source})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDomainKnowledge();
