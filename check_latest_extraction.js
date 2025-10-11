/**
 * Check Latest CV Extraction Status
 * Quickly check the status of the most recent extraction
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestExtraction() {
  try {
    console.log('🔍 Checking latest CV extractions for employee 74...\n');

    const latestExtractions = await prisma.cv_extractions.findMany({
      where: {
        employee_id: 74
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 5,
      select: {
        id: true,
        status: true,
        created_at: true,
        updated_at: true,
        import_stats: true,
        error_message: true,
        error_phase: true,
        processing_time_seconds: true
      }
    });

    console.log(`Found ${latestExtractions.length} recent extractions:\n`);

    latestExtractions.forEach((ext, index) => {
      const elapsedSeconds = ext.processing_time_seconds || 0;
      const statusEmoji = {
        'pending': '⏳',
        'processing': '🔄',
        'extracted': '📥',
        'importing': '💾',
        'completed': '✅',
        'failed': '❌'
      }[ext.status] || '❓';

      console.log(`${index + 1}. ${statusEmoji} Status: ${ext.status}`);
      console.log(`   ID: ${ext.id}`);
      console.log(`   Created: ${ext.created_at}`);
      console.log(`   Updated: ${ext.updated_at}`);
      console.log(`   Processing Time: ${elapsedSeconds}s`);

      if (ext.import_stats) {
        console.log(`   Import Stats:`);
        console.log(`     - Personal Info: ${ext.import_stats.personal_info_updated ? 'Yes' : 'No'}`);
        console.log(`     - Education: ${ext.import_stats.education_saved || 0}`);
        console.log(`     - Work Experiences: ${ext.import_stats.work_experiences_saved || 0}`);
        console.log(`     - Skills: ${ext.import_stats.skills_saved || 0}`);
        console.log(`     - Languages: ${ext.import_stats.languages_saved || 0}`);
        console.log(`     - Certifications: ${ext.import_stats.certifications_saved || 0}`);
        console.log(`     - Roles: ${ext.import_stats.roles_saved || 0}`);
      }

      if (ext.error_message) {
        console.log(`   Error: ${ext.error_message}`);
      }

      if (ext.error_phase) {
        console.log(`   Error Phase: ${ext.error_phase}`);
      }

      console.log('');
    });

    // Check specifically for the NEW extraction ID
    const newExtraction = await prisma.cv_extractions.findUnique({
      where: {
        id: '48600929-8777-4dd4-9e6e-c7284f20d304'
      }
    });

    if (newExtraction) {
      console.log('\n🎯 NEW EXTRACTION (48600929-8777-4dd4-9e6e-c7284f20d304):');
      console.log(`   Status: ${newExtraction.status}`);
      console.log(`   Created: ${newExtraction.created_at}`);
      console.log(`   Updated: ${newExtraction.updated_at}`);
      console.log(`   Import Stats:`, newExtraction.import_stats);
    } else {
      console.log('\n❌ NEW extraction ID not found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestExtraction();
