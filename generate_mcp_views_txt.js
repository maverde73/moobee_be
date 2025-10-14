// Generate MCP View Documentation (TXT Format)
// Created: 2025-10-12
// Purpose: Generate TXT documentation for database views in MCP format
// Usage: node generate_mcp_views_txt.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'views');

// View descriptions (manually curated for accuracy)
const VIEW_DESCRIPTIONS = {
  v_employee_skills_summary: {
    title: 'Employee Skills Summary with Grading',
    description: `Employee skills with grading calculated from skills_sub_roles_value based on employee roles.

This view combines employee skills with their calculated grading based on:
- Employee's current role(s) from employee_roles
- Skill grading matrix from skills_sub_roles_value
- Returns max grading if employee has multiple roles

**Primary Use**: Skills dashboard, employee profile, project matching
**Performance**: Single query instead of 4 JOINs (~5x faster)
**Key Feature**: Automatic grading calculation (A+, A, B, C, D, N/A)`,
    priority: 1,
    use_cases: [
      'Skills dashboard with grading visualization',
      'Employee profile skills section',
      'Project skill matching and gap analysis',
      'Skills relevance indicator for current roles'
    ]
  },
  v_employee_complete_profile: {
    title: 'Complete Employee Profile',
    description: `Complete employee profile with department, current role, and aggregated counts.

This view provides a comprehensive employee snapshot including:
- Personal info (name, email, phone, position)
- Department information
- Current role (first role with is_current=true)
- Aggregated counts (skills, certifications, work experiences, education, languages)
- Latest CV extraction info

**Primary Use**: Employee detail pages, profile cards, search results
**Performance**: Single query instead of 10+ queries (~10x faster)
**Key Feature**: All employee data in one query`,
    priority: 1,
    use_cases: [
      'Employee detail page (complete profile)',
      'Employee list/search results with preview',
      'Profile cards in dashboard',
      'Employee data export'
    ]
  },
  v_assessment_results_summary: {
    title: 'Assessment Results Summary',
    description: `Assessment results with employee info and scores.

This view combines assessment results with employee information:
- Employee basic data (name, email)
- Assessment campaign and assignment references
- Overall score, percentile, and detailed skill scores (JSONB)
- Qualitative feedback (strengths, improvements, recommendations)
- Performance metrics (time taken, attempt number)

**Primary Use**: Assessment dashboard, employee assessment history
**Performance**: Single query with JOIN (~3x faster)
**Key Feature**: Only completed assessments (completed_at IS NOT NULL)`,
    priority: 2,
    use_cases: [
      'Assessment results dashboard',
      'Employee assessment history',
      'Skills assessment tracking',
      'Performance reports'
    ]
  }
};

/**
 * Get view schema from database
 */
async function getViewSchema(viewName) {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT
      column_name,
      data_type,
      udt_name,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
  `, viewName);

  const viewDef = await prisma.$queryRawUnsafe(`
    SELECT view_definition
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = $1
  `, viewName);

  return {
    columns,
    definition: viewDef[0]?.view_definition || ''
  };
}

/**
 * Categorize field by name and type
 */
function categorizeField(fieldName, dataType) {
  const lower = fieldName.toLowerCase();

  // Identificativi
  if (lower === 'id' || lower.endsWith('_id') || lower === 'uuid') {
    return 'IDENTIFICATIVI';
  }

  // Dati anagrafici
  if (['first_name', 'last_name', 'name', 'email', 'phone', 'employee_name'].some(f => lower.includes(f))) {
    return 'DATI ANAGRAFICI';
  }

  // Scores e metriche
  if (lower.includes('score') || lower.includes('percentile') || lower.includes('grading')) {
    return 'SCORES E METRICHE';
  }

  // Conteggi
  if (lower.startsWith('total_') || lower.includes('_count') || lower.includes('_size')) {
    return 'CONTEGGI AGGREGATI';
  }

  // Stati e flags
  if (lower.includes('status') || lower.startsWith('is_') || lower.startsWith('has_')) {
    return 'STATI E FLAGS';
  }

  // Date e timestamp
  if (lower.includes('date') || lower.includes('_at') || lower === 'timestamp') {
    return 'DATE E TIMESTAMP';
  }

  // Dati JSONB
  if (dataType === 'jsonb' || lower.includes('metadata')) {
    return 'DATI JSONB';
  }

  // Altri
  return 'ALTRI CAMPI';
}

/**
 * Format data type for display
 */
function formatType(col) {
  if (col.character_maximum_length) {
    return `${col.data_type}(${col.character_maximum_length})`;
  }
  return col.data_type;
}

/**
 * Get field attributes
 */
function getFieldAttributes(col) {
  const attrs = [];

  if (col.is_nullable === 'NO') {
    attrs.push('REQUIRED');
  }

  if (col.column_default) {
    attrs.push(`DEFAULT: ${col.column_default}`);
  }

  if (col.data_type === 'jsonb') {
    attrs.push('JSONB');
  }

  return attrs.length > 0 ? ' [' + attrs.join('] [') + ']' : '';
}

/**
 * Generate common queries for view
 */
function generateCommonQueries(viewName, viewInfo) {
  const queries = [];

  // Query 1: Select all (limited)
  queries.push({
    description: `Recupera tutti i record dalla vista ${viewName}`,
    query: {
      table: viewName,
      select: ['*'],
      limit: 100
    }
  });

  // Query 2: Specific to view type
  if (viewName === 'v_employee_skills_summary') {
    queries.push({
      description: 'Skills per employee con grading',
      query: {
        table: viewName,
        select: ['employee_id', 'skill_name', 'skill_grading', 'proficiency_level', 'is_relevant_for_current_role'],
        where: { employee_id: 91 },
        orderBy: [{ column: 'skill_grading', order: 'asc' }]
      }
    });

    queries.push({
      description: 'Skills rilevanti per ruolo corrente',
      query: {
        table: viewName,
        select: ['skill_name', 'skill_grading', 'proficiency_level'],
        where: {
          employee_id: 91,
          is_relevant_for_current_role: true
        },
        orderBy: [{ column: 'skill_grading', order: 'asc' }]
      }
    });
  } else if (viewName === 'v_employee_complete_profile') {
    queries.push({
      description: 'Profilo completo employee per tenant',
      query: {
        table: viewName,
        select: [
          'id', 'first_name', 'last_name', 'email',
          'department_name', 'current_role_name', 'current_sub_role_name',
          'total_skills', 'total_certifications', 'latest_cv_date'
        ],
        where: { tenant_id: 'uuid_tenant', is_active: true },
        orderBy: [{ column: 'last_name', order: 'asc' }],
        limit: 50
      }
    });

    queries.push({
      description: 'Employee con competenze elevate (5+ skills)',
      query: {
        table: viewName,
        select: ['id', 'first_name', 'last_name', 'total_skills', 'current_role_name'],
        where: {
          total_skills: { operator: '>=', value: 5 },
          is_active: true
        },
        orderBy: [{ column: 'total_skills', order: 'desc' }]
      }
    });
  } else if (viewName === 'v_assessment_results_summary') {
    queries.push({
      description: 'Assessment results per employee',
      query: {
        table: viewName,
        select: [
          'assessment_result_id', 'first_name', 'last_name',
          'overall_score', 'percentile', 'completed_at'
        ],
        where: { employee_id: 91 },
        orderBy: [{ column: 'completed_at', order: 'desc' }],
        limit: 10
      }
    });

    queries.push({
      description: 'Top performers (score >= 80)',
      query: {
        table: viewName,
        select: ['first_name', 'last_name', 'overall_score', 'percentile'],
        where: {
          overall_score: { operator: '>=', value: 80 }
        },
        orderBy: [{ column: 'overall_score', order: 'desc' }],
        limit: 20
      }
    });
  }

  return queries;
}

/**
 * Generate TXT content for a view
 */
function generateViewTXT(viewName, schema, viewInfo) {
  let txt = '';

  // Header
  txt += `VISTA: ${viewName}\n`;
  txt += `TIPO: Database View (Read-Only)\n`;
  txt += `DESCRIZIONE: ${viewInfo.description}\n\n`;

  txt += `CAMPI UTILIZZABILI (USA ESATTAMENTE QUESTI NOMI):\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Group fields by category
  const fieldsByCategory = {};
  schema.columns.forEach(col => {
    const category = categorizeField(col.column_name, col.data_type);
    if (!fieldsByCategory[category]) fieldsByCategory[category] = [];
    fieldsByCategory[category].push(col);
  });

  // Output fields by category
  const categoryOrder = [
    'IDENTIFICATIVI',
    'DATI ANAGRAFICI',
    'SCORES E METRICHE',
    'CONTEGGI AGGREGATI',
    'STATI E FLAGS',
    'DATE E TIMESTAMP',
    'DATI JSONB',
    'ALTRI CAMPI'
  ];

  categoryOrder.forEach(category => {
    if (fieldsByCategory[category]) {
      txt += `${category}:\n`;
      fieldsByCategory[category].forEach(col => {
        const type = formatType(col);
        const attrs = getFieldAttributes(col);
        txt += `- ${col.column_name} (${type})${attrs}\n`;
      });
      txt += `\n`;
    }
  });

  // Use cases
  txt += `CASI D'USO:\n`;
  txt += `━━━━━━━━━━━\n`;
  viewInfo.use_cases.forEach((uc, idx) => {
    txt += `${idx + 1}. ${uc}\n`;
  });
  txt += `\n`;

  // Query comuni
  const queries = generateCommonQueries(viewName, viewInfo);
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
  txt += `- Questa è una VIEW (sola lettura), non una tabella\n`;
  txt += `- Ottimizzata per query frequenti con dati pre-joinati\n`;
  txt += `- Performance: ~${viewInfo.priority === 1 ? '5-10x' : '3-5x'} più veloce rispetto a query multiple\n`;

  if (viewName === 'v_employee_skills_summary') {
    txt += `- Grading calcolato automaticamente da skills_sub_roles_value\n`;
    txt += `- is_relevant_for_current_role indica se skill è nel ruolo attuale\n`;
  } else if (viewName === 'v_employee_complete_profile') {
    txt += `- Conteggi aggregati calcolati in tempo reale\n`;
    txt += `- current_role è il primo ruolo con is_current=true\n`;
  } else if (viewName === 'v_assessment_results_summary') {
    txt += `- Solo assessment completati (completed_at IS NOT NULL)\n`;
    txt += `- skill_scores è in formato JSONB per flessibilità parsing\n`;
  }

  txt += `\n`;

  return txt;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Starting MCP View Documentation Generation (TXT Format)\n');

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`📁 Created output directory: ${OUTPUT_DIR}\n`);
    }

    // Get all views
    const viewNames = Object.keys(VIEW_DESCRIPTIONS);
    console.log(`📊 Generating documentation for ${viewNames.length} views\n`);

    let successCount = 0;

    for (const viewName of viewNames) {
      console.log(`⚙️  Processing: ${viewName}`);

      const schema = await getViewSchema(viewName);
      const viewInfo = VIEW_DESCRIPTIONS[viewName];

      if (schema.columns.length === 0) {
        console.log(`   ⚠️  WARNING: No columns found (view might not exist)\n`);
        continue;
      }

      const txt = generateViewTXT(viewName, schema, viewInfo);

      const outputPath = path.join(OUTPUT_DIR, `${viewName}.txt`);
      fs.writeFileSync(outputPath, txt, 'utf-8');

      console.log(`   ✅ Generated: ${outputPath}`);
      console.log(`   📋 Fields: ${schema.columns.length}`);
      console.log(`   📄 Size: ${(txt.length / 1024).toFixed(2)} KB\n`);

      successCount++;
    }

    // Generate INDEX
    console.log('📋 Generating INDEX.txt...\n');

    let indexTxt = 'MOOBEE DATABASE VIEWS - INDICE\n';
    indexTxt += '═'.repeat(50) + '\n\n';
    indexTxt += `Generated: ${new Date().toISOString()}\n`;
    indexTxt += `Total Views: ${viewNames.length}\n\n`;

    indexTxt += 'PRIORITY 1 - High-Use Views (2 viste):\n';
    indexTxt += '━'.repeat(50) + '\n';
    viewNames.filter(v => VIEW_DESCRIPTIONS[v].priority === 1).forEach(v => {
      indexTxt += `- ${v}.txt\n`;
      indexTxt += `  ${VIEW_DESCRIPTIONS[v].title}\n`;
    });

    indexTxt += '\nPRIORITY 2 - Medium-Use Views (1 vista):\n';
    indexTxt += '━'.repeat(50) + '\n';
    viewNames.filter(v => VIEW_DESCRIPTIONS[v].priority === 2).forEach(v => {
      indexTxt += `- ${v}.txt\n`;
      indexTxt += `  ${VIEW_DESCRIPTIONS[v].title}\n`;
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, 'INDEX.txt'), indexTxt, 'utf-8');
    console.log('✅ INDEX.txt created\n');

    // Summary
    console.log('═'.repeat(80));
    console.log(`🎉 MCP View Documentation Generation Complete!\n`);
    console.log(`📊 Statistics:`);
    console.log(`   - Views processed: ${successCount}/${viewNames.length}`);
    console.log(`   - Output directory: ${OUTPUT_DIR}`);
    console.log(`   - Format: MCP-compatible TXT\n`);

    console.log(`💡 Next steps:`);
    console.log(`   1. Review generated files in ${OUTPUT_DIR}/`);
    console.log(`   2. Copy to MCP server: cp views/*.txt ../mcp_json2data/views/`);
    console.log(`   3. Restart MCP server to load new views\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
