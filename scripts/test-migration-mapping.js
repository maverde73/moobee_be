const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMigrationMapping() {
  console.log('=== TEST MIGRATION MAPPING ===\n');

  try {
    // Test sample mapping
    const sampleAssignment = await prisma.$queryRaw`
      SELECT
        eca.id,
        eca.employee_id as stored_employee_id,
        pg_typeof(eca.employee_id) as employee_id_type
      FROM engagement_campaign_assignments eca
      LIMIT 5
    `;

    console.log('Sample assignments:');
    sampleAssignment.forEach(a => {
      console.log(`  ID: ${a.id}, employee_id: ${a.stored_employee_id}, type: ${a.employee_id_type}`);
    });

    // Test tenant_users
    const sampleTenantUsers = await prisma.$queryRaw`
      SELECT
        id,
        pg_typeof(id) as id_type,
        email
      FROM tenant_users
      LIMIT 5
    `;

    console.log('\nSample tenant_users:');
    sampleTenantUsers.forEach(tu => {
      console.log(`  ID: ${tu.id}, type: ${tu.id_type}, email: ${tu.email}`);
    });

    // Try mapping with proper conversion
    console.log('\n=== Testing Mapping Logic ===');

    const mappingTest = await prisma.$queryRaw`
      SELECT
        eca.id as assignment_id,
        eca.employee_id as stored_value,
        tu.id as tenant_user_id,
        e.id as employee_id,
        e.email
      FROM engagement_campaign_assignments eca
      LEFT JOIN tenant_users tu ON tu.id::text = eca.employee_id
      LEFT JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
      WHERE eca.employee_id IS NOT NULL
      LIMIT 10
    `;

    console.log('\nMapping results:');
    mappingTest.forEach(m => {
      console.log(`  Assignment: ${m.assignment_id}`);
      console.log(`    Stored value: ${m.stored_value}`);
      console.log(`    Tenant user: ${m.tenant_user_id}`);
      console.log(`    Employee ID: ${m.employee_id}`);
      console.log(`    Email: ${m.email}`);
      console.log('');
    });

    // Count successful mappings
    const countResult = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) as mapped
      FROM engagement_campaign_assignments eca
      LEFT JOIN tenant_users tu ON tu.id::text = eca.employee_id
      LEFT JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    `;

    console.log('=== MAPPING SUMMARY ===');
    console.log(`Total assignments: ${countResult[0].total}`);
    console.log(`Successfully mapped: ${countResult[0].mapped}`);
    console.log(`Success rate: ${(countResult[0].mapped / countResult[0].total * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMigrationMapping();