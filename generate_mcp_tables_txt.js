/**
 * Generate MCP Table Documentation (TXT Format)
 *
 * Generates comprehensive table documentation in the exact MCP format specified,
 * reading directly from Railway PostgreSQL database and Prisma schema.
 *
 * Output: TXT files in ./tables/ directory
 *
 * Based on: Original MCP prompt format (tables/Account.txt style)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Priority table lists
const PRIORITY_TABLES = {
  priority1: [
    'employees', 'companies', 'cv_files', 'cv_extractions',
    'skills', 'assessments', 'projects', 'project_roles',
    'employee_roles', 'employee_skills', 'employee_work_experiences',
    'role_sub_role', 'sub_roles', 'roles'
  ],
  priority2: [
    'tenants', 'tenant_users', 'departments',
    'soft_skills', 'assessment_templates'
  ],
  priority3: [] // Tutte le altre
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
    const description = jsDoc.trim().replace(/^\/\/\/ ?/gm, '').trim();

    modelJSDocs[modelName] = {
      description: description || `Tabella ${modelName}`,
      fields: {}
    };
  }

  // Parse field-level JSDoc
  Object.keys(modelJSDocs).forEach(modelName => {
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
 * Get complete table schema from database
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

  // Get ENUM types used in this table
  const enumTypes = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT
      c.column_name,
      t.typname AS enum_name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
    FROM information_schema.columns c
    JOIN pg_type t ON c.udt_name = t.typname
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE c.table_schema = 'public'
      AND c.table_name = $1
      AND t.typtype = 'e'
    GROUP BY c.column_name, t.typname
  `, tableName);

  return {
    columns,
    primaryKeys: primaryKeys.map(pk => pk.column_name),
    foreignKeys,
    uniqueConstraints,
    indexes,
    checkConstraints,
    enumTypes
  };
}

/**
 * Get reverse foreign keys (tables that reference this table)
 */
async function getReverseForeignKeys(tableName) {
  const reverseFKs = await prisma.$queryRawUnsafe(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.column_name AS target_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = $1
      AND tc.table_schema = 'public'
  `, tableName);

  return reverseFKs;
}

/**
 * Categorize field
 */
function categorizeField(fieldName, dataType, isPK, isFK) {
  const lower = fieldName.toLowerCase();

  if (isPK || lower === 'id' || lower === 'uuid') return 'IDENTIFICATIVI';
  if (isFK) return 'RELAZIONI PRINCIPALI';

  // Dati anagrafici
  if (['name', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'country'].some(f => lower.includes(f))) {
    return 'DATI ANAGRAFICI';
  }

  // Stati e flags
  if (lower.includes('status') || lower.includes('is_') || lower.includes('has_') || lower.includes('can_')) {
    return 'STATI E FLAGS';
  }

  // Date e timestamp
  if (lower.includes('date') || lower.includes('_at') || lower === 'timestamp') {
    return 'DATE E TIMESTAMP';
  }

  // Dati descrittivi
  if (lower.includes('description') || lower.includes('notes') || lower.includes('comment')) {
    return 'DATI DESCRITTIVI';
  }

  // Dati tecnici
  if (lower.includes('hash') || lower.includes('token') || lower.includes('config') || lower.includes('metadata') || lower.includes('settings')) {
    return 'DATI TECNICI';
  }

  // Default
  return 'ALTRI CAMPI';
}

/**
 * Format PostgreSQL type for display
 */
function formatType(column) {
  let type = column.data_type;

  if (column.character_maximum_length) {
    type += `(${column.character_maximum_length})`;
  }

  if (column.udt_name.startsWith('_')) {
    type = column.udt_name.substring(1) + '[]'; // Array type
  }

  return type;
}

/**
 * Generate field attributes string
 */
function getFieldAttributes(column, schema, jsDoc) {
  const attrs = [];

  // Primary key
  if (schema.primaryKeys.includes(column.column_name)) {
    attrs.push('[PRIMARY KEY]');
  }

  // Required/Not null
  if (column.is_nullable === 'NO' && !schema.primaryKeys.includes(column.column_name)) {
    attrs.push('[REQUIRED]');
  }

  // Unique
  const isUnique = schema.uniqueConstraints.some(uc =>
    uc.columns.length === 1 && uc.columns[0] === column.column_name
  );
  if (isUnique) {
    attrs.push('[UNIQUE]');
  }

  // Foreign key
  const fk = schema.foreignKeys.find(fk => fk.column_name === column.column_name);
  if (fk) {
    attrs.push(`[FK verso ${fk.foreign_table_name}]`);
  }

  // Default value
  if (column.column_default && !column.column_default.includes('nextval')) {
    let defaultVal = column.column_default.replace(/::.*$/, '').replace(/'/g, '');
    attrs.push(`[DEFAULT: ${defaultVal}]`);
  }

  // ENUM
  const enumType = schema.enumTypes.find(e => e.column_name === column.column_name);
  if (enumType) {
    attrs.push(`[ENUM: ${enumType.enum_values.join(', ')}]`);
  }

  // Array
  if (column.udt_name.startsWith('_')) {
    attrs.push('[ARRAY]');
  }

  // JSONB
  if (column.data_type === 'jsonb' || column.data_type === 'json') {
    attrs.push('[JSONB]');
  }

  return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

/**
 * Determine relation cardinality
 */
function getRelationCardinality(tableName, fk, reverseFKs, allSchemas) {
  // Check if it's a junction table (N:M)
  const thisTableFKs = allSchemas[tableName]?.foreignKeys || [];
  const targetTableFKs = allSchemas[fk.foreign_table_name]?.foreignKeys || [];

  // If this table has FK to target AND target has FK back to this → likely N:M via junction
  const hasReverse = targetTableFKs.some(tfk => tfk.foreign_table_name === tableName);
  if (hasReverse && thisTableFKs.length >= 2) {
    return 'N:M';
  }

  // Check if FK is unique (1:1)
  const uniqueCols = allSchemas[tableName]?.uniqueConstraints
    .filter(uc => uc.columns.length === 1)
    .map(uc => uc.columns[0]) || [];

  if (uniqueCols.includes(fk.column_name)) {
    return '1:1';
  }

  // Default: N:1 (many-to-one)
  return 'N:1';
}

/**
 * Generate business rules from constraints
 */
function generateBusinessRules(tableName, schema) {
  const rules = [];

  // Unique constraints
  schema.uniqueConstraints.forEach(uc => {
    if (uc.columns.length === 1) {
      rules.push(`Il campo ${uc.columns[0]} deve essere unico nel sistema`);
    } else {
      rules.push(`La combinazione ${uc.columns.join(' + ')} deve essere unica`);
    }
  });

  // Required fields (excluding PKs)
  const requiredFields = schema.columns
    .filter(col => col.is_nullable === 'NO' && !schema.primaryKeys.includes(col.column_name))
    .map(col => col.column_name);

  if (requiredFields.length > 0 && requiredFields.length <= 5) {
    rules.push(`Campi obbligatori: ${requiredFields.join(', ')}`);
  }

  // FK cascade rules
  schema.foreignKeys.forEach(fk => {
    if (fk.delete_rule === 'CASCADE') {
      rules.push(`La cancellazione di ${fk.foreign_table_name} cancella automaticamente questo record`);
    } else if (fk.delete_rule === 'SET NULL') {
      rules.push(`La cancellazione di ${fk.foreign_table_name} imposta ${fk.column_name} a NULL`);
    }
  });

  // Check constraints
  schema.checkConstraints.forEach(chk => {
    const def = chk.definition.replace(/CHECK\s*\(/, '').replace(/\)$/, '');
    rules.push(`Vincolo: ${def}`);
  });

  // Default rules
  const hasCreatedAt = schema.columns.some(col => col.column_name === 'created_at');
  const hasIsActive = schema.columns.some(col => col.column_name === 'is_active');

  if (hasCreatedAt) {
    rules.push('Il timestamp di creazione viene impostato automaticamente');
  }

  if (hasIsActive) {
    rules.push('I nuovi record sono attivi per default (soft delete)');
  }

  return rules;
}

/**
 * Generate common queries
 */
function generateCommonQueries(tableName, schema) {
  const queries = [];
  const hasTenantId = schema.columns.some(col => col.column_name === 'tenant_id');
  const hasIsActive = schema.columns.some(col => col.column_name === 'is_active');
  const mainFK = schema.foreignKeys[0];

  // Query 1: Simple select
  const selectFields = schema.columns.slice(0, 5).map(col => col.column_name);
  const whereCondition = hasTenantId ? { tenant_id: "uuid_tenant" } : (hasIsActive ? { is_active: true } : {});

  queries.push({
    description: `Recupera tutti i record di ${tableName}${hasTenantId ? ' per un tenant' : ''}`,
    query: {
      table: tableName,
      select: selectFields,
      ...(Object.keys(whereCondition).length > 0 && { where: whereCondition }),
      limit: 100
    }
  });

  // Query 2: With JOIN (if has FK)
  if (mainFK) {
    queries.push({
      description: `Recupera ${tableName} con dati di ${mainFK.foreign_table_name}`,
      query: {
        table: tableName,
        select: ['*'],
        leftJoin: [{
          table: mainFK.foreign_table_name,
          first: `${tableName}.${mainFK.column_name}`,
          second: `${mainFK.foreign_table_name}.${mainFK.foreign_column_name}`
        }],
        limit: 50
      }
    });
  }

  // Query 3: Search query (if has name/email/description field)
  const searchableField = schema.columns.find(col =>
    ['name', 'email', 'title', 'description'].some(f => col.column_name.includes(f))
  );

  if (searchableField) {
    queries.push({
      description: `Ricerca ${tableName} per ${searchableField.column_name}`,
      query: {
        table: tableName,
        select: ['*'],
        where: {
          [searchableField.column_name]: { operator: 'like', value: '%search%' }
        },
        limit: 20
      }
    });
  }

  // Query 4: Count/Aggregation (if has created_at)
  if (schema.columns.some(col => col.column_name === 'created_at')) {
    queries.push({
      description: `Conta ${tableName} creati nell'ultimo mese`,
      query: {
        table: tableName,
        select: ['COUNT(*) as total'],
        where: {
          created_at: { operator: '>=', value: 'NOW() - INTERVAL \'30 days\'' }
        }
      }
    });
  }

  return queries;
}

/**
 * Generate TXT file content in MCP format
 */
function generateTableTXT(tableName, schema, jsDoc, reverseFKs, allSchemas, priority) {
  let txt = '';

  // Header
  txt += `TABELLA: ${tableName}\n`;
  txt += `DESCRIZIONE: ${jsDoc?.description || `Tabella per la gestione di ${tableName}`}\n\n`;

  txt += `CAMPI UTILIZZABILI (USA ESATTAMENTE QUESTI NOMI):\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Group fields by category
  const fieldsByCategory = {};
  schema.columns.forEach(col => {
    const isPK = schema.primaryKeys.includes(col.column_name);
    const isFK = schema.foreignKeys.some(fk => fk.column_name === col.column_name);
    const category = categorizeField(col.column_name, col.data_type, isPK, isFK);

    if (!fieldsByCategory[category]) {
      fieldsByCategory[category] = [];
    }

    fieldsByCategory[category].push(col);
  });

  // Output fields by category
  Object.entries(fieldsByCategory).forEach(([category, fields]) => {
    txt += `${category}:\n`;
    fields.forEach(col => {
      const type = formatType(col);
      const description = jsDoc?.fields[col.column_name] || `Campo ${col.column_name}`;
      const attributes = getFieldAttributes(col, schema, jsDoc);

      txt += `- ${col.column_name} (${type}): ${description}${attributes}\n`;
    });
    txt += `\n`;
  });

  // Relations
  txt += `RELAZIONI:\n`;
  txt += `━━━━━━━━━━\n`;

  // Outgoing FKs (N:1 or 1:1)
  schema.foreignKeys.forEach(fk => {
    const cardinality = getRelationCardinality(tableName, fk, reverseFKs, allSchemas);
    txt += `- ${fk.foreign_table_name} (${cardinality}): Collegamento via ${fk.column_name}\n`;
    txt += `  * ON DELETE: ${fk.delete_rule}\n`;
    txt += `  * ON UPDATE: ${fk.update_rule}\n`;
  });

  // Incoming FKs (1:N)
  reverseFKs.forEach(rfk => {
    txt += `- ${rfk.source_table} (1:N): ${rfk.source_table} referenzia questa tabella via ${rfk.source_column}\n`;
  });

  if (schema.foreignKeys.length === 0 && reverseFKs.length === 0) {
    txt += `Nessuna relazione diretta con altre tabelle.\n`;
  }
  txt += `\n`;

  // ENUM types section (if any)
  if (schema.enumTypes.length > 0) {
    txt += `STATI E VALORI ENUM:\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━\n`;
    schema.enumTypes.forEach(enumType => {
      txt += `${enumType.column_name.toUpperCase()} (${enumType.enum_name}):\n`;
      enumType.enum_values.forEach(val => {
        txt += `  - ${val}\n`;
      });
    });
    txt += `\n`;
  }

  // Business rules
  const rules = generateBusinessRules(tableName, schema);
  if (rules.length > 0) {
    txt += `REGOLE BUSINESS:\n`;
    txt += `━━━━━━━━━━━━━━━━\n`;
    rules.forEach((rule, idx) => {
      txt += `${idx + 1}. ${rule}\n`;
    });
    txt += `\n`;
  }

  // Common queries
  const queries = generateCommonQueries(tableName, schema);
  txt += `QUERY COMUNI:\n`;
  txt += `━━━━━━━━━━━━\n\n`;
  queries.forEach((q, idx) => {
    txt += `${idx + 1}. ${q.description}:\n`;
    txt += JSON.stringify(q.query, null, 2);
    txt += `\n\n`;
  });

  // Important notes
  txt += `NOTE IMPORTANTI:\n`;
  txt += `━━━━━━━━━━━━━━━\n`;

  // Auto-generate notes based on table characteristics
  const notes = [];

  if (schema.columns.some(col => col.column_name === 'tenant_id')) {
    notes.push('Tabella multi-tenant: tutti i record sono isolati per tenant_id');
  }

  if (schema.columns.some(col => col.column_name === 'is_active')) {
    notes.push('Utilizza soft delete: impostare is_active=false invece di cancellare');
  }

  if (schema.columns.some(col => col.column_name === 'password' || col.column_name.includes('hash'))) {
    notes.push('⚠️ SECURITY: Le password devono essere sempre hashate (bcrypt, argon2)');
  }

  if (schema.indexes.length > 3) {
    notes.push(`Performance: Tabella ottimizzata con ${schema.indexes.length} indici`);
  }

  if (schema.foreignKeys.length > 5) {
    notes.push('Tabella centrale con molte relazioni: prestare attenzione alle query JOIN');
  }

  // Add JSON schema note if has JSONB field
  const jsonbField = schema.columns.find(col => col.data_type === 'jsonb');
  if (jsonbField) {
    notes.push(`Campo ${jsonbField.column_name} (JSONB): verificare schema JSON atteso nella documentazione`);
  }

  if (notes.length === 0) {
    notes.push('Tabella standard senza particolari note operative');
  }

  notes.forEach(note => {
    txt += `- ${note}\n`;
  });

  return txt;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting MCP Table Documentation Generation (TXT Format)\n');

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

  // Get all tables from database
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
  console.log(`   Found ${tableNames.length} tables\n`);

  // Fetch schema for all tables
  console.log('📊 Fetching schema for all tables...');
  const allSchemas = {};
  for (const tableName of tableNames) {
    allSchemas[tableName] = await getTableSchema(tableName);
  }
  console.log('   Schema fetched for all tables\n');

  // Fetch reverse FKs for all tables
  console.log('🔗 Analyzing reverse foreign keys...');
  const allReverseFKs = {};
  for (const tableName of tableNames) {
    allReverseFKs[tableName] = await getReverseForeignKeys(tableName);
  }
  console.log('   Reverse FK analysis complete\n');

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

  // Order: Priority 1, then Priority 2, then rest
  const orderedTables = [
    ...PRIORITY_TABLES.priority1.filter(t => tableNames.includes(t)),
    ...PRIORITY_TABLES.priority2.filter(t => tableNames.includes(t)),
    ...tableNames.filter(t => !tablePriorities[t])
  ];

  for (const tableName of orderedTables) {
    const schema = allSchemas[tableName];
    const jsDoc = jsDocComments[tableName];
    const reverseFKs = allReverseFKs[tableName];
    const priority = tablePriorities[tableName] || 'Priority 3 (Other)';

    // Generate TXT content
    const txtContent = generateTableTXT(tableName, schema, jsDoc, reverseFKs, allSchemas, priority);

    // Write file
    const outputPath = path.join(outputDir, `${tableName}.txt`);
    fs.writeFileSync(outputPath, txtContent, 'utf8');

    console.log(`   ✓ ${tableName}.txt (${priority})`);
    generatedCount++;
  }

  console.log(`\n✅ Generated ${generatedCount} table documentation files in ./tables/\n`);

  // Generate index file
  console.log('📋 Generating INDEX.txt...');
  let indexTxt = `MOOBEE DATABASE - INDICE TABELLE\n`;
  indexTxt += `═══════════════════════════════════\n\n`;
  indexTxt += `Generated: ${new Date().toISOString()}\n`;
  indexTxt += `Total Tables: ${tableNames.length}\n\n`;

  // Group by priority
  indexTxt += `PRIORITY 1 - HR/Recruitment Core (${PRIORITY_TABLES.priority1.filter(t => tableNames.includes(t)).length} tabelle):\n`;
  indexTxt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  PRIORITY_TABLES.priority1.filter(t => tableNames.includes(t)).forEach(table => {
    indexTxt += `- ${table}.txt\n`;
  });
  indexTxt += `\n`;

  indexTxt += `PRIORITY 2 - System/Auth (${PRIORITY_TABLES.priority2.filter(t => tableNames.includes(t)).length} tabelle):\n`;
  indexTxt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  PRIORITY_TABLES.priority2.filter(t => tableNames.includes(t)).forEach(table => {
    indexTxt += `- ${table}.txt\n`;
  });
  indexTxt += `\n`;

  const otherTables = tableNames.filter(t => !tablePriorities[t]);
  indexTxt += `PRIORITY 3 - Altre tabelle (${otherTables.length} tabelle):\n`;
  indexTxt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  otherTables.forEach(table => {
    indexTxt += `- ${table}.txt\n`;
  });

  fs.writeFileSync(path.join(outputDir, 'INDEX.txt'), indexTxt, 'utf8');
  console.log('   ✓ INDEX.txt created\n');

  console.log('🎉 MCP Table Documentation Generation Complete!\n');
  console.log('📁 Output directory: ./tables/\n');
  console.log('📋 Format: MCP-compatible TXT files\n');
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
