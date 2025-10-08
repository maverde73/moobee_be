const { PrismaClient } = require('@prisma/client');
const cvDataSaveService = require('./src/services/cvDataSaveService');

const prisma = new PrismaClient();

async function testDomainKnowledgeFix() {
  console.log('Testing domain knowledge constraint fix...\n');
  
  // Mock extraction data with domain knowledge
  const mockData = {
    domain_knowledge: {
      industry_domains: ['Healthcare', 'Banking', 'Insurance'],
      client_sectors: ['Government', 'Private Sector'],
      business_processes: ['Data Migration', 'System Integration'],
      standards_protocols: []
    },
    skills: {
      extracted_skills: [
        { id: 821, skill_name: 'JavaScript', matched_skill: 'javascript' }
      ]
    },
    languages: [
      { language: 'English', cef_level: 'C1', proficiency: 'Fluent' }
    ],
    role: {
      id_role: 44,
      id_sub_role: 34,
      role: 'Frontend Developer',
      matched_sub_role: 'frontend developer',
      seniority: 'Senior'
    }
  };
  
  const EMPLOYEE_ID = 91;
  const TENANT_ID = 'f5eafcce-26af-4699-aa97-dd8829621406';
  
  // Create cv_extraction record
  const cvExtraction = await prisma.cv_extractions.create({
    data: {
      employee_id: EMPLOYEE_ID,
      tenant_id: TENANT_ID,
      cv_file_path: 'test_domain_fix.json',
      extraction_result: mockData,
      status: 'completed',
      llm_model_used: 'test',
      llm_tokens_used: 0,
      llm_cost: 0
    }
  });
  
  console.log('Created cv_extraction:', cvExtraction.id);
  
  // Test save
  const result = await cvDataSaveService.saveExtractedDataToTables(
    cvExtraction.id,
    EMPLOYEE_ID,
    mockData,
    TENANT_ID
  );
  
  console.log('\n📊 STATS:');
  console.log(JSON.stringify(result, null, 2));
  
  // Check domain knowledge
  const domains = await prisma.employee_domain_knowledge.findMany({
    where: { employee_id: EMPLOYEE_ID, cv_extraction_id: cvExtraction.id }
  });
  
  console.log(`\n✅ Domain Knowledge saved: ${domains.length} records`);
  if (domains.length > 0) {
    domains.forEach(d => console.log(`  - ${d.domain_type}: ${d.domain_value}`));
  }
  
  await prisma.$disconnect();
}

testDomainKnowledgeFix().catch(console.error);
