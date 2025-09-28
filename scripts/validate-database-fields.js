const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Campi documentati nelle API per ogni tabella
const API_FIELDS = {
  employees: {
    table: 'employees',
    fields: [
      'id', 'employee_code', 'first_name', 'last_name', 'email',
      'phone', 'hire_date', 'job_title', 'department_id',
      'manager_id', 'is_active', 'created_at', 'updated_at', 'tenant_id'
    ]
  },
  tenant_users: {
    table: 'tenant_users',
    fields: [
      'id', 'tenantId', 'email', 'firstName', 'lastName',
      'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'
    ]
  },
  tenants: {
    table: 'tenants',
    fields: [
      'id', 'name', 'companyName', 'email', 'phone',
      'address', 'city', 'country', 'isActive', 'plan',
      'maxUsers', 'createdAt', 'updatedAt'
    ]
  },
  assessment_templates: {
    table: 'assessment_templates',
    fields: [
      'id', 'name', 'type', 'description', 'isActive',
      'suggestedRoles', 'targetSoftSkillIds', 'createdBy',
      'version', 'createdAt', 'updatedAt'
    ]
  },
  assessment_questions: {
    table: 'assessment_questions',
    fields: [
      'id', 'templateId', 'text', 'type', 'category', 'order'
    ]
  },
  assessment_options: {
    table: 'assessment_options',
    fields: [
      'id', 'questionId', 'text', 'value'
    ]
  },
  soft_skills: {
    table: 'soft_skills',
    fields: [
      'id', 'name', 'nameEn', 'description', 'category',
      'isActive', 'createdAt', 'updatedAt'
    ]
  },
  role_soft_skills: {
    table: 'role_soft_skills',
    fields: [
      'id', 'roleId', 'softSkillId', 'priority', 'minScore', 'createdAt'
    ]
  },
  roles: {
    table: 'roles',
    fields: [
      'id', 'name', 'nameKnown', 'synonyms'
    ]
  },
  departments: {
    table: 'departments',
    fields: [
      'id', 'department_name', 'department_code', 'manager_id',
      'parent_department_id', 'is_active', 'created_at', 'updated_at', 'tenant_id'
    ]
  },
  assessments: {
    table: 'assessments',
    fields: [
      'id', 'employee_id', 'assessment_type', 'assessment_date',
      'overall_score', 'technical_score', 'soft_skills_score',
      'notes', 'assessed_by', 'status', 'created_at', 'updated_at', 'tenant_id'
    ]
  }
};

async function validateDatabaseFields() {
  const report = [];

  console.log('🔍 Starting Database Field Validation...\n');
  report.push('# Database Field Validation Report');
  report.push(`Generated: ${new Date().toISOString()}\n`);
  report.push('## Summary\n');

  let totalTables = 0;
  let tablesFound = 0;
  let totalFields = 0;
  let fieldsFound = 0;
  let fieldsNotFound = 0;

  for (const [key, tableInfo] of Object.entries(API_FIELDS)) {
    totalTables++;
    console.log(`\n📋 Checking table: ${tableInfo.table}`);
    report.push(`\n## Table: ${tableInfo.table}\n`);

    try {
      // Verifica se la tabella esiste nel database
      const tableExists = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${tableInfo.table}'
        ) as exists
      `);

      if (tableExists[0].exists) {
        tablesFound++;
        report.push('✅ Table exists in database\n');
        console.log('  ✅ Table exists');

        // Recupera i campi della tabella dal database
        const columns = await prisma.$queryRawUnsafe(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = '${tableInfo.table}'
        `);

        const dbColumns = columns.map(col => col.column_name);

        report.push('### Field Analysis:\n');
        report.push('| API Field | DB Field | Status | Data Type | Nullable | Default |');
        report.push('|-----------|----------|--------|-----------|----------|---------|');

        // Verifica ogni campo documentato
        for (const field of tableInfo.fields) {
          totalFields++;
          const dbField = dbColumns.find(col =>
            col === field ||
            col === field.toLowerCase() ||
            col === field.replace(/([A-Z])/g, '_$1').toLowerCase()
          );

          if (dbField) {
            fieldsFound++;
            const columnInfo = columns.find(col => col.column_name === dbField);
            report.push(`| ${field} | ${dbField} | ✅ Found | ${columnInfo.data_type} | ${columnInfo.is_nullable} | ${columnInfo.column_default || 'NULL'} |`);
            console.log(`    ✅ ${field} -> ${dbField}`);
          } else {
            fieldsNotFound++;
            report.push(`| ${field} | - | ❌ Not Found | - | - | - |`);
            console.log(`    ❌ ${field} -> NOT FOUND`);
          }
        }

        // Trova campi nel DB non documentati
        const undocumentedFields = dbColumns.filter(col => {
          return !tableInfo.fields.some(field =>
            col === field ||
            col === field.toLowerCase() ||
            col === field.replace(/([A-Z])/g, '_$1').toLowerCase()
          );
        });

        if (undocumentedFields.length > 0) {
          report.push('\n### Undocumented Database Fields:\n');
          report.push('| Database Field | Data Type | Note |');
          report.push('|----------------|-----------|------|');
          for (const field of undocumentedFields) {
            const columnInfo = columns.find(col => col.column_name === field);
            report.push(`| ${field} | ${columnInfo.data_type} | ⚠️ Not in API docs |`);
            console.log(`    ⚠️ Undocumented: ${field}`);
          }
        }

      } else {
        report.push('❌ **Table NOT FOUND in database**\n');
        console.log('  ❌ Table NOT FOUND');
      }

    } catch (error) {
      report.push(`❌ Error checking table: ${error.message}\n`);
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  // Aggiungi riepilogo finale
  report.unshift('', '## Executive Summary');
  report.unshift('', `- **Tables Found**: ${tablesFound}/${totalTables} (${Math.round(tablesFound/totalTables*100)}%)`);
  report.unshift(`- **Fields Found**: ${fieldsFound}/${totalFields} (${Math.round(fieldsFound/totalFields*100)}%)`);
  report.unshift(`- **Fields Missing**: ${fieldsNotFound}`);
  report.unshift(`- **Tables Missing**: ${totalTables - tablesFound}`);
  report.unshift('');

  // Controlla anche le tabelle nel database non documentate
  const allTables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const documentedTables = Object.values(API_FIELDS).map(t => t.table);
  const undocumentedTables = allTables
    .map(t => t.table_name)
    .filter(t => !documentedTables.includes(t));

  if (undocumentedTables.length > 0) {
    report.push('\n## Undocumented Tables in Database\n');
    report.push('These tables exist in the database but are not documented in the API:\n');
    for (const table of undocumentedTables) {
      report.push(`- ⚠️ ${table}`);
    }
  }

  // Salva il report
  const reportPath = path.join(__dirname, '..', 'docs', 'DATABASE_FIELD_VALIDATION_REPORT.md');
  fs.writeFileSync(reportPath, report.join('\n'));

  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log('\n📊 Summary:');
  console.log(`  Tables: ${tablesFound}/${totalTables} found`);
  console.log(`  Fields: ${fieldsFound}/${totalFields} found`);
  console.log(`  Missing Fields: ${fieldsNotFound}`);

  await prisma.$disconnect();
}

validateDatabaseFields().catch(console.error);