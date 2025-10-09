const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLomonaco() {
  // Find employee Andrea Lomonaco
  const employee = await prisma.employees.findFirst({
    where: {
      OR: [
        { first_name: { contains: 'Andrea', mode: 'insensitive' } },
        { last_name: { contains: 'Lomonaco', mode: 'insensitive' } }
      ]
    }
  });

  if (!employee) {
    console.log('❌ Employee Andrea Lomonaco not found');
    return;
  }

  console.log(`✅ Found employee: ${employee.first_name} ${employee.last_name} (ID: ${employee.id})`);

  // Get latest CV extraction
  const extraction = await prisma.cv_extractions.findFirst({
    where: { employee_id: employee.id },
    orderBy: { created_at: 'desc' }
  });

  if (!extraction) {
    console.log('❌ No CV extraction found');
    return;
  }

  console.log('\n=== EXTRACTION INFO ===');
  console.log('ID:', extraction.id);
  console.log('Status:', extraction.status);
  console.log('Created:', extraction.created_at);
  console.log('LLM Model:', extraction.llm_model_used);
  console.log('Tokens:', extraction.llm_tokens_used);

  console.log('\n=== EXTRACTED TEXT (first 2000 chars) ===');
  if (extraction.extracted_text) {
    console.log(extraction.extracted_text.substring(0, 2000));
    console.log('\n... (total length:', extraction.extracted_text.length, 'chars)');
  } else {
    console.log('NO EXTRACTED TEXT');
  }

  console.log('\n=== EXTRACTION RESULT ===');
  if (extraction.extraction_result) {
    const result = extraction.extraction_result;

    console.log('\n📝 Personal Info:');
    console.log(JSON.stringify(result.personal_info, null, 2));

    console.log('\n🎓 Education:', result.education?.length || 0, 'entries');
    if (result.education && result.education.length > 0) {
      console.log(JSON.stringify(result.education, null, 2));
    }

    console.log('\n💼 Work Experience:', result.work_experience?.length || 0, 'entries');
    if (result.work_experience && result.work_experience.length > 0) {
      console.log(JSON.stringify(result.work_experience, null, 2));
    }

    console.log('\n🎯 Role/Seniority Info:');
    console.log(JSON.stringify(result.role || result.seniority_info, null, 2));

    console.log('\n💪 Skills:');
    console.log('Hard skills:', result.skills?.extracted_skills?.length || 0);
    console.log('Soft skills:', result.skills?.soft_skills?.length || 0);

    console.log('\n🌍 Languages:', result.languages?.length || 0);
    console.log('\n🏆 Certifications:', result.certifications?.length || 0);
  } else {
    console.log('NO EXTRACTION RESULT');
  }

  await prisma.$disconnect();
}

checkLomonaco().catch(console.error);
