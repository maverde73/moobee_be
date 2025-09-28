const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Campi che il BE si aspetta (dal documento REAL_FIELDS)
const BE_EXPECTED_FIELDS = {
  employees: {
    create: ['employee_code', 'first_name', 'last_name', 'email', 'phone', 'hire_date', 'position', 'department_id', 'manager_id', 'is_active', 'tenant_id', 'created_at', 'updated_at'],
    update: ['first_name', 'last_name', 'email', 'phone', 'position', 'department_id', 'manager_id', 'is_active', 'updated_at'],
    read: ['id', 'employee_code', 'first_name', 'last_name', 'email', 'phone', 'hire_date', 'position', 'department_id', 'manager_id', 'is_active', 'tenant_id', 'created_at', 'updated_at']
  },
  tenants: {
    create: ['id', 'name', 'companyName', 'email', 'phone', 'address', 'city', 'country', 'isActive', 'plan', 'maxUsers', 'createdAt', 'updatedAt'],
    update: ['name', 'companyName', 'email', 'phone', 'address', 'city', 'country', 'plan', 'maxUsers', 'updatedAt'],
    read: ['id', 'name', 'companyName', 'email', 'phone', 'address', 'city', 'country', 'isActive', 'plan', 'maxUsers', 'createdAt', 'updatedAt']
  },
  tenant_users: {
    create: ['tenantId', 'email', 'firstName', 'lastName', 'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'],
    update: ['email', 'firstName', 'lastName', 'role', 'isActive', 'lastLogin', 'updatedAt'],
    read: ['id', 'tenantId', 'email', 'firstName', 'lastName', 'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt']
  },
  assessment_templates: {
    create: ['name', 'type', 'description', 'isActive', 'suggestedRoles', 'targetSoftSkillIds', 'createdBy', 'version', 'createdAt', 'updatedAt'],
    update: ['name', 'type', 'description', 'isActive', 'suggestedRoles', 'targetSoftSkillIds', 'version', 'updatedAt'],
    read: ['id', 'name', 'type', 'description', 'isActive', 'suggestedRoles', 'targetSoftSkillIds', 'createdBy', 'version', 'createdAt', 'updatedAt']
  },
  assessment_questions: {
    create: ['templateId', 'text', 'type', 'category', 'order'],
    read: ['id', 'templateId', 'text', 'type', 'category', 'order']
  },
  assessment_options: {
    create: ['questionId', 'text', 'value'],
    read: ['id', 'questionId', 'text', 'value']
  },
  soft_skills: {
    create: ['name', 'nameEn', 'description', 'category', 'isActive', 'createdAt', 'updatedAt'],
    read: ['id', 'name', 'nameEn', 'description', 'category', 'isActive', 'createdAt', 'updatedAt']
  },
  role_soft_skills: {
    create: ['roleId', 'softSkillId', 'priority', 'minScore', 'createdAt'],
    read: ['id', 'roleId', 'softSkillId', 'priority', 'minScore', 'createdAt']
  },
  assessments: {
    create: ['employee_id', 'assessment_type', 'assessment_date', 'overall_score', 'technical_score', 'soft_skills_score', 'notes', 'assessed_by', 'status', 'created_at', 'updated_at', 'tenant_id'],
    read: ['id', 'employee_id', 'assessment_type', 'assessment_date', 'overall_score', 'technical_score', 'soft_skills_score', 'notes', 'assessed_by', 'status', 'created_at', 'updated_at', 'tenant_id']
  }
};

async function analyzeDifferences() {
  const report = [];

  console.log('🔍 Analisi differenze BE vs Database...\n');

  report.push('# 🔄 DIFFERENZE TRA BACKEND E DATABASE');
  report.push(`\nGenerated: ${new Date().toISOString()}\n`);
  report.push('## Executive Summary\n');

  let totalTables = 0;
  let tablesWithIssues = 0;
  let criticalIssues = [];
  let warnings = [];
  let suggestions = [];

  for (const [tableName, operations] of Object.entries(BE_EXPECTED_FIELDS)) {
    totalTables++;
    console.log(`\n📋 Analizzando: ${tableName}`);
    report.push(`\n## Tabella: ${tableName}\n`);

    try {
      // Verifica esistenza tabella
      const tableExists = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${tableName}'
        ) as exists
      `);

      if (!tableExists[0].exists) {
        tablesWithIssues++;
        report.push(`### ❌ ERRORE CRITICO: Tabella NON ESISTE nel database!\n`);
        criticalIssues.push(`Tabella ${tableName} non esiste nel database`);
        continue;
      }

      // Recupera campi dal database
      const dbColumns = await prisma.$queryRawUnsafe(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = '${tableName}'
      `);

      const dbFieldNames = dbColumns.map(col => col.column_name);
      let tableHasIssues = false;

      // Analizza per ogni operazione
      for (const [operation, expectedFields] of Object.entries(operations)) {
        report.push(`\n### Operazione: ${operation.toUpperCase()}\n`);
        report.push('| Campo Atteso | Stato DB | Tipo DB | Nullable | Note |');
        report.push('|--------------|----------|---------|----------|------|');

        for (const field of expectedFields) {
          const dbField = dbFieldNames.find(col =>
            col === field ||
            col === field.toLowerCase() ||
            col === field.replace(/([A-Z])/g, '_$1').toLowerCase()
          );

          if (dbField) {
            const columnInfo = dbColumns.find(col => col.column_name === dbField);
            const expectedType = inferExpectedType(field, tableName);
            const typeMatch = checkTypeCompatibility(expectedType, columnInfo.data_type);

            if (!typeMatch) {
              warnings.push(`${tableName}.${field}: tipo atteso ${expectedType}, trovato ${columnInfo.data_type}`);
              report.push(`| ${field} | ✅ Esiste | ⚠️ ${columnInfo.data_type} | ${columnInfo.is_nullable} | Tipo potrebbe non corrispondere |`);
            } else {
              report.push(`| ${field} | ✅ Esiste | ${columnInfo.data_type} | ${columnInfo.is_nullable} | OK |`);
            }
          } else {
            tableHasIssues = true;
            criticalIssues.push(`${tableName}.${field} richiesto per ${operation} ma non esiste`);
            report.push(`| ${field} | ❌ MANCA | - | - | **CRITICO per ${operation}** |`);
          }
        }
      }

      // Trova campi extra nel DB
      const allExpectedFields = new Set();
      Object.values(operations).forEach(fields => {
        fields.forEach(f => allExpectedFields.add(f));
      });

      const extraDbFields = dbFieldNames.filter(dbField => {
        return !Array.from(allExpectedFields).some(expected => {
          const variations = [
            expected,
            expected.toLowerCase(),
            expected.replace(/([A-Z])/g, '_$1').toLowerCase()
          ];
          return variations.includes(dbField);
        });
      });

      if (extraDbFields.length > 0) {
        report.push('\n### ⚠️ Campi Extra nel Database (non usati dal BE):\n');
        report.push('| Campo DB | Tipo | Nullable | Suggerimento |');
        report.push('|----------|------|----------|--------------|');
        for (const field of extraDbFields) {
          const columnInfo = dbColumns.find(col => col.column_name === field);
          suggestions.push(`Considerare rimozione o utilizzo di ${tableName}.${field}`);
          report.push(`| ${field} | ${columnInfo.data_type} | ${columnInfo.is_nullable} | Valutare se rimuovere |`);
        }
      }

      if (tableHasIssues) tablesWithIssues++;

    } catch (error) {
      report.push(`\n### ❌ Errore analisi: ${error.message}\n`);
      console.error(`  ❌ Errore: ${error.message}`);
    }
  }

  // Aggiungi riepilogo
  report.unshift('\n---\n');
  report.unshift('\n## 📊 Statistiche\n');
  report.unshift(`- **Tabelle Analizzate**: ${totalTables}`);
  report.unshift(`- **Tabelle con Problemi**: ${tablesWithIssues}`);
  report.unshift(`- **Problemi Critici**: ${criticalIssues.length}`);
  report.unshift(`- **Warning**: ${warnings.length}`);
  report.unshift(`- **Suggerimenti**: ${suggestions.length}`);

  // Aggiungi sezione problemi critici
  if (criticalIssues.length > 0) {
    report.push('\n---\n## 🚨 PROBLEMI CRITICI DA RISOLVERE\n');
    criticalIssues.forEach((issue, idx) => {
      report.push(`${idx + 1}. **${issue}**`);
    });
  }

  // Aggiungi sezione warning
  if (warnings.length > 0) {
    report.push('\n## ⚠️ WARNING (non bloccanti)\n');
    warnings.forEach((warning, idx) => {
      report.push(`${idx + 1}. ${warning}`);
    });
  }

  // Aggiungi suggerimenti
  if (suggestions.length > 0) {
    report.push('\n## 💡 SUGGERIMENTI\n');
    suggestions.forEach((suggestion, idx) => {
      report.push(`${idx + 1}. ${suggestion}`);
    });
  }

  // Aggiungi script SQL per correzioni
  report.push('\n---\n## 🔧 SCRIPT SQL PER CORREZIONI\n');
  report.push('```sql');
  report.push('-- Script generato automaticamente per allineare DB con BE\n');

  // Genera ALTER TABLE per campi mancanti critici
  for (const issue of criticalIssues) {
    if (issue.includes('ma non esiste')) {
      const match = issue.match(/(\w+)\.(\w+) richiesto/);
      if (match) {
        const [, table, field] = match;
        const sqlType = getSqlType(field);
        report.push(`-- Campo mancante: ${table}.${field}`);
        report.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${field} ${sqlType};`);
        report.push('');
      }
    }
  }

  report.push('```');

  // Salva report
  const reportPath = path.join(__dirname, '..', 'docs', 'BE_VS_DB_DIFFERENCES.md');
  fs.writeFileSync(reportPath, report.join('\n'));

  console.log(`\n✅ Report salvato in: ${reportPath}`);
  console.log(`\n📊 Riepilogo:`);
  console.log(`  - Problemi Critici: ${criticalIssues.length}`);
  console.log(`  - Warning: ${warnings.length}`);
  console.log(`  - Suggerimenti: ${suggestions.length}`);

  await prisma.$disconnect();
}

// Funzioni helper
function convertCamelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function inferExpectedType(field, table) {
  if (field.includes('id') || field.includes('Id')) return 'integer';
  if (field.includes('email')) return 'varchar';
  if (field.includes('name') || field.includes('Name')) return 'varchar';
  if (field.includes('date') || field.includes('Date')) return 'timestamp';
  if (field.includes('is_') || field.includes('Active')) return 'boolean';
  if (field === 'tenant_id') return 'uuid';
  return 'varchar';
};

function checkTypeCompatibility(expected, actual) {
  const compatible = {
    'integer': ['integer', 'int', 'bigint', 'serial'],
    'varchar': ['character varying', 'varchar', 'text'],
    'timestamp': ['timestamp', 'date', 'timestamp without time zone'],
    'boolean': ['boolean', 'bool'],
    'uuid': ['uuid', 'text', 'character varying']
  };

  return compatible[expected]?.some(type => actual.includes(type)) || false;
}

function getSqlType(field) {
  if (field.includes('id') || field.includes('Id')) {
    if (field === 'tenant_id') return 'UUID';
    return 'INTEGER';
  }
  if (field.includes('email')) return 'VARCHAR(255)';
  if (field.includes('name') || field.includes('Name')) return 'VARCHAR(255)';
  if (field.includes('date') || field.includes('Date') || field.includes('At')) return 'TIMESTAMP';
  if (field.includes('is_') || field.includes('Active')) return 'BOOLEAN DEFAULT true';
  if (field.includes('score')) return 'DECIMAL(5,2)';
  if (field.includes('priority')) return 'INTEGER';
  return 'VARCHAR(255)';
}

analyzeDifferences().catch(console.error);