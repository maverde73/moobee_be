const { PrismaClient } = require('@prisma/client');
const cvDataSaveService = require('./src/services/cvDataSaveService');

const prisma = new PrismaClient();

async function test() {
  const mockData = {
    domain_knowledge: {
      industry_domains: ['Healthcare', 'Banking', 'Insurance'],
      client_sectors: ['Government', 'Private Sector'],
      business_processes: ['Data Migration', 'System Integration'],
      standards_protocols: []
    },
    skills: { extracted_skills: [{ id: 821, skill_name: 'JavaScript' }] },
    languages: [{ language: 'English', cef_level: 'C1' }],
    role: { id_role: 44, id_sub_role: 34, seniority: 'Senior' }
  };
  
  const cvExtraction = await prisma.cv_extractions.create({
    data: {
      employee_id: 91,
      tenant_id: 'f5eafcce-26af-4699-aa97-dd8829621406',
      original_file_path: 'test.json',
      extraction_result: mockData,
      status: 'completed',
      llm_model_used: 'test'
    }
  });
  
  console.log('Created extraction:', cvExtraction.id, '\n');
  
  const result = await cvDataSaveService.saveExtractedDataToTables(
    cvExtraction.id, 91, mockData, 'f5eafcce-26af-4699-aa97-dd8829621406'
  );
  
  console.log('\n📊 RESULT:', JSON.stringify(result, null, 2));
  
  const domains = await prisma.employee_domain_knowledge.findMany({
    where: { employee_id: 91, cv_extraction_id: cvExtraction.id }
  });
  
  console.log(`\n✅ Domain Knowledge: ${domains.length} saved`);
  domains.forEach(d => console.log(`  ${d.domain_type}: ${d.domain_value}`));
  
  await prisma.$disconnect();
}

test().catch(console.error);
