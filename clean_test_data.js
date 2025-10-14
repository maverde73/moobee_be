/**
 * Clean Test Data - Database Cleanup Script
 * Deletes all records from employee-related tables and CV extraction tables
 * Date: 14 October 2025, 18:40
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('🧹 Starting database cleanup...\n');

    // Delete in correct order to respect foreign key constraints

    console.log('1️⃣  Deleting employee_soft_skill_assessments...');
    const softSkillAssessments = await prisma.employee_soft_skill_assessments.deleteMany({});
    console.log(`   ✅ Deleted ${softSkillAssessments.count} records\n`);

    console.log('2️⃣  Deleting employee_soft_skills...');
    const softSkills = await prisma.employee_soft_skills.deleteMany({});
    console.log(`   ✅ Deleted ${softSkills.count} records\n`);

    console.log('3️⃣  Deleting employee_skills...');
    const skills = await prisma.employee_skills.deleteMany({});
    console.log(`   ✅ Deleted ${skills.count} records\n`);

    console.log('4️⃣  Deleting employee_roles...');
    const roles = await prisma.employee_roles.deleteMany({});
    console.log(`   ✅ Deleted ${roles.count} records\n`);

    console.log('5️⃣  Deleting employee_work_experiences...');
    const workExperiences = await prisma.employee_work_experiences.deleteMany({});
    console.log(`   ✅ Deleted ${workExperiences.count} records\n`);

    console.log('6️⃣  Deleting employee_publications...');
    const publications = await prisma.employee_publications.deleteMany({});
    console.log(`   ✅ Deleted ${publications.count} records\n`);

    console.log('7️⃣  Deleting employee_projects...');
    const projects = await prisma.employee_projects.deleteMany({});
    console.log(`   ✅ Deleted ${projects.count} records\n`);

    console.log('8️⃣  Deleting employee_languages...');
    const languages = await prisma.employee_languages.deleteMany({});
    console.log(`   ✅ Deleted ${languages.count} records\n`);

    console.log('9️⃣  Deleting employee_education...');
    const education = await prisma.employee_education.deleteMany({});
    console.log(`   ✅ Deleted ${education.count} records\n`);

    console.log('🔟 Deleting employee_domain_knowledge...');
    const domainKnowledge = await prisma.employee_domain_knowledge.deleteMany({});
    console.log(`   ✅ Deleted ${domainKnowledge.count} records\n`);

    console.log('1️⃣1️⃣  Deleting employee_certifications...');
    const certifications = await prisma.employee_certifications.deleteMany({});
    console.log(`   ✅ Deleted ${certifications.count} records\n`);

    console.log('1️⃣2️⃣  Deleting employee_awards...');
    const awards = await prisma.employee_awards.deleteMany({});
    console.log(`   ✅ Deleted ${awards.count} records\n`);

    console.log('1️⃣3️⃣  Deleting employee_additional_info...');
    const additionalInfo = await prisma.employee_additional_info.deleteMany({});
    console.log(`   ✅ Deleted ${additionalInfo.count} records\n`);

    console.log('1️⃣4️⃣  Deleting cv_files...');
    const cvFiles = await prisma.cv_files.deleteMany({});
    console.log(`   ✅ Deleted ${cvFiles.count} records\n`);

    console.log('1️⃣5️⃣  Deleting cv_extractions...');
    const cvExtractions = await prisma.cv_extractions.deleteMany({});
    console.log(`   ✅ Deleted ${cvExtractions.count} records\n`);

    // Note: NOT deleting education_degrees as it's a reference table

    // Summary
    const totalDeleted =
      softSkillAssessments.count +
      softSkills.count +
      skills.count +
      roles.count +
      workExperiences.count +
      publications.count +
      projects.count +
      languages.count +
      education.count +
      domainKnowledge.count +
      certifications.count +
      awards.count +
      additionalInfo.count +
      cvFiles.count +
      cvExtractions.count;

    console.log('✅ DATABASE CLEANUP COMPLETE\n');
    console.log('📊 Summary:');
    console.log(`   Total records deleted: ${totalDeleted}`);
    console.log(`   employee_soft_skill_assessments: ${softSkillAssessments.count}`);
    console.log(`   employee_soft_skills: ${softSkills.count}`);
    console.log(`   employee_skills: ${skills.count}`);
    console.log(`   employee_roles: ${roles.count}`);
    console.log(`   employee_work_experiences: ${workExperiences.count}`);
    console.log(`   employee_publications: ${publications.count}`);
    console.log(`   employee_projects: ${projects.count}`);
    console.log(`   employee_languages: ${languages.count}`);
    console.log(`   employee_education: ${education.count}`);
    console.log(`   employee_domain_knowledge: ${domainKnowledge.count}`);
    console.log(`   employee_certifications: ${certifications.count}`);
    console.log(`   employee_awards: ${awards.count}`);
    console.log(`   employee_additional_info: ${additionalInfo.count}`);
    console.log(`   cv_files: ${cvFiles.count}`);
    console.log(`   cv_extractions: ${cvExtractions.count}\n`);

    // Verify cleanup
    console.log('🔍 Verifying cleanup...');
    const remainingSkills = await prisma.employee_skills.count();
    const remainingRoles = await prisma.employee_roles.count();
    const remainingExtractions = await prisma.cv_extractions.count();

    console.log(`   employee_skills remaining: ${remainingSkills}`);
    console.log(`   employee_roles remaining: ${remainingRoles}`);
    console.log(`   cv_extractions remaining: ${remainingExtractions}\n`);

    if (remainingSkills === 0 && remainingRoles === 0 && remainingExtractions === 0) {
      console.log('✅ All target tables are clean - ready for fresh CV import test!\n');
    } else {
      console.log('⚠️  Warning: Some records remain in tables\n');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
