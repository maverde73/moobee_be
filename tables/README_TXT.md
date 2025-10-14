# MCP Table Documentation - TXT Format

**Generated**: 12 October 2025
**Format**: MCP-compatible TXT files
**Source**: Railway PostgreSQL + Prisma Schema JSDoc
**Total Files**: 89 (88 tables + INDEX.txt)

---

## Overview

Questa directory contiene la documentazione completa di tutte le 88 tabelle del database Moobee nel **formato TXT standard MCP** (Model Context Protocol).

I file sono generati automaticamente interrogando:
- **Railway PostgreSQL database** - Schema, constraint, relazioni
- **Prisma schema.prisma** - JSDoc comments per descrizioni semantiche

---

## Formato File

Ogni file `<tabella>.txt` segue il formato MCP standard:

```
TABELLA: <nome_tabella>
DESCRIZIONE: <Descrizione business della tabella>

CAMPI UTILIZZABILI (USA ESATTAMENTE QUESTI NOMI):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<CATEGORIE>:
- campo (tipo): Descrizione [ATTRIBUTI]

RELAZIONI:
━━━━━━━━━━
- <Tabella> (cardinalità): Descrizione relazione
  * ON DELETE: <regola>
  * ON UPDATE: <regola>

STATI E VALORI ENUM:        (se applicabile)
━━━━━━━━━━━━━━━━━━━━
<ENUM_NAME>:
  - valore1
  - valore2

REGOLE BUSINESS:
━━━━━━━━━━━━━━━━
1. <Regola 1>
2. <Regola 2>

QUERY COMUNI:
━━━━━━━━━━━━

1. <Descrizione query>:
{
  "table": "<tabella>",
  "select": ["campo1", "campo2"],
  "where": { "campo": "valore" }
}

NOTE IMPORTANTI:
━━━━━━━━━━━━━━━
- <Nota importante 1>
- <Nota importante 2>
```

---

## Categorie Campi

I campi sono raggruppati automaticamente per categoria:

### IDENTIFICATIVI
- `id`, `uuid`, `code`, `slug`
- Primary keys

### DATI ANAGRAFICI
- `name`, `first_name`, `last_name`
- `email`, `phone`, `address`

### DATI DESCRITTIVI
- `description`, `notes`, `metadata`

### RELAZIONI PRINCIPALI
- Foreign keys principali (es. `tenant_id`, `user_id`, `employee_id`)

### STATI E FLAGS
- `status`, `is_active`, `is_deleted`, `is_visible`
- Boolean fields

### DATE E TIMESTAMP
- `created_at`, `updated_at`, `deleted_at`
- `hire_date`, `start_date`, `end_date`

### DATI TECNICI
- `hash`, `token`, `config` (JSON/JSONB)
- `password_hash`, `api_key`

### ALTRI CAMPI
- Campi che non rientrano nelle altre categorie

---

## Attributi Campi

Ogni campo può avere i seguenti attributi:

- `[PRIMARY KEY]` - Chiave primaria
- `[REQUIRED]` o `[NOT NULL]` - Campo obbligatorio
- `[UNIQUE]` - Vincolo di unicità
- `[FK verso <Tabella>]` - Foreign key
- `[DEFAULT: <valore>]` - Valore di default
- `[ENUM: val1, val2, ...]` - Tipo ENUM PostgreSQL
- `[ARRAY]` - Array PostgreSQL (es. `text[]`)
- `[JSONB]` - Campo JSON/JSONB

**Esempio**:
```
- email (character varying(255)): Email dell'utente [REQUIRED] [UNIQUE]
- status (character varying(50)): Stato account [ENUM: ACTIVE, INACTIVE, SUSPENDED]
- tenant_id (uuid): Tenant di appartenenza [REQUIRED] [FK verso tenants]
```

---

## Cardinalità Relazioni

Le relazioni sono indicate con cardinalità standard:

- **1:1** - Uno a uno (FK unica)
- **N:1** - Molti a uno (FK standard da questa tabella)
- **1:N** - Uno a molti (altra tabella ha FK verso questa)
- **N:M** - Molti a molti (via tabella intermedia)

**Esempio**:
```
RELAZIONI:
━━━━━━━━━━
- departments (N:1): Collegamento via department_id
  * ON DELETE: SET NULL
  * ON UPDATE: CASCADE
- employee_roles (1:N): employee_roles referenzia questa tabella via employee_id
```

---

## Query JSON Format

Le query comuni sono formattate in JSON compatibile con MCP JSON Server:

```json
{
  "table": "employees",
  "select": ["id", "first_name", "last_name", "email"],
  "where": {
    "tenant_id": "uuid_tenant",
    "is_active": true
  },
  "leftJoin": [{
    "table": "departments",
    "first": "employees.department_id",
    "second": "departments.id"
  }],
  "orderBy": [{ "column": "created_at", "order": "desc" }],
  "limit": 100
}
```

**Operatori WHERE supportati**:
- Uguaglianza diretta: `"campo": "valore"`
- LIKE: `"campo": { "operator": "like", "value": "%search%" }`
- Maggiore/Minore: `"campo": { "operator": ">=", "value": "NOW() - INTERVAL '30 days'" }`

---

## Priorità Tabelle

Le tabelle sono organizzate in 3 priorità:

### Priority 1: HR/Recruitment Core (14 tabelle)
Le tabelle fondamentali del sistema HR:
- `employees`, `companies`, `cv_files`, `cv_extractions`
- `skills`, `assessments`, `projects`, `project_roles`
- `employee_roles`, `employee_skills`, `employee_work_experiences`
- `role_sub_role`, `sub_roles`, `roles`

### Priority 2: System/Auth (5 tabelle)
Tabelle di sistema e autenticazione:
- `tenants`, `tenant_users`, `departments`
- `soft_skills`, `assessment_templates`

### Priority 3: Altre tabelle (69 tabelle)
Tutte le altre tabelle di supporto, engagement, analytics, ecc.

---

## Quick Start

### Browse Documentation

```bash
cd BE_nodejs/tables

# View index
cat INDEX.txt

# View specific table
cat employees.txt
cat companies.txt
cat llm_usage_logs.txt
```

### Search for Table

```bash
# Find tables containing "employee"
ls -1 | grep employee

# Output:
# employee_additional_info.txt
# employee_awards.txt
# employee_certifications.txt
# employee_domain_knowledge.txt
# employee_education.txt
# employee_languages.txt
# employee_projects.txt
# employee_publications.txt
# employee_roles.txt
# employee_skills.txt
# employee_soft_skill_assessments.txt
# employee_soft_skills.txt
# employee_work_experiences.txt
# employees.txt
```

### Grep for Specific Information

```bash
# Find all tables with ENUM types
grep -l "STATI E VALORI ENUM" *.txt

# Find tables with tenant_id
grep -l "tenant_id" *.txt

# Find tables with soft delete
grep -l "soft delete" *.txt
```

---

## Regenerate Documentation

Dopo modifiche allo schema o aggiunta di JSDoc comments in Prisma:

```bash
cd BE_nodejs

# 1. Update Prisma schema (if needed)
npx prisma db pull

# 2. Regenerate TXT files
node generate_mcp_tables_txt.js

# Output:
# 🚀 Starting MCP Table Documentation Generation (TXT Format)
# 📖 Parsing Prisma schema JSDoc...
#    Found JSDoc for 12 models
# 🔍 Fetching table list from database...
#    Found 88 tables
# ...
# ✅ Generated 88 table documentation files in ./tables/
# 📋 Generating INDEX.txt...
# 🎉 MCP Table Documentation Generation Complete!
```

**Script Features**:
- Connects to Railway PostgreSQL via `DATABASE_URL`
- Excludes Prisma internal tables (starting with `_`)
- Parses JSDoc from `prisma/schema.prisma`
- Auto-detects ENUM types from PostgreSQL
- Auto-categorizes fields by naming patterns
- Generates business rules from constraints
- Creates 4 common query examples per table

---

## Use Cases

### 1. MCP Server Integration
I file TXT sono ottimizzati per l'uso con Model Context Protocol (MCP) servers:
- Query JSON già formattate per MCP JSON Server
- Campi con nomi esatti dal database (no typo)
- Relazioni complete con cardinalità

### 2. API Development Reference
Usa i file come riferimento durante lo sviluppo API:
- Schema completo per request/response structures
- Business rules per validazione
- Query comuni come template

### 3. Database Query Building
Le query JSON possono essere usate direttamente:
```javascript
const query = {
  "table": "employees",
  "select": ["id", "first_name", "last_name"],
  "where": { "is_active": true }
};

// Convert to SQL or use with query builder
```

### 4. Documentation for AI Agents
I file TXT sono ottimizzati per essere letti da AI agents:
- Formato strutturato e consistente
- Informazioni complete in un unico file
- Esempi pratici di query

### 5. Code Review & Onboarding
Nuovo sviluppatore? Inizia da:
1. `INDEX.txt` - Overview generale
2. Priority 1 tables - Core domain (HR/Recruitment)
3. Priority 2 tables - System/Auth
4. Tabelle specifiche per feature

---

## Differences: TXT vs MD Format

Questa directory contiene **2 formati** di documentazione:

### TXT Format (questo README)
- **File**: `*.txt` (88 files)
- **Purpose**: MCP server integration, AI agents
- **Format**: Plain text con separatori ASCII
- **Query**: JSON format (MCP-compatible)
- **Categories**: Auto-categorized by naming
- **Generation**: `generate_mcp_tables_txt.js`

### MD Format (alternativo)
- **File**: `*.md` (88 files)
- **Purpose**: Human reading, GitHub rendering
- **Format**: Markdown with tables
- **Query**: SQL code blocks
- **Categories**: Manual grouping
- **Generation**: `generate_mcp_table_docs.js`

**Quando usare TXT**:
- Integrazione con MCP servers
- Parsing automatico da AI agents
- Query JSON per query builders

**Quando usare MD**:
- Lettura umana con syntax highlighting
- GitHub/GitLab documentation
- Export to PDF/HTML

---

## Integration Example

### Example: MCP JSON Server Query

File: `employees.txt` contiene:
```json
{
  "table": "employees",
  "select": ["id", "first_name", "last_name", "email"],
  "where": { "tenant_id": "uuid_tenant" },
  "limit": 100
}
```

Uso con MCP JSON Server:
```javascript
const fs = require('fs');

// Read query from TXT file
const fileContent = fs.readFileSync('tables/employees.txt', 'utf8');
const queryMatch = fileContent.match(/\{[\s\S]*?"table":\s*"employees"[\s\S]*?\}/);
const query = JSON.parse(queryMatch[0]);

// Execute via MCP JSON Server
const result = await mcpClient.query(query);
```

---

## Files Structure

```
tables/
├── INDEX.txt                           # Master index
├── README_TXT.md                       # This file
│
├── employees.txt                       # Priority 1
├── companies.txt
├── cv_files.txt
├── cv_extractions.txt
├── skills.txt
├── assessments.txt
├── ... (8 more Priority 1 files)
│
├── tenants.txt                         # Priority 2
├── tenant_users.txt
├── ... (3 more Priority 2 files)
│
├── action_plans.txt                    # Priority 3
├── assessment_campaign_assignments.txt
├── ... (67 more Priority 3 files)
```

**Total**: 89 files (88 tables + INDEX.txt)

---

## Related Files

- **Generation Script**: `BE_nodejs/generate_mcp_tables_txt.js`
- **Prisma Schema**: `BE_nodejs/prisma/schema.prisma` (source for JSDoc)
- **Database**: Railway PostgreSQL (source for schema)
- **Original Prompt**: `docs/PROMPT_GENERAZIONE_TABELLE_MCP.md`
- **MD Format**: `BE_nodejs/tables/*.md` (alternative format)

---

## Maintenance

### Add JSDoc to Prisma Schema

Per migliorare le descrizioni nei file TXT, aggiungi JSDoc a `schema.prisma`:

```prisma
/// Core employee record - Central table for all employee data in Moobee.
///
/// This table stores the basic employee information and links to all related
/// employee data (skills, roles, education, work experiences, etc.).
///
/// **Multi-tenancy**: Each employee belongs to exactly one tenant (tenant_id).
/// **Active Status**: Use is_active flag for soft delete (never physically delete).
model employees {
  id Int @id @default(autoincrement())

  /// Unique employee code within tenant (e.g., "EMP001")
  employee_code String? @db.VarChar(50)

  /// First name of employee
  first_name String @db.VarChar(100)

  // ...
}
```

Poi rigenera:
```bash
node generate_mcp_tables_txt.js
```

### Update After Schema Changes

```bash
# 1. Apply migrations
npx prisma migrate dev

# 2. Regenerate docs
node generate_mcp_tables_txt.js

# 3. Commit changes
git add tables/*.txt
git commit -m "docs: Update table documentation after schema changes"
```

---

## Notes

- **Accuracy**: File names and field names are **exact copies** from database
- **Consistency**: All 88 files follow the same format
- **Completeness**: Every FK, constraint, and index is documented
- **Validation**: All JSON queries are syntactically valid
- **Multi-tenant**: Tables with `tenant_id` are marked as multi-tenant

---

**Generated by**: `generate_mcp_tables_txt.js`
**Last Update**: 12 October 2025
**Version**: 1.0.0
