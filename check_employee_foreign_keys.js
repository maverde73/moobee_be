const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEmployeeForeignKeys() {
  console.log('🔍 Checking Foreign Keys for Employee Tables');
  console.log('='.repeat(80));

  try {
    // Query to get all foreign key constraints for employee tables
    const foreignKeys = await prisma.$queryRaw`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN (
          'employee_additional_info',
          'employee_awards',
          'employee_certifications',
          'employee_domain_knowledge',
          'employee_education',
          'employee_languages',
          'employee_projects',
          'employee_publications',
          'employee_roles',
          'employee_skills',
          'employee_soft_skills',
          'employee_work_experiences'
        )
      ORDER BY tc.table_name, kcu.column_name
    `;

    // Group by table
    const byTable = {};
    foreignKeys.forEach(fk => {
      if (!byTable[fk.table_name]) {
        byTable[fk.table_name] = [];
      }
      byTable[fk.table_name].push(fk);
    });

    // Display results
    const tables = [
      'employee_additional_info',
      'employee_awards',
      'employee_certifications',
      'employee_domain_knowledge',
      'employee_education',
      'employee_languages',
      'employee_projects',
      'employee_publications',
      'employee_roles',
      'employee_skills',
      'employee_soft_skills',
      'employee_work_experiences'
    ];

    console.log('\n📊 Foreign Key Report:\n');

    tables.forEach(tableName => {
      const fks = byTable[tableName] || [];
      console.log(`\n${tableName.toUpperCase()}`);
      console.log('-'.repeat(80));

      if (fks.length === 0) {
        console.log('  ❌ NO FOREIGN KEYS FOUND!');
      } else {
        fks.forEach(fk => {
          console.log(`  ✅ ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
          console.log(`     Constraint: ${fk.constraint_name}`);
          console.log(`     ON DELETE: ${fk.delete_rule} | ON UPDATE: ${fk.update_rule}`);
          console.log('');
        });
      }
    });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 SUMMARY:');
    console.log('='.repeat(80));

    const totalFKs = foreignKeys.length;
    const tablesWithFKs = Object.keys(byTable).length;
    const tablesWithoutFKs = tables.length - tablesWithFKs;

    console.log(`Total Foreign Keys: ${totalFKs}`);
    console.log(`Tables with FKs: ${tablesWithFKs}/${tables.length}`);
    if (tablesWithoutFKs > 0) {
      console.log(`⚠️  Tables WITHOUT FKs: ${tablesWithoutFKs}`);
      const missing = tables.filter(t => !byTable[t]);
      missing.forEach(t => console.log(`   - ${t}`));
    }

    // Check for missing critical FK to employees table
    console.log('\n🔍 Critical Check: FK to employees table');
    console.log('-'.repeat(80));

    tables.forEach(tableName => {
      const fks = byTable[tableName] || [];
      const hasEmployeeFk = fks.some(fk =>
        fk.foreign_table_name === 'employees' && fk.column_name === 'employee_id'
      );

      if (hasEmployeeFk) {
        const fk = fks.find(fk =>
          fk.foreign_table_name === 'employees' && fk.column_name === 'employee_id'
        );
        console.log(`✅ ${tableName}: employee_id → employees.id (${fk.delete_rule})`);
      } else {
        console.log(`❌ ${tableName}: MISSING employee_id FK to employees!`);
      }
    });

    // Check tenant_id foreign keys
    console.log('\n🔍 Tenant Isolation Check: FK to tenants table');
    console.log('-'.repeat(80));

    tables.forEach(tableName => {
      const fks = byTable[tableName] || [];
      const hasTenantFk = fks.some(fk =>
        fk.foreign_table_name === 'tenants' && fk.column_name === 'tenant_id'
      );

      if (hasTenantFk) {
        const fk = fks.find(fk =>
          fk.foreign_table_name === 'tenants' && fk.column_name === 'tenant_id'
        );
        console.log(`✅ ${tableName}: tenant_id → tenants.id (${fk.delete_rule})`);
      } else {
        console.log(`⚠️  ${tableName}: NO tenant_id FK (might not have tenant_id column)`);
      }
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmployeeForeignKeys();
