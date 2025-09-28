const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRoleCreation() {
  try {
    console.log('\n=== TEST ROLE CREATION ===\n');

    // Test data
    const testRole = {
      project_id: 3,
      title: 'Test Role with Certifications',
      role_code: `TEST_${Date.now()}`,
      seniority: 'SENIOR',
      quantity: 1,
      priority: 'HIGH',
      status: 'OPEN',

      // Skills
      required_skills: { hard_skills: ['JavaScript', 'React'], soft_skills: ['Leadership'] },
      hard_skills: ['JavaScript', 'React', 'Node.js'],
      soft_skills: ['Leadership', 'Communication'],

      // Certifications - THESE SHOULD BE SAVED
      certifications: ['AWS Certified', 'Scrum Master'],
      required_certifications: ['AWS Solutions Architect', 'AWS Developer'],
      preferred_certifications: ['AWS DevOps', 'Azure Certified'],

      // Languages
      required_languages: ['English', 'Italian'],
      preferred_languages: ['German'],

      // Other fields
      min_experience_years: 5,
      preferred_experience_years: 7,
      allocation_percentage: 100,
      work_mode: 'HYBRID',
      location: 'Milano',
      is_billable: true,
      is_urgent: false,
      is_critical: false,

      // Sub-role (now using integer ID)
      sub_role_id: 44 // Backend Specialist ID
    };

    console.log('Creating role with data:');
    console.log(JSON.stringify(testRole, null, 2));

    // Create the role
    const created = await prisma.project_roles.create({
      data: testRole
    });

    console.log('\n✅ Role created successfully!');
    console.log('Created ID:', created.id);
    console.log('Sub-role ID:', created.sub_role_id);
    console.log('Required certifications:', created.required_certifications);
    console.log('Preferred certifications:', created.preferred_certifications);
    console.log('Certifications:', created.certifications);

    // Query it back to verify
    const fetched = await prisma.project_roles.findUnique({
      where: { id: created.id }
    });

    console.log('\n📖 Fetched role from DB:');
    console.log('Sub-role ID:', fetched.sub_role_id);
    console.log('Required certifications:', fetched.required_certifications);
    console.log('Preferred certifications:', fetched.preferred_certifications);
    console.log('Certifications:', fetched.certifications);

    // Clean up
    await prisma.project_roles.delete({
      where: { id: created.id }
    });
    console.log('\n🗑️ Test role deleted');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.meta) console.error('Error meta:', error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

testRoleCreation();