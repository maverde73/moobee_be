/**
 * Seed Certifications Script
 * @created 2025-09-27 18:30
 * @description Popola il database con le certificazioni predefinite
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CERTIFICATIONS_DATA = {
  CLOUD: [
    { code: 'AWS_CSA', name: 'AWS Certified Solutions Architect', level: 'PROFESSIONAL', provider: 'Amazon', validity_years: 3 },
    { code: 'AWS_CD', name: 'AWS Certified Developer', level: 'ASSOCIATE', provider: 'Amazon', validity_years: 3 },
    { code: 'AZ_SA', name: 'Azure Solutions Architect', level: 'EXPERT', provider: 'Microsoft', validity_years: 2 },
    { code: 'GCP_PRO', name: 'Google Cloud Professional', level: 'PROFESSIONAL', provider: 'Google', validity_years: 2 },
    { code: 'CKA', name: 'Kubernetes Administrator (CKA)', level: 'PROFESSIONAL', provider: 'CNCF', validity_years: 3 }
  ],
  PROJECT: [
    { code: 'PMP', name: 'PMP - Project Management Professional', level: 'PROFESSIONAL', provider: 'PMI', validity_years: 3 },
    { code: 'P2_FOUND', name: 'PRINCE2 Foundation', level: 'FOUNDATION', provider: 'AXELOS', validity_years: null },
    { code: 'P2_PRACT', name: 'PRINCE2 Practitioner', level: 'PROFESSIONAL', provider: 'AXELOS', validity_years: 3 },
    { code: 'CSM', name: 'Scrum Master (CSM)', level: 'PROFESSIONAL', provider: 'Scrum Alliance', validity_years: 2 },
    { code: 'CSPO', name: 'Product Owner (CSPO)', level: 'PROFESSIONAL', provider: 'Scrum Alliance', validity_years: 2 },
    { code: 'PMI_ACP', name: 'Agile Certified Practitioner (PMI-ACP)', level: 'PROFESSIONAL', provider: 'PMI', validity_years: 3 }
  ],
  SECURITY: [
    { code: 'CISSP', name: 'CISSP', level: 'PROFESSIONAL', provider: 'ISC2', validity_years: 3 },
    { code: 'CEH', name: 'CEH - Certified Ethical Hacker', level: 'PROFESSIONAL', provider: 'EC-Council', validity_years: 3 },
    { code: 'COMPTIA_SEC', name: 'CompTIA Security+', level: 'ASSOCIATE', provider: 'CompTIA', validity_years: 3 },
    { code: 'ISO_27001', name: 'ISO 27001 Lead Auditor', level: 'PROFESSIONAL', provider: 'Various', validity_years: 3 }
  ],
  DEVELOPMENT: [
    { code: 'ORA_JAVA', name: 'Oracle Java Certified', level: 'PROFESSIONAL', provider: 'Oracle', validity_years: null },
    { code: 'MS_DEV', name: 'Microsoft Certified Developer', level: 'PROFESSIONAL', provider: 'Microsoft', validity_years: 2 },
    { code: 'SF_DEV', name: 'Salesforce Certified Developer', level: 'PROFESSIONAL', provider: 'Salesforce', validity_years: 1 },
    { code: 'SAP_DEV', name: 'SAP Certified Developer', level: 'PROFESSIONAL', provider: 'SAP', validity_years: 2 }
  ],
  DATABASE: [
    { code: 'ORA_DBA', name: 'Oracle DBA', level: 'PROFESSIONAL', provider: 'Oracle', validity_years: null },
    { code: 'MS_SQL', name: 'Microsoft SQL Server', level: 'PROFESSIONAL', provider: 'Microsoft', validity_years: 2 },
    { code: 'MONGO_CERT', name: 'MongoDB Certified', level: 'PROFESSIONAL', provider: 'MongoDB', validity_years: null },
    { code: 'PG_CERT', name: 'PostgreSQL Certified', level: 'PROFESSIONAL', provider: 'PostgreSQL', validity_years: null }
  ],
  BUSINESS: [
    { code: 'CBAP', name: 'CBAP - Business Analysis', level: 'PROFESSIONAL', provider: 'IIBA', validity_years: 3 },
    { code: 'SSGB', name: 'Six Sigma Green Belt', level: 'PROFESSIONAL', provider: 'Various', validity_years: null },
    { code: 'SSBB', name: 'Six Sigma Black Belt', level: 'PROFESSIONAL', provider: 'Various', validity_years: null },
    { code: 'ITIL', name: 'ITIL Foundation', level: 'FOUNDATION', provider: 'AXELOS', validity_years: null }
  ]
};

async function seedCertifications() {
  console.log('🌱 Starting certification seed...\n');

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const [category, certifications] of Object.entries(CERTIFICATIONS_DATA)) {
    console.log(`\n📂 Processing ${category} certifications...`);

    for (const cert of certifications) {
      try {
        const existing = await prisma.certification.findUnique({
          where: { code: cert.code }
        });

        if (existing) {
          // Update existing certification
          await prisma.certification.update({
            where: { code: cert.code },
            data: {
              name: cert.name,
              category,
              level: cert.level,
              provider: cert.provider,
              validity_years: cert.validity_years,
              is_active: true,
              updated_at: new Date()
            }
          });
          console.log(`  ✅ Updated: ${cert.name}`);
          totalUpdated++;
        } else {
          // Create new certification
          await prisma.certification.create({
            data: {
              code: cert.code,
              name: cert.name,
              category,
              level: cert.level,
              provider: cert.provider,
              validity_years: cert.validity_years,
              description: `${cert.name} certification provided by ${cert.provider}`,
              is_active: true
            }
          });
          console.log(`  ✅ Created: ${cert.name}`);
          totalCreated++;
        }
      } catch (error) {
        console.error(`  ❌ Error with ${cert.name}:`, error.message);
        totalErrors++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Seed Results:');
  console.log(`  ✨ Created: ${totalCreated} certifications`);
  console.log(`  🔄 Updated: ${totalUpdated} certifications`);
  console.log(`  ❌ Errors: ${totalErrors}`);
  console.log(`  📚 Total: ${totalCreated + totalUpdated} certifications in database`);
  console.log('='.repeat(50));

  // Verify final count
  const finalCount = await prisma.certification.count();
  console.log(`\n✅ Database now contains ${finalCount} certifications`);
}

// Execute the seed
seedCertifications()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('\n👋 Database connection closed');
  });