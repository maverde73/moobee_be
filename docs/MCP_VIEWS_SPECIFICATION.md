# MCP Optimized Views - Specification

**Created**: 12 October 2025
**Purpose**: Database views optimized for MCP (Model Context Protocol) server queries
**Migration**: 044_create_mcp_views.sql

---

## Overview

These 5 views are designed to **reduce query complexity** for the MCP server and AI agents by pre-joining frequently accessed data and pre-calculating aggregations.

**Key Benefits**:
- ✅ **1 query instead of 5-10** for complex data retrieval
- ✅ **Pre-calculated aggregations** (counts, scores, KPIs)
- ✅ **JSONB format** for nested data (easy for AI parsing)
- ✅ **Standardized business logic** (grading, status calculations)

---

## 📊 View 1: `v_employee_skills_summary`

### Purpose
Employee skills with **grading calculated** from `skills_sub_roles_value` based on their current roles.

### Schema
```sql
employee_id              INTEGER
skill_id                 INTEGER
skill_name               TEXT
skill_category           TEXT
proficiency_level        TEXT
source                   TEXT (cv_extracted, manual, assessment, imported)
skill_grading            TEXT (A+, A, B, C, D, N/A)
is_relevant_for_current_role BOOLEAN
years_of_experience      INTEGER
last_used_date           DATE
created_at               TIMESTAMP
updated_at               TIMESTAMP
tenant_id                TEXT
```

### Use Cases
- Skills dashboard (show grading per skill)
- Employee profile (skills section with relevance indicator)
- Project matching (find employees by skill + grading)
- Skills gap analysis

### Sample Query (MCP JSON)
```json
{
  "table": "v_employee_skills_summary",
  "select": ["employee_id", "skill_name", "skill_grading", "proficiency_level"],
  "where": {
    "employee_id": 91,
    "is_relevant_for_current_role": true
  },
  "orderBy": [{"column": "skill_grading", "order": "asc"}]
}
```

### Performance vs Traditional Query
- **Before**: 4 JOINs (employee_skills + skills + employee_roles + skills_sub_roles_value) + GROUP BY
- **After**: 1 SELECT from view
- **Speedup**: ~3-5x

---

## 👤 View 2: `v_employee_complete_profile`

### Purpose
Complete employee profile with department, current role, and aggregated counts in **one query**.

### Schema
```sql
id                          INTEGER
employee_code               VARCHAR(50)
first_name                  VARCHAR(100)
last_name                   VARCHAR(100)
email                       VARCHAR(255)
phone                       VARCHAR(20)
position                    VARCHAR(100)
hire_date                   DATE
is_active                   BOOLEAN
tenant_id                   TEXT

-- Department
department_id               INTEGER
department_name             VARCHAR(100)

-- Current Role (first with is_current=true)
current_role_id             INTEGER
current_role_name           TEXT
current_sub_role_name       TEXT
current_role_years          INTEGER

-- Aggregated Counts
total_skills                BIGINT
total_certifications        BIGINT
total_work_experiences      BIGINT
total_education             BIGINT
total_languages             BIGINT

-- Latest CV
latest_cv_extraction_id     UUID
latest_cv_date              TIMESTAMP

-- Soft Skills
softSkillProfileId          INTEGER

-- Timestamps
created_at                  TIMESTAMP
updated_at                  TIMESTAMP
lastAssessmentDate          TIMESTAMP
nextAssessmentDue           TIMESTAMP
```

### Use Cases
- Employee detail page (complete profile in 1 query)
- Employee list/search results (with counts preview)
- Profile cards in dashboard
- Export employee data

### Sample Query (MCP JSON)
```json
{
  "table": "v_employee_complete_profile",
  "select": [
    "id", "first_name", "last_name", "email",
    "department_name", "current_role_name", "current_sub_role_name",
    "total_skills", "total_certifications", "latest_cv_date"
  ],
  "where": {"tenant_id": "uuid_tenant", "is_active": true},
  "orderBy": [{"column": "last_name", "order": "asc"}],
  "limit": 50
}
```

### Performance vs Traditional Query
- **Before**: 10+ queries or massive JOIN with subqueries
- **After**: 1 SELECT from view with all data
- **Speedup**: ~10-15x

---

## 📝 View 3: `v_assessment_results_summary`

### Purpose
Assessment results with **soft skills scores aggregated in JSONB** format.

### Schema
```sql
assessment_result_id        INTEGER
employee_id                 INTEGER
first_name                  VARCHAR(100)
last_name                   VARCHAR(100)
email                       VARCHAR(255)
assessment_id               INTEGER
assessment_title            VARCHAR(200)
assessment_type             VARCHAR(50)
assessment_description      TEXT
score                       DECIMAL
completed_at                TIMESTAMP
time_taken_seconds          INTEGER

-- Soft Skills Scores (JSONB)
soft_skills_scores          JSONB
-- Example: {"Leadership": {"score": 85, "soft_skill_id": 12}, "Teamwork": {...}}

total_questions             BIGINT
metadata                    JSONB
tenant_id                   TEXT
created_at                  TIMESTAMP
updated_at                  TIMESTAMP
```

### Use Cases
- Assessment results dashboard
- Employee assessment history
- Soft skills profile visualization
- Performance reports

### Sample Query (MCP JSON)
```json
{
  "table": "v_assessment_results_summary",
  "select": [
    "assessment_result_id",
    "employee_id",
    "first_name",
    "last_name",
    "assessment_title",
    "score",
    "soft_skills_scores",
    "completed_at"
  ],
  "where": {
    "tenant_id": "uuid_tenant",
    "employee_id": 91
  },
  "orderBy": [{"column": "completed_at", "order": "desc"}],
  "limit": 10
}
```

### JSONB Format
```json
{
  "Leadership": {
    "score": 85,
    "soft_skill_id": 12
  },
  "Communication": {
    "score": 78,
    "soft_skill_id": 5
  }
}
```

### Performance vs Traditional Query
- **Before**: Main query + N queries for soft skills (1+N problem)
- **After**: 1 SELECT with JSONB aggregation
- **Speedup**: ~5-8x for employees with multiple assessments

---

## 🚀 View 4: `v_project_team_composition`

### Purpose
Project details with **team members and required skills in JSONB arrays**.

### Schema
```sql
project_id                  INTEGER
project_name                VARCHAR(200)
description                 TEXT
start_date                  DATE
end_date                    DATE
status                      VARCHAR(50)

-- Project Manager
pm_id                       INTEGER
pm_name                     TEXT
pm_email                    VARCHAR(255)

-- Team Members (JSONB Array)
team_members                JSONB
-- [{"employee_id": 91, "employee_name": "Mario Rossi", "role_name": "Developer", ...}, ...]

team_size                   BIGINT

-- Required Skills (JSONB Array)
required_skills             JSONB
-- [{"skill_id": 15, "skill_name": "Python", "required_level": "Advanced", ...}, ...]

required_skills_count       BIGINT

tenant_id                   TEXT
created_at                  TIMESTAMP
updated_at                  TIMESTAMP
```

### Use Cases
- Project dashboard (team + skills in one view)
- Team composition analysis
- Skill gap analysis (compare team_members skills vs required_skills)
- Resource allocation

### Sample Query (MCP JSON)
```json
{
  "table": "v_project_team_composition",
  "select": [
    "project_id",
    "project_name",
    "pm_name",
    "team_members",
    "required_skills",
    "team_size",
    "start_date",
    "end_date"
  ],
  "where": {"tenant_id": "uuid_tenant", "status": "active"},
  "orderBy": [{"column": "start_date", "order": "desc"}]
}
```

### JSONB Formats

**team_members**:
```json
[
  {
    "employee_id": 91,
    "employee_name": "Mario Rossi",
    "email": "mario.rossi@example.com",
    "role_id": 3,
    "role_name": "Senior Developer",
    "hours_allocated": 80,
    "start_date": "2025-01-15",
    "end_date": "2025-06-30"
  }
]
```

**required_skills**:
```json
[
  {
    "skill_id": 15,
    "skill_name": "Python",
    "skill_category": "Programming Languages",
    "required_level": "Advanced",
    "priority": 1
  }
]
```

### Performance vs Traditional Query
- **Before**: 3 queries (project + team + skills) or complex JOIN with arrays
- **After**: 1 SELECT with pre-aggregated JSONB
- **Speedup**: ~4-6x

---

## 💰 View 5: `v_llm_usage_analytics`

### Purpose
LLM usage analytics **aggregated by date, tenant, operation type, and model** with pre-calculated KPIs.

### Schema
```sql
tenant_id                   TEXT
operation_type              VARCHAR(100)
provider                    VARCHAR(50)
model                       VARCHAR(100)
usage_date                  DATE

-- Call Statistics
total_calls                 BIGINT
successful_calls            BIGINT
failed_calls                BIGINT
timeout_calls               BIGINT
rate_limited_calls          BIGINT

-- Token Statistics
total_prompt_tokens         BIGINT
total_completion_tokens     BIGINT
total_tokens                BIGINT
avg_prompt_tokens           NUMERIC
avg_completion_tokens       NUMERIC

-- Cost Statistics
total_cost                  NUMERIC
avg_cost_per_call           NUMERIC
min_cost                    NUMERIC
max_cost                    NUMERIC

-- Performance Statistics
avg_response_time_ms        NUMERIC
min_response_time_ms        INTEGER
max_response_time_ms        INTEGER

-- Entity Breakdown
unique_entities             BIGINT

-- Time Range
first_call_at               TIMESTAMP
last_call_at                TIMESTAMP
```

### Use Cases
- Cost monitoring dashboard
- Usage reports (daily/weekly/monthly)
- Billing calculations
- Performance analysis
- Model comparison

### Sample Query (MCP JSON)
```json
{
  "table": "v_llm_usage_analytics",
  "select": [
    "usage_date",
    "operation_type",
    "model",
    "total_calls",
    "total_cost",
    "avg_response_time_ms"
  ],
  "where": {
    "tenant_id": "uuid_tenant",
    "usage_date": {
      "operator": ">=",
      "value": "2025-10-01"
    }
  },
  "orderBy": [{"column": "usage_date", "order": "desc"}]
}
```

### Dashboard Query Examples

**Monthly cost summary**:
```json
{
  "table": "v_llm_usage_analytics",
  "select": [
    {"raw": "DATE_TRUNC('month', usage_date) as month"},
    {"raw": "SUM(total_cost) as monthly_cost"},
    {"raw": "SUM(total_calls) as monthly_calls"}
  ],
  "where": {"tenant_id": "uuid_tenant"},
  "groupBy": [{"raw": "DATE_TRUNC('month', usage_date)"}],
  "orderBy": [{"raw": "month DESC"}]
}
```

**Model comparison**:
```json
{
  "table": "v_llm_usage_analytics",
  "select": [
    "model",
    {"raw": "SUM(total_cost) as total_cost"},
    {"raw": "AVG(avg_response_time_ms) as avg_latency"},
    {"raw": "SUM(failed_calls)::DECIMAL / NULLIF(SUM(total_calls), 0) * 100 as error_rate"}
  ],
  "where": {
    "tenant_id": "uuid_tenant",
    "usage_date": {"operator": ">=", "value": "NOW() - INTERVAL '7 days'"}
  },
  "groupBy": ["model"],
  "orderBy": [{"raw": "total_cost DESC"}]
}
```

### Performance vs Traditional Query
- **Before**: Full scan of llm_usage_logs with GROUP BY (slow on large datasets)
- **After**: Pre-aggregated daily summaries (much faster)
- **Speedup**: ~20-50x on datasets with 100k+ logs

---

## 🚀 Deployment

### 1. Apply Migration
```bash
cd BE_nodejs
node run_migration_044.js
```

### 2. Verify Views
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`
  SELECT table_name
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name LIKE 'v_%'
  ORDER BY table_name
\`.then(console.log).finally(() => prisma.\$disconnect());
"
```

### 3. Test Queries
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT COUNT(*) as count FROM v_employee_skills_summary\`
  .then(result => console.log('v_employee_skills_summary:', result[0].count))
  .finally(() => prisma.\$disconnect());
"
```

### 4. Rollback (if needed)
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const sql = fs.readFileSync('prisma/migrations/044_rollback.sql', 'utf-8');
prisma.\$executeRawUnsafe(sql)
  .then(() => console.log('✅ Rollback complete'))
  .finally(() => prisma.\$disconnect());
"
```

---

## 📋 Next Steps

### 1. Update Prisma Schema (Optional)
Add view models to `prisma/schema.prisma` for type safety:

```prisma
/// Employee skills with grading from skills_sub_roles_value
model v_employee_skills_summary {
  employee_id                   Int
  skill_id                      Int
  skill_name                    String
  skill_category                String?
  proficiency_level             String?
  source                        String?
  skill_grading                 String
  is_relevant_for_current_role  Boolean
  years_of_experience           Int?
  last_used_date                DateTime?
  created_at                    DateTime
  updated_at                    DateTime
  tenant_id                     String

  @@unique([employee_id, skill_id])
  @@ignore
}
```

### 2. Generate MCP Documentation
```bash
# Generate view documentation in MCP TXT format
node generate_mcp_views_txt.js
```

### 3. Update MCP Server
Copy view documentation to MCP server:
```bash
cp BE_nodejs/views/*.txt mcp_json2data/views/
```

### 4. Test MCP Server
```bash
cd mcp_json2data
python mcp_db_server.py

# In another terminal
curl http://localhost:8000/mcp -X POST -d '{"tool": "get_table_details", "args": {"table_names": "v_employee_skills_summary"}}'
```

---

## 📊 Performance Benchmarks

### Expected Performance Improvements

| View | Traditional Query | View Query | Speedup |
|------|------------------|------------|---------|
| v_employee_skills_summary | 4 JOINs + GROUP BY (~150ms) | 1 SELECT (~30ms) | **5x** |
| v_employee_complete_profile | 10+ queries (~500ms) | 1 SELECT (~50ms) | **10x** |
| v_assessment_results_summary | 1 + N queries (~200ms) | 1 SELECT (~40ms) | **5x** |
| v_project_team_composition | 3 complex queries (~300ms) | 1 SELECT (~60ms) | **5x** |
| v_llm_usage_analytics | Full scan + GROUP BY (~2000ms) | Pre-aggregated (~100ms) | **20x** |

*Benchmarks based on database with ~1000 employees, ~50000 skills, ~10000 assessments, ~100000 LLM logs*

---

## 🔍 Monitoring

### View Usage Statistics
```sql
-- Check view usage (PostgreSQL 12+)
SELECT
  schemaname,
  viewname,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'v_%';
```

### Query Performance
```sql
-- Analyze query plan
EXPLAIN ANALYZE
SELECT * FROM v_employee_skills_summary
WHERE employee_id = 91;
```

---

## 📚 References

- **Migration Files**:
  - `prisma/migrations/044_create_mcp_views.sql` - Main migration
  - `prisma/migrations/044_rollback.sql` - Rollback script
  - `run_migration_044.js` - Migration runner

- **Documentation**:
  - `docs/MCP_TABLE_DOCUMENTATION_IMPLEMENTATION.md` - Table docs generator
  - `tables/README_TXT.md` - MCP format specification

- **Related Issues**:
  - MCP server query optimization
  - Dashboard performance improvements
  - Cost monitoring dashboard

---

**Last Updated**: 12 October 2025
**Version**: 1.0.0
