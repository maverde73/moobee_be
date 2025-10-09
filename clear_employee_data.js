const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearEmployeeData() {
  console.log('\n🗑️  Clearing employee data tables...\n');

  try {
    // Delete in correct order (respecting foreign keys)
    const results = {};

    // 1. Delete dependent tables first
    results.employee_soft_skills = await prisma.employee_soft_skills.deleteMany({});
    console.log(`✅ employee_soft_skills: ${results.employee_soft_skills.count} records deleted`);

    results.employee_skills = await prisma.employee_skills.deleteMany({});
    console.log(`✅ employee_skills: ${results.employee_skills.count} records deleted`);

    results.employee_roles = await prisma.employee_roles.deleteMany({});
    console.log(`✅ employee_roles: ${results.employee_roles.count} records deleted`);

    results.employee_work_experiences = await prisma.employee_work_experiences.deleteMany({});
    console.log(`✅ employee_work_experiences: ${results.employee_work_experiences.count} records deleted`);

    results.employee_education = await prisma.employee_education.deleteMany({});
    console.log(`✅ employee_education: ${results.employee_education.count} records deleted`);

    results.employee_languages = await prisma.employee_languages.deleteMany({});
    console.log(`✅ employee_languages: ${results.employee_languages.count} records deleted`);

    results.employee_certifications = await prisma.employee_certifications.deleteMany({});
    console.log(`✅ employee_certifications: ${results.employee_certifications.count} records deleted`);

    results.employee_publications = await prisma.employee_publications.deleteMany({});
    console.log(`✅ employee_publications: ${results.employee_publications.count} records deleted`);

    results.employee_projects = await prisma.employee_projects.deleteMany({});
    console.log(`✅ employee_projects: ${results.employee_projects.count} records deleted`);

    results.employee_awards = await prisma.employee_awards.deleteMany({});
    console.log(`✅ employee_awards: ${results.employee_awards.count} records deleted`);

    results.employee_domain_knowledge = await prisma.employee_domain_knowledge.deleteMany({});
    console.log(`✅ employee_domain_knowledge: ${results.employee_domain_knowledge.count} records deleted`);

    results.employee_additional_info = await prisma.employee_additional_info.deleteMany({});
    console.log(`✅ employee_additional_info: ${results.employee_additional_info.count} records deleted`);

    console.log('\n📊 Summary:');
    let total = 0;
    Object.entries(results).forEach(([table, result]) => {
      total += result.count;
      console.log(`   ${table}: ${result.count}`);
    });
    console.log(`\n   Total records deleted: ${total}\n`);

    console.log('✅ All employee data cleared successfully!\n');

  } catch (error) {
    console.error('\n❌ Error clearing data:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

clearEmployeeData();
