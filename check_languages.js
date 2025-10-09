const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLanguages() {
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
    console.log('\n🔍 Languages from extraction_result:');
    console.log(JSON.stringify(extraction.extraction_result.languages, null, 2));

    // Check if saved to employee_languages
    const savedLanguages = await prisma.employee_languages.findMany({
      where: { employee_id: 91 },
      include: {
        languages: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`\n💾 Saved to employee_languages: ${savedLanguages.length} records`);
    if (savedLanguages.length > 0) {
      savedLanguages.forEach(lang => {
        console.log(`   - ${lang.languages?.name}: listening=${lang.listening_level}, speaking=${lang.spoken_interaction_level}, native=${lang.is_native}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLanguages();
