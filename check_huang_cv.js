const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHuang() {
  // Find Claudio Huang
  const employee = await prisma.employees.findFirst({
    where: { email: 'chuang@nexadata.it' },
    select: { id: true, first_name: true, last_name: true, tenant_id: true }
  });

  if (!employee) {
    console.log('❌ Claudio Huang not found');
    return;
  }

  console.log('\n✓ Employee:', employee);

  // Find CV extractions
  const extractions = await prisma.cv_extractions.findMany({
    where: { employee_id: employee.id },
    orderBy: { created_at: 'desc' },
    take: 1
  });

  if (extractions.length === 0) {
    console.log('❌ No CV extractions found');
    return;
  }

  const extraction = extractions[0];
  console.log('\n✓ Latest CV extraction:');
  console.log(`  ID: ${extraction.id}`);
  console.log(`  Status: ${extraction.status}`);
  console.log(`  Created: ${extraction.created_at}`);

  // Check extracted data
  const result = extraction.extraction_result;
  console.log('\n📊 Extraction Result:');
  console.log(`  Skills extracted: ${result.skills?.extracted_skills?.length || 0}`);
  console.log(`  Skills not found: ${result.skills?.not_found?.length || 0}`);
  console.log(`  Role: ${JSON.stringify(result.role)}`);
  console.log(`  Work experiences: ${result.work_experience?.length || 0}`);

  // Check what was saved in database
  const skills = await prisma.employee_skills.findMany({
    where: {
      employee_id: employee.id,
      cv_extraction_id: extraction.id
    }
  });

  console.log('\n💾 Saved in database:');
  console.log(`  Skills: ${skills.length}`);
  if (skills.length > 0) {
    for (const s of skills) {
      const skill = await prisma.skills.findUnique({ where: { id: s.skill_id } });
      console.log(`    - ${skill?.name || 'Unknown'} (ID: ${s.skill_id}, proficiency: ${s.proficiency_level})`);
    }
  }

  const roles = await prisma.employee_roles.findMany({
    where: { employee_id: employee.id },
    include: {
      roles: true,
      sub_roles: true
    }
  });

  console.log(`  Roles: ${roles.length}`);
  if (roles.length > 0) {
    roles.forEach(r => {
      console.log(`    - ${r.sub_roles?.Sub_Role || 'N/A'} (${r.roles?.Role || 'N/A'})`);
    });
  }

  await prisma.$disconnect();
}

checkHuang();
