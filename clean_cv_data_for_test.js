/**
 * Clean CV Data for Testing
 * Deletes all cv_extractions and optionally derived employee data
 *
 * ATTENZIONE: Questo script cancella TUTTI i dati CV dal database!
 * Usare SOLO per test in locale, MAI in produzione!
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function cleanCVData() {
  console.log('🧹 Clean CV Data for Testing\n');
  console.log('⚠️  ATTENZIONE: Questo script cancellerà TUTTI i dati CV dal database!\n');

  try {
    // Check environment
    const dbUrl = process.env.DATABASE_URL || '';
    const isProduction = dbUrl.includes('railway.app') || dbUrl.includes('prod');

    if (isProduction) {
      console.error('❌ ERRORE: Sembra che tu sia connesso a un database di PRODUZIONE!');
      console.error('   Database URL contiene "railway.app" o "prod"');
      console.error('   Questo script può essere usato SOLO in locale per test.');
      process.exit(1);
    }

    console.log('✅ Database: Locale (safe to clean)\n');

    // Count existing records
    console.log('📊 Conteggio record attuali...\n');

    const cvExtractionsCount = await prisma.cv_extractions.count();
    const cvFilesCount = await prisma.cv_files.count();

    console.log(`   cv_extractions: ${cvExtractionsCount} record`);
    console.log(`   cv_files: ${cvFilesCount} record\n`);

    if (cvExtractionsCount === 0 && cvFilesCount === 0) {
      console.log('✅ Database già pulito, nessun record da cancellare.');
      return;
    }

    // Ask for confirmation
    const answer = await question('❓ Vuoi procedere con la cancellazione? (sì/no): ');

    if (answer.toLowerCase() !== 'sì' && answer.toLowerCase() !== 'si') {
      console.log('❌ Operazione annullata.');
      return;
    }

    console.log('\n🗑️  Cancellazione in corso...\n');

    // Step 1: Delete cv_files (optional, CASCADE will do it anyway)
    console.log('1️⃣ Cancellazione cv_files...');
    const deletedFiles = await prisma.cv_files.deleteMany({});
    console.log(`   ✅ ${deletedFiles.count} record cancellati da cv_files\n`);

    // Step 2: Delete cv_extractions (CASCADE will delete related cv_files)
    console.log('2️⃣ Cancellazione cv_extractions...');
    const deletedExtractions = await prisma.cv_extractions.deleteMany({});
    console.log(`   ✅ ${deletedExtractions.count} record cancellati da cv_extractions\n`);

    // Optional: Clean derived employee data
    console.log('❓ Vuoi anche cancellare i dati derivati da CV negli employee?');
    console.log('   (skills, roles, education, work_experience, etc. con source="cv_extracted")');
    const cleanEmployee = await question('   Cancellare dati employee derivati? (sì/no): ');

    if (cleanEmployee.toLowerCase() === 'sì' || cleanEmployee.toLowerCase() === 'si') {
      console.log('\n3️⃣ Cancellazione dati employee derivati da CV...\n');

      // Delete employee_skills with source cv_extracted
      const deletedSkills = await prisma.employee_skills.deleteMany({
        where: { source: 'cv_extracted' }
      });
      console.log(`   ✅ ${deletedSkills.count} skills cancellate (source=cv_extracted)`);

      // Delete employee_roles with source cv_extracted
      const deletedRoles = await prisma.employee_roles.deleteMany({
        where: { source: 'cv_extracted' }
      });
      console.log(`   ✅ ${deletedRoles.count} roles cancellati (source=cv_extracted)`);

      // Delete employee_education
      const deletedEducation = await prisma.employee_education.deleteMany({});
      console.log(`   ✅ ${deletedEducation.count} education records cancellati`);

      // Delete employee_work_experiences
      const deletedExperiences = await prisma.employee_work_experiences.deleteMany({});
      console.log(`   ✅ ${deletedExperiences.count} work experiences cancellate`);

      // Delete employee_languages
      const deletedLanguages = await prisma.employee_languages.deleteMany({});
      console.log(`   ✅ ${deletedLanguages.count} languages cancellate`);

      // Delete employee_certifications
      const deletedCerts = await prisma.employee_certifications.deleteMany({});
      console.log(`   ✅ ${deletedCerts.count} certifications cancellate`);

      console.log('\n   ⚠️  NOTA: Gli employee records NON sono stati cancellati (solo i dati derivati)');
    }

    // Clean physical files from temp_uploads
    console.log('\n❓ Vuoi anche cancellare i file fisici da temp_uploads/?');
    const cleanFiles = await question('   Cancellare file fisici? (sì/no): ');

    if (cleanFiles.toLowerCase() === 'sì' || cleanFiles.toLowerCase() === 'si') {
      console.log('\n4️⃣ Cancellazione file fisici...\n');

      const fs = require('fs');
      const path = require('path');
      const tempUploadsPath = path.join(__dirname, 'temp_uploads');

      if (fs.existsSync(tempUploadsPath)) {
        const files = fs.readdirSync(tempUploadsPath);
        let deletedCount = 0;

        for (const file of files) {
          const filePath = path.join(tempUploadsPath, file);

          // Skip directories
          if (fs.statSync(filePath).isDirectory()) {
            continue;
          }

          // Delete only CV files (cv_*.pdf)
          if (file.startsWith('cv_') && file.endsWith('.pdf')) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }

        console.log(`   ✅ ${deletedCount} file CV cancellati da temp_uploads/`);
      } else {
        console.log(`   ⚠️  Directory temp_uploads/ non esiste`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ PULIZIA COMPLETATA');
    console.log('='.repeat(60));
    console.log('\nIl database è pronto per nuovi test!');
    console.log('Puoi ora:');
    console.log('1. Caricare nuovi CV dal frontend');
    console.log('2. Verificare che i file vengano salvati in temp_uploads/');
    console.log('3. Verificare che i record cv_files vengano creati\n');

  } catch (error) {
    console.error('\n❌ ERRORE durante la pulizia:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Run cleanup
cleanCVData();
