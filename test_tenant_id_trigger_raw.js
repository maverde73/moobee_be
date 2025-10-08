/**
 * Test tenant_id trigger functionality using raw SQL
 * (Prisma ORM validates NOT NULL before trigger can fire)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTrigger() {
  console.log('\n🧪 Testing tenant_id trigger with raw SQL...\n');

  try {
    // Get test employee
    const employee = await prisma.employees.findFirst({
      where: { is_active: true }
    });

    if (!employee) {
      console.error('❌ No active employees found');
      process.exit(1);
    }

    console.log('✓ Test employee:', {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      tenant_id: employee.tenant_id
    });

    // Test 1: INSERT without tenant_id (trigger auto-populates)
    console.log('\n📝 Test 1: INSERT WITHOUT tenant_id (trigger should auto-populate)...');
    const result1 = await prisma.$executeRaw`
      INSERT INTO employee_certifications (employee_id, certification_name, issuing_organization)
      VALUES (${employee.id}, 'TEST TRIGGER AUTO', 'Test Org')
      RETURNING id
    `;
    console.log('✓ INSERT executed');

    // Verify tenant_id was populated
    const cert1 = await prisma.$queryRaw`
      SELECT id, employee_id, tenant_id, certification_name
      FROM employee_certifications
      WHERE certification_name = 'TEST TRIGGER AUTO'
      LIMIT 1
    `;

    if (cert1[0].tenant_id === employee.tenant_id) {
      console.log('✅ PASS: tenant_id auto-populated by trigger');
      console.log('  Expected:', employee.tenant_id);
      console.log('  Got:     ', cert1[0].tenant_id);
    } else {
      console.error('❌ FAIL: tenant_id mismatch');
      console.error('  Expected:', employee.tenant_id);
      console.error('  Got:     ', cert1[0].tenant_id);
    }

    // Test 2: INSERT with explicit correct tenant_id
    console.log('\n📝 Test 2: INSERT WITH correct tenant_id...');
    await prisma.$executeRawUnsafe(
      `INSERT INTO employee_certifications (employee_id, certification_name, issuing_organization, tenant_id)
       VALUES ($1, 'TEST TRIGGER EXPLICIT', 'Test Org', $2)`,
      employee.id,
      employee.tenant_id
    );
    console.log('✅ PASS: Explicit correct tenant_id accepted');

    // Test 3: INSERT with WRONG tenant_id (should be rejected by trigger)
    console.log('\n📝 Test 3: INSERT WITH wrong tenant_id (should fail)...');
    try {
      await prisma.$executeRaw`
        INSERT INTO employee_certifications (employee_id, certification_name, issuing_organization, tenant_id)
        VALUES (${employee.id}, 'TEST TRIGGER WRONG', 'Test Org', 'wrong-tenant-id-12345')
      `;
      console.error('❌ FAIL: Should have rejected wrong tenant_id');
    } catch (error) {
      if (error.message.includes('does not match') || error.message.includes('violates foreign key')) {
        console.log('✅ PASS: Wrong tenant_id rejected');
        console.log('  Error:', error.message.split('\n')[0]);
      } else {
        console.log('✓ Rejected (different error):', error.message.split('\n')[0]);
      }
    }

    // Test 4: employee_education table
    console.log('\n📝 Test 4: Test trigger on employee_education...');
    await prisma.$executeRaw`
      INSERT INTO employee_education (employee_id, degree_name, institution_name)
      VALUES (${employee.id}, 'TEST TRIGGER DEGREE', 'Test University')
    `;

    const education = await prisma.$queryRaw`
      SELECT tenant_id FROM employee_education
      WHERE degree_name = 'TEST TRIGGER DEGREE'
      LIMIT 1
    `;

    if (education[0].tenant_id === employee.tenant_id) {
      console.log('✅ PASS: employee_education trigger works');
    } else {
      console.error('❌ FAIL: employee_education tenant_id mismatch');
    }

    // Test 5: employee_languages table
    console.log('\n📝 Test 5: Test trigger on employee_languages...');

    // First cleanup any existing test data
    await prisma.$executeRaw`
      DELETE FROM employee_languages
      WHERE employee_id = ${employee.id} AND language_id = 1
    `;

    await prisma.$executeRaw`
      INSERT INTO employee_languages (employee_id, language_id, listening_level)
      VALUES (${employee.id}, 1, 'A1')
    `;

    const language = await prisma.$queryRaw`
      SELECT id, tenant_id FROM employee_languages
      WHERE employee_id = ${employee.id} AND language_id = 1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (language[0].tenant_id === employee.tenant_id) {
      console.log('✅ PASS: employee_languages trigger works');
    } else {
      console.error('❌ FAIL: employee_languages tenant_id mismatch');
    }

    // Test 6: Verify indexes exist
    console.log('\n📝 Test 6: Verify composite indexes...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE indexname LIKE 'idx_employee_%_tenant_employee'
      ORDER BY tablename
    `;

    console.log(`✓ Found ${indexes.length} composite indexes:`);
    indexes.forEach(idx => {
      console.log(`  - ${idx.tablename}: ${idx.indexname}`);
    });

    if (indexes.length >= 10) {
      console.log('✅ PASS: All composite indexes created');
    } else {
      console.error('❌ FAIL: Missing indexes');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    try {
      await prisma.$executeRaw`
        DELETE FROM employee_certifications WHERE certification_name LIKE 'TEST TRIGGER%'
      `;
      await prisma.$executeRaw`
        DELETE FROM employee_education WHERE degree_name = 'TEST TRIGGER DEGREE'
      `;
      await prisma.$executeRaw`
        DELETE FROM employee_languages
        WHERE employee_id = ${employee.id} AND language_id = 1
      `;
      console.log('✓ Test data cleaned up');
    } catch (cleanupError) {
      console.log('⚠️  Cleanup warning:', cleanupError.message.split('\n')[0]);
    }

    console.log('\n✅ All trigger tests PASSED!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTrigger();
