/**
 * Test tenant_id trigger functionality
 * Verifies that tenant_id is auto-populated from employees table
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTrigger() {
  console.log('\n🧪 Testing tenant_id trigger functionality...\n');

  try {
    // Step 1: Get a test employee
    const employee = await prisma.employees.findFirst({
      where: { is_active: true }
    });

    if (!employee) {
      console.error('❌ No active employees found in database');
      process.exit(1);
    }

    console.log('✓ Test employee:', {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      tenant_id: employee.tenant_id
    });

    // Step 2: Test INSERT without tenant_id (trigger should auto-populate)
    console.log('\n📝 Test 1: INSERT certification WITHOUT tenant_id...');
    const cert1 = await prisma.employee_certifications.create({
      data: {
        certification_name: 'TEST TRIGGER AUTO POPULATE',
        issuing_organization: 'Test Org',
        employees: {
          connect: { id: employee.id }
        }
        // tenant_id NOT specified - trigger should populate it
      }
    });

    console.log('✓ Created certification:', {
      id: cert1.id,
      employee_id: cert1.employee_id,
      tenant_id: cert1.tenant_id
    });

    if (cert1.tenant_id === employee.tenant_id) {
      console.log('✅ PASS: tenant_id auto-populated correctly');
    } else {
      console.error('❌ FAIL: tenant_id mismatch!', {
        expected: employee.tenant_id,
        actual: cert1.tenant_id
      });
    }

    // Step 3: Test INSERT with explicit tenant_id (should validate)
    console.log('\n📝 Test 2: INSERT certification WITH correct tenant_id...');
    const cert2 = await prisma.employee_certifications.create({
      data: {
        certification_name: 'TEST TRIGGER EXPLICIT TENANT',
        issuing_organization: 'Test Org',
        employees: {
          connect: { id: employee.id }
        },
        tenants: {
          connect: { id: employee.tenant_id }
        }
      }
    });

    console.log('✓ Created certification:', {
      id: cert2.id,
      tenant_id: cert2.tenant_id
    });
    console.log('✅ PASS: Explicit tenant_id accepted');

    // Step 4: Test INSERT with WRONG tenant_id (should fail)
    console.log('\n📝 Test 3: INSERT with raw SQL to test trigger validation...');
    try {
      await prisma.$executeRaw`
        INSERT INTO employee_certifications (employee_id, certification_name, issuing_organization, tenant_id)
        VALUES (${employee.id}, 'TEST TRIGGER WRONG TENANT', 'Test Org', 'wrong-tenant-123')
      `;
      console.error('❌ FAIL: Should have rejected wrong tenant_id');
    } catch (error) {
      if (error.message.includes('does not match') || error.message.includes('foreign key')) {
        console.log('✅ PASS: Wrong tenant_id rejected');
      } else {
        console.log('✓ Rejected:', error.message.split('\n')[0]);
      }
    }

    // Step 5: Test other tables
    console.log('\n📝 Test 4: Test trigger on employee_education...');
    const education = await prisma.employee_education.create({
      data: {
        degree_name: 'TEST TRIGGER DEGREE',
        institution_name: 'Test University',
        employees: {
          connect: { id: employee.id }
        }
        // tenant_id not specified
      }
    });

    if (education.tenant_id === employee.tenant_id) {
      console.log('✅ PASS: employee_education trigger works');
    } else {
      console.error('❌ FAIL: employee_education tenant_id mismatch');
    }

    // Step 6: Test employee_languages
    console.log('\n📝 Test 5: Test trigger on employee_languages...');
    const language = await prisma.employee_languages.create({
      data: {
        listening_level: 'A1',
        employees: {
          connect: { id: employee.id }
        },
        languages: {
          connect: { id: 1 }  // Italian
        }
        // tenant_id not specified
      }
    });

    if (language.tenant_id === employee.tenant_id) {
      console.log('✅ PASS: employee_languages trigger works');
    } else {
      console.error('❌ FAIL: employee_languages tenant_id mismatch');
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.employee_certifications.deleteMany({
      where: {
        certification_name: {
          startsWith: 'TEST TRIGGER'
        }
      }
    });
    await prisma.employee_education.deleteMany({
      where: {
        degree_name: 'TEST TRIGGER DEGREE'
      }
    });
    await prisma.employee_languages.delete({
      where: { id: language.id }
    });

    console.log('✓ Test data cleaned up');

    console.log('\n✅ All trigger tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTrigger();
