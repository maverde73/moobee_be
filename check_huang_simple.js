const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const employee = await prisma.employees.findFirst({
    where: { email: 'chuang@nexadata.it' }
  });

  console.log('\n✓ Claudio Huang - Employee ID:', employee.id);

  // Check latest CV extraction
  const extraction = await prisma.cv_extractions.findFirst({
    where: { employee_id: employee.id },
    orderBy: { created_at: 'desc' }
  });

  console.log('✓ Latest CV extraction ID:', extraction.id);
  console.log('✓ Status:', extraction.status);

  const result = extraction.extraction_result;
  console.log('\n📊 Python extracted:');
  console.log('  Skills:', result.skills?.extracted_skills?.length || 0);
  result.skills?.extracted_skills?.forEach(s => {
    console.log(`    - ${s.skill_name} (ID: ${s.id})`);
  });

  // Check database
  const savedSkills = await prisma.employee_skills.findMany({
    where: { employee_id: employee.id }
  });

  console.log('\n💾 Saved in database:');
  console.log(`  Total skills for this employee: ${savedSkills.length}`);

  const cvSkills = savedSkills.filter(s => s.cv_extraction_id === extraction.id);
  console.log(`  Skills from this CV extraction: ${cvSkills.length}`);

  if (cvSkills.length === 0) {
    console.log('\n❌ PROBLEM: No skills were saved from CV extraction!');
    console.log('   Expected: 6 skills (Bootstrap, NextJS, React, React Native, Angular, Java)');
  }

  await prisma.$disconnect();
}

check();
