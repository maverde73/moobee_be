/**
 * Generate MCP Table Documentation
 *
 * This script generates comprehensive table documentation for the MCP (Model Context Protocol) server
 * by combining database schema from Railway PostgreSQL with JSDoc comments from Prisma schema.
 *
 * Output: Markdown files in ./tables/ directory
 *
 * Based on: docs/PROMPT_GENERAZIONE_TABELLE_MCP.md
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Priority table lists from MCP prompt
const PRIORITY_TABLES = {
  priority1: [
    'employees', 'employee_roles', 'employee_skills', 'employee_work_experiences',
    'employee_education', 'employee_languages', 'employee_certifications',
    'skills', 'sub_roles', 'roles', 'role_sub_role', 'skills_sub_roles_value'
  ],
  priority2: [
    'cv_extractions', 'cv_files', 'companies', 'tenants', 'tenant_users',
    'departments', 'projects', 'project_roles'
  ],
  priority3: [
    'soft_skills', 'assessment_templates', 'assessment_questions', 'assessment_instances',
    'employee_soft_skills', 'employee_soft_skill_assessments', 'job_family', 'job_family_soft_skills'
  ],
  priority4: [
    'engagement_templates', 'engagement_campaigns', 'engagement_questions',
    'engagement_results', 'engagement_responses'
  ],
  priority5: [
    'llm_usage_logs', 'assessment_generation_logs', 'tenant_audit_log',
    'migration_log', 'notifications'
  ],
  priority6: [
    'project_assignments', 'project_matching_results', 'project_milestones',
    'project_activity_logs', 'action_plans'
  ],
  priority7: [
    'certifications', 'TenantCertification', 'languages', 'language_proficiency_levels',
    'education_degrees', 'industries'
  ]
};

/**
 * Extract JSDoc comments from Prisma schema
 */
function parsePrismaSchemaJSDoc(schemaPath) {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const modelJSDocs = {};

  // Parse model-level JSDoc
  const modelRegex = /\/\/\/([\s\S]*?)model\s+(\w+)\s*\{/g;
  let match;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const [, jsDoc, modelName] = match;
    modelJSDocs[modelName] = {
      description: jsDoc.trim().replace(/^\/\/\/ ?/gm, '').trim(),
      fields: {}
    };
  }

  // Parse field-level JSDoc
  const fieldRegex = /\/\/\/ (.+?)\n\s+(\w+)\s+/g;
  const currentModels = Object.keys(modelJSDocs);

  // For each model, find field comments
  currentModels.forEach(modelName => {
    const modelStart = schemaContent.indexOf(`model ${modelName} {`);
    const modelEnd = schemaContent.indexOf('}', modelStart);
    const modelSection = schemaContent.substring(modelStart, modelEnd);

    const fieldComments = {};
    const lines = modelSection.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('///')) {
        const comment = line.replace(/^.*\/\/\/\s*/, '').trim();
        const nextLine = lines[i + 1];
        const fieldMatch = nextLine?.match(/^\s+(\w+)\s+/);
        if (fieldMatch) {
          fieldComments[fieldMatch[1]] = comment;
        }
      }
    }

    if (Object.keys(fieldComments).length > 0) {
      modelJSDocs[modelName].fields = fieldComments;
    }
  });

  return modelJSDocs;
}

/**
 * Get table schema from database
 */
async function getTableSchema(tableName) {
  // Get columns
  const columns = await prisma.$queryRawUnsafe(`
    SELECT
      column_name,
      data_type,
      udt_name,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, tableName);

  // Get primary keys
  const primaryKeys = await prisma.$queryRawUnsafe(`
    SELECT a.attname AS column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary
  `, tableName);

  // Get foreign keys
  const foreignKeys = await prisma.$queryRawUnsafe(`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
  `, tableName);

  // Get unique constraints
  const uniqueConstraints = await prisma.$queryRawUnsafe(`
    SELECT
      conname AS constraint_name,
      array_agg(a.attname) AS columns
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.contype = 'u'
      AND nsp.nspname = 'public'
      AND rel.relname = $1
    GROUP BY conname
  `, tableName);

  // Get indexes
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT
      i.relname AS index_name,
      array_agg(a.attname) AS columns,
      am.amname AS index_type
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_am am ON i.relam = am.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relkind = 'r'
      AND t.relname = $1
      AND NOT ix.indisprimary
    GROUP BY i.relname, am.amname
  `, tableName);

  // Get check constraints
  const checkConstraints = await prisma.$queryRawUnsafe(`
    SELECT
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass
      AND contype = 'c'
  `, tableName);

  return {
    columns,
    primaryKeys: primaryKeys.map(pk => pk.column_name),
    foreignKeys,
    uniqueConstraints,
    indexes,
    checkConstraints
  };
}

/**
 * Categorize fields based on naming and type patterns
 */
function categorizeField(fieldName, dataType) {
  const lower = fieldName.toLowerCase();

  // Identifiers
  if (lower.endsWith('_id') || lower === 'id') {
    return 'identifier';
  }

  // Timestamps
  if (lower.includes('date') || lower.includes('at') || lower === 'timestamp') {
    return 'timestamp';
  }

  // Status/State
  if (lower.includes('status') || lower.includes('state') || lower.includes('is_') || lower.startsWith('has_')) {
    return 'status';
  }

  // Configuration
  if (lower.includes('config') || lower.includes('settings') || lower.includes('options')) {
    return 'configuration';
  }

  // Metadata
  if (lower.includes('metadata') || lower.includes('meta_') || lower.includes('_by')) {
    return 'metadata';
  }

  // Scores/Metrics
  if (lower.includes('score') || lower.includes('count') || lower.includes('percentage') || lower.includes('rate')) {
    return 'metric';
  }

  // Default
  return 'data';
}

/**
 * Determine relation type from foreign keys
 */
function determineRelationType(tableName, foreignKeys, allTables) {
  const relations = [];

  foreignKeys.forEach(fk => {
    // Check if it's 1:1 (unique FK)
    const is1to1 = fk.column_name === 'id' || fk.column_name.endsWith('_id');

    // Check if target table has FK back (N:M via junction)
    const targetTableFKs = allTables[fk.foreign_table_name]?.foreignKeys || [];
    const hasReverseFKToThisTable = targetTableFKs.some(tfk => tfk.foreign_table_name === tableName);

    let relationType;
    if (hasReverseFKToThisTable) {
      relationType = 'N:M (via junction table)';
    } else if (is1to1) {
      relationType = '1:1';
    } else {
      relationType = 'N:1';
    }

    relations.push({
      type: relationType,
      column: fk.column_name,
      targetTable: fk.foreign_table_name,
      targetColumn: fk.foreign_column_name,
      onDelete: fk.delete_rule,
      onUpdate: fk.update_rule
    });
  });

  return relations;
}

/**
 * Generate MCP-compatible query examples
 */
function generateMCPQueries(tableName, schema, relations) {
  const queries = [];

  // Basic SELECT
  queries.push({
    name: `get_all_${tableName}`,
    description: `Retrieve all records from ${tableName}`,
    query: `SELECT * FROM ${tableName} LIMIT 100`
  });

  // SELECT with FK join (if has relations)
  if (relations.length > 0) {
    const mainRelation = relations[0];
    queries.push({
      name: `get_${tableName}_with_${mainRelation.targetTable}`,
      description: `Get ${tableName} with related ${mainRelation.targetTable} data`,
      query: `
SELECT
  t.*,
  r.*
FROM ${tableName} t
LEFT JOIN ${mainRelation.targetTable} r ON t.${mainRelation.column} = r.${mainRelation.targetColumn}
LIMIT 100`.trim()
    });
  }

  // SELECT with WHERE (if has tenant_id)
  if (schema.columns.some(col => col.column_name === 'tenant_id')) {
    queries.push({
      name: `get_${tableName}_by_tenant`,
      description: `Filter ${tableName} by tenant ID`,
      query: `SELECT * FROM ${tableName} WHERE tenant_id = $1 LIMIT 100`
    });
  }

  // INSERT example
  const insertColumns = schema.columns
    .filter(col => !col.column_default?.includes('nextval') && col.column_name !== 'id')
    .slice(0, 5)
    .map(col => col.column_name);

  queries.push({
    name: `insert_${tableName}`,
    description: `Insert new record into ${tableName}`,
    query: `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES ($1, $2, $3, $4, $5) RETURNING *`
  });

  // UPDATE example
  queries.push({
    name: `update_${tableName}`,
    description: `Update ${tableName} record by ID`,
    query: `UPDATE ${tableName} SET updated_at = NOW() WHERE id = $1 RETURNING *`
  });

  // DELETE example
  queries.push({
    name: `delete_${tableName}`,
    description: `Delete ${tableName} record by ID`,
    query: `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`
  });

  return queries;
}

/**
 * Generate markdown documentation for a table
 */
function generateTableMarkdown(tableName, schema, jsDoc, relations, priority) {
  let md = `# Table: \`${tableName}\`\n\n`;

  // Priority
  md += `**Priority**: ${priority}\n\n`;

  // Description from JSDoc
  if (jsDoc?.description) {
    md += `## Description\n\n${jsDoc.description}\n\n`;
  }

  // Table statistics
  md += `## Statistics\n\n`;
  md += `- **Total Columns**: ${schema.columns.length}\n`;
  md += `- **Primary Key**: ${schema.primaryKeys.join(', ')}\n`;
  md += `- **Foreign Keys**: ${schema.foreignKeys.length}\n`;
  md += `- **Unique Constraints**: ${schema.uniqueConstraints.length}\n`;
  md += `- **Indexes**: ${schema.indexes.length}\n\n`;

  // Schema
  md += `## Schema\n\n`;
  md += `| Column | Type | Nullable | Default | Description |\n`;
  md += `|--------|------|----------|---------|-------------|\n`;

  schema.columns.forEach(col => {
    const isPK = schema.primaryKeys.includes(col.column_name);
    const fieldDesc = jsDoc?.fields[col.column_name] || '';
    const typeStr = col.character_maximum_length
      ? `${col.data_type}(${col.character_maximum_length})`
      : col.data_type;

    md += `| ${isPK ? '🔑 ' : ''}${col.column_name} | ${typeStr} | ${col.is_nullable} | ${col.column_default || '-'} | ${fieldDesc} |\n`;
  });
  md += `\n`;

  // Field Categories
  const categories = {};
  schema.columns.forEach(col => {
    const category = categorizeField(col.column_name, col.data_type);
    if (!categories[category]) categories[category] = [];
    categories[category].push(col.column_name);
  });

  md += `## Field Categories\n\n`;
  Object.entries(categories).forEach(([category, fields]) => {
    md += `- **${category}**: ${fields.join(', ')}\n`;
  });
  md += `\n`;

  // Relations
  if (relations.length > 0) {
    md += `## Relations\n\n`;
    relations.forEach(rel => {
      md += `- **${rel.type}**: \`${rel.column}\` → \`${rel.targetTable}.${rel.targetColumn}\`\n`;
      md += `  - ON DELETE: ${rel.onDelete}\n`;
      md += `  - ON UPDATE: ${rel.onUpdate}\n`;
    });
    md += `\n`;
  }

  // Foreign Keys Detail
  if (schema.foreignKeys.length > 0) {
    md += `## Foreign Keys\n\n`;
    schema.foreignKeys.forEach(fk => {
      md += `- \`${fk.column_name}\` → \`${fk.foreign_table_name}.${fk.foreign_column_name}\`\n`;
    });
    md += `\n`;
  }

  // Unique Constraints
  if (schema.uniqueConstraints.length > 0) {
    md += `## Unique Constraints\n\n`;
    schema.uniqueConstraints.forEach(uc => {
      md += `- **${uc.constraint_name}**: ${uc.columns.join(', ')}\n`;
    });
    md += `\n`;
  }

  // Indexes
  if (schema.indexes.length > 0) {
    md += `## Indexes\n\n`;
    schema.indexes.forEach(idx => {
      md += `- **${idx.index_name}** (${idx.index_type}): ${idx.columns.join(', ')}\n`;
    });
    md += `\n`;
  }

  // Check Constraints
  if (schema.checkConstraints.length > 0) {
    md += `## Check Constraints\n\n`;
    schema.checkConstraints.forEach(chk => {
      md += `- **${chk.constraint_name}**: \`${chk.definition}\`\n`;
    });
    md += `\n`;
  }

  // MCP Queries
  const queries = generateMCPQueries(tableName, schema, relations);
  md += `## MCP Query Examples\n\n`;
  queries.forEach(q => {
    md += `### ${q.name}\n\n`;
    md += `${q.description}\n\n`;
    md += `\`\`\`sql\n${q.query}\n\`\`\`\n\n`;
  });

  return md;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting MCP Table Documentation Generation\n');

  // Create output directory
  const outputDir = path.join(__dirname, 'tables');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Parse Prisma schema JSDoc
  console.log('📖 Parsing Prisma schema JSDoc...');
  const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
  const jsDocComments = parsePrismaSchemaJSDoc(schemaPath);
  console.log(`   Found JSDoc for ${Object.keys(jsDocComments).length} models\n`);

  // Get all tables from database (exclude Prisma internal tables starting with _)
  console.log('🔍 Fetching table list from database...');
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '\\_%'
    ORDER BY table_name
  `);

  const tableNames = tables.map(t => t.table_name);
  console.log(`   Found ${tableNames.length} tables (excluding Prisma internal tables)\n`);

  // Fetch schema for all tables (for relation detection)
  console.log('📊 Fetching schema for all tables...');
  const allTablesSchema = {};
  for (const tableName of tableNames) {
    allTablesSchema[tableName] = await getTableSchema(tableName);
  }
  console.log('   Schema fetched for all tables\n');

  // Determine priority for each table
  const tablePriorities = {};
  Object.entries(PRIORITY_TABLES).forEach(([priority, tables]) => {
    tables.forEach(table => {
      tablePriorities[table] = priority.replace('priority', 'Priority ');
    });
  });

  // Generate documentation for each table
  console.log('✍️  Generating documentation files...\n');
  let generatedCount = 0;

  for (const tableName of tableNames) {
    const schema = allTablesSchema[tableName];
    const jsDoc = jsDocComments[tableName];
    const priority = tablePriorities[tableName] || 'Priority 7 (Other)';

    // Determine relations
    const relations = determineRelationType(tableName, schema.foreignKeys, allTablesSchema);

    // Generate markdown
    const markdown = generateTableMarkdown(tableName, schema, jsDoc, relations, priority);

    // Write file
    const outputPath = path.join(outputDir, `${tableName}.md`);
    fs.writeFileSync(outputPath, markdown, 'utf8');

    console.log(`   ✓ ${tableName}.md (${priority})`);
    generatedCount++;
  }

  console.log(`\n✅ Generated ${generatedCount} table documentation files in ./tables/\n`);

  // Generate index file
  console.log('📋 Generating index.md...');
  let indexMd = `# Moobee Database Tables Documentation\n\n`;
  indexMd += `Generated: ${new Date().toISOString()}\n\n`;
  indexMd += `Total Tables: ${tableNames.length}\n\n`;

  // Group by priority
  Object.entries(PRIORITY_TABLES).forEach(([priority, tables]) => {
    const priorityLabel = priority.replace('priority', 'Priority ');
    indexMd += `## ${priorityLabel}\n\n`;
    tables.filter(t => tableNames.includes(t)).forEach(table => {
      indexMd += `- [${table}](${table}.md)\n`;
    });
    indexMd += `\n`;
  });

  // Other tables
  const otherTables = tableNames.filter(t => !tablePriorities[t]);
  if (otherTables.length > 0) {
    indexMd += `## Other Tables\n\n`;
    otherTables.forEach(table => {
      indexMd += `- [${table}](${table}.md)\n`;
    });
  }

  fs.writeFileSync(path.join(outputDir, 'index.md'), indexMd, 'utf8');
  console.log('   ✓ index.md created\n');

  console.log('🎉 MCP Table Documentation Generation Complete!\n');
}

// Execute
main()
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
