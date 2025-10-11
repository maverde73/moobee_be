/**
 * Clean Employee Derived Data
 * Cancella tutti i dati derivati da CV nelle tabelle employee
 *
 * Tabelle pulite:
 * - employee_additional_info
 * - employee_awards
 * - employee_certifications
 * - employee_domain_knowledge
 * - employee_education
 * - employee_languages
 * - employee_projects
 * - employee_publications
 * - employee_roles
 * - employee_skills
 * - employee_soft_skills
 * - employee_work_experiences
 * - cv_extractions
 * - cv_files
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanEmployeeData() {
  console.log('🧹 Clean Employee Derived Data\n');
  console.log('⚠️  Questo script cancellerà TUTTI i dati employee derivati da CV!\n');

  try {
    // Check environment
    const dbUrl = process.env.DATABASE_URL || '';
    const isProduction = dbUrl.includes('railway.app') || dbUrl.includes('prod');

    if (isProduction) {
      console.error('❌ ERRORE: Database di PRODUZIONE rilevato!');
      console.error('   Questo script può essere usato SOLO in locale per test.');
      process.exit(1);
    }

    console.log('✅ Database: Locale (safe to clean)\n');

    // Count existing records
    console.log('📊 Conteggio record attuali...\n');

    const counts = {
      cv_files: await prisma.cv_files.count(),
      cv_extractions: await prisma.cv_extractions.count(),
      employee_skills: await prisma.employee_skills.count(),
      employee_roles: await prisma.employee_roles.count(),
      employee_education: await prisma.employee_education.count(),
      employee_work_experiences: await prisma.employee_work_experiences.count(),
      employee_languages: await prisma.employee_languages.count(),
      employee_certifications: await prisma.employee_certifications.count(),
      employee_soft_skills: await prisma.employee_soft_skills.count(),
      employee_domain_knowledge: await prisma.employee_domain_knowledge.count(),
    };

    // Try to count other tables (might not exist)
    try {
      counts.employee_additional_info = await prisma.$queryRaw`SELECT COUNT(*) FROM employee_additional_info`;
      counts.employee_additional_info = parseInt(counts.employee_additional_info[0].count);
    } catch (e) {
      counts.employee_additional_info = 'N/A (table not found)';
    }

    try {
      counts.employee_awards = await prisma.$queryRaw`SELECT COUNT(*) FROM employee_awards`;
      counts.employee_awards = parseInt(counts.employee_awards[0].count);
    } catch (e) {
      counts.employee_awards = 'N/A (table not found)';
    }

    try {
      counts.employee_projects = await prisma.$queryRaw`SELECT COUNT(*) FROM employee_projects`;
      counts.employee_projects = parseInt(counts.employee_projects[0].count);
    } catch (e) {
      counts.employee_projects = 'N/A (table not found)';
    }

    try {
      counts.employee_publications = await prisma.$queryRaw`SELECT COUNT(*) FROM employee_publications`;
      counts.employee_publications = parseInt(counts.employee_publications[0].count);
    } catch (e) {
      counts.employee_publications = 'N/A (table not found)';
    }

    console.log('Tabelle CV:');
    console.log(`   cv_files: ${counts.cv_files}`);
    console.log(`   cv_extractions: ${counts.cv_extractions}`);
    console.log('\nTabelle Employee:');
    console.log(`   employee_additional_info: ${counts.employee_additional_info}`);
    console.log(`   employee_awards: ${counts.employee_awards}`);
    console.log(`   employee_certifications: ${counts.employee_certifications}`);
    console.log(`   employee_domain_knowledge: ${counts.employee_domain_knowledge}`);
    console.log(`   employee_education: ${counts.employee_education}`);
    console.log(`   employee_languages: ${counts.employee_languages}`);
    console.log(`   employee_projects: ${counts.employee_projects}`);
    console.log(`   employee_publications: ${counts.employee_publications}`);
    console.log(`   employee_roles: ${counts.employee_roles}`);
    console.log(`   employee_skills: ${counts.employee_skills}`);
    console.log(`   employee_soft_skills: ${counts.employee_soft_skills}`);
    console.log(`   employee_work_experiences: ${counts.employee_work_experiences}\n`);

    console.log('🗑️  Cancellazione in corso...\n');

    // Delete in correct order (respect foreign keys)
    // IMPORTANT: Delete employee tables BEFORE cv_extractions (foreign keys!)
    let totalDeleted = 0;

    // 1. Employee derived data FIRST (have FK to cv_extractions)
    console.log('1️⃣ Cancellazione employee_skills...');
    const deletedSkills = await prisma.employee_skills.deleteMany({});
    console.log(`   ✅ ${deletedSkills.count} record cancellati`);
    totalDeleted += deletedSkills.count;

    console.log('4️⃣ Cancellazione employee_roles...');
    const deletedRoles = await prisma.employee_roles.deleteMany({});
    console.log(`   ✅ ${deletedRoles.count} record cancellati`);
    totalDeleted += deletedRoles.count;

    console.log('5️⃣ Cancellazione employee_education...');
    const deletedEducation = await prisma.employee_education.deleteMany({});
    console.log(`   ✅ ${deletedEducation.count} record cancellati`);
    totalDeleted += deletedEducation.count;

    console.log('6️⃣ Cancellazione employee_work_experiences...');
    const deletedExperiences = await prisma.employee_work_experiences.deleteMany({});
    console.log(`   ✅ ${deletedExperiences.count} record cancellati`);
    totalDeleted += deletedExperiences.count;

    console.log('7️⃣ Cancellazione employee_languages...');
    const deletedLanguages = await prisma.employee_languages.deleteMany({});
    console.log(`   ✅ ${deletedLanguages.count} record cancellati`);
    totalDeleted += deletedLanguages.count;

    console.log('8️⃣ Cancellazione employee_certifications...');
    const deletedCerts = await prisma.employee_certifications.deleteMany({});
    console.log(`   ✅ ${deletedCerts.count} record cancellati`);
    totalDeleted += deletedCerts.count;

    console.log('9️⃣ Cancellazione employee_soft_skills...');
    const deletedSoftSkills = await prisma.employee_soft_skills.deleteMany({});
    console.log(`   ✅ ${deletedSoftSkills.count} record cancellati`);
    totalDeleted += deletedSoftSkills.count;

    console.log('🔟 Cancellazione employee_domain_knowledge...');
    const deletedDomainKnowledge = await prisma.employee_domain_knowledge.deleteMany({});
    console.log(`   ✅ ${deletedDomainKnowledge.count} record cancellati`);
    totalDeleted += deletedDomainKnowledge.count;

    // Additional tables (BEFORE cv_extractions - they have FK too!)
    try {
      console.log('1️⃣1️⃣ Cancellazione employee_additional_info...');
      await prisma.$executeRaw`DELETE FROM employee_additional_info`;
      console.log(`   ✅ Tabella svuotata`);
    } catch (e) {
      console.log(`   ⚠️  Tabella non trovata o già vuota`);
    }

    try {
      console.log('1️⃣2️⃣ Cancellazione employee_awards...');
      await prisma.$executeRaw`DELETE FROM employee_awards`;
      console.log(`   ✅ Tabella svuotata`);
    } catch (e) {
      console.log(`   ⚠️  Tabella non trovata o già vuota`);
    }

    try {
      console.log('1️⃣3️⃣ Cancellazione employee_projects...');
      await prisma.$executeRaw`DELETE FROM employee_projects`;
      console.log(`   ✅ Tabella svuotata`);
    } catch (e) {
      console.log(`   ⚠️  Tabella non trovata o già vuota`);
    }

    try {
      console.log('1️⃣4️⃣ Cancellazione employee_publications...');
      await prisma.$executeRaw`DELETE FROM employee_publications`;
      console.log(`   ✅ Tabella svuotata`);
    } catch (e) {
      console.log(`   ⚠️  Tabella non trovata o già vuota`);
    }

    // NOW we can delete cv_extractions (after ALL employee tables with FK)
    console.log('1️⃣5️⃣ Cancellazione cv_extractions...');
    const deletedExtractions = await prisma.cv_extractions.deleteMany({});
    console.log(`   ✅ ${deletedExtractions.count} record cancellati`);
    totalDeleted += deletedExtractions.count;

    console.log('1️⃣6️⃣ Cancellazione cv_files...');
    const deletedCvFiles = await prisma.cv_files.deleteMany({});
    console.log(`   ✅ ${deletedCvFiles.count} record cancellati`);
    totalDeleted += deletedCvFiles.count;

    // Clean physical files from temp_uploads
    console.log('\n1️⃣7️⃣ Cancellazione file fisici da temp_uploads/...');
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
      console.log(`   ℹ️  Directory temp_uploads/ non esiste`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ PULIZIA COMPLETATA');
    console.log('='.repeat(60));
    console.log(`\n📊 Totale record cancellati: ${totalDeleted}`);
    console.log('\nIl database è pronto per nuovi test!');
    console.log('Puoi ora:');
    console.log('1. Caricare nuovi CV dal frontend');
    console.log('2. Verificare che i file vengano salvati in temp_uploads/');
    console.log('3. Verificare che i dati vengano importati correttamente\n');

  } catch (error) {
    console.error('\n❌ ERRORE durante la pulizia:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanEmployeeData();
