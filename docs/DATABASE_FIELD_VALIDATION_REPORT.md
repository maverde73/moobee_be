
- **Tables Missing**: 0
- **Fields Missing**: 4
- **Fields Found**: 94/98 (96%)

- **Tables Found**: 11/11 (100%)

## Executive Summary
# Database Field Validation Report
Generated: 2025-09-20T15:51:22.667Z

## Summary


## Table: employees

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('employees_id_seq'::regclass) |
| employee_code | employee_code | ✅ Found | character varying | YES | NULL |
| first_name | first_name | ✅ Found | character varying | NO | NULL |
| last_name | last_name | ✅ Found | character varying | NO | NULL |
| email | email | ✅ Found | character varying | NO | NULL |
| phone | phone | ✅ Found | character varying | YES | NULL |
| hire_date | hire_date | ✅ Found | date | YES | NULL |
| job_title | - | ❌ Not Found | - | - | - |
| department_id | department_id | ✅ Found | integer | YES | NULL |
| manager_id | manager_id | ✅ Found | integer | YES | NULL |
| is_active | is_active | ✅ Found | boolean | YES | true |
| created_at | created_at | ✅ Found | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | updated_at | ✅ Found | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| tenant_id | tenant_id | ✅ Found | uuid | NO | NULL |

### Undocumented Database Fields:

| Database Field | Data Type | Note |
|----------------|-----------|------|
| position | character varying | ⚠️ Not in API docs |
| currentRoleId | integer | ⚠️ Not in API docs |
| lastAssessmentDate | timestamp without time zone | ⚠️ Not in API docs |
| nextAssessmentDue | timestamp without time zone | ⚠️ Not in API docs |

## Table: tenant_users

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('tenant_users_id_seq'::regclass) |
| tenantId | tenantId | ✅ Found | text | NO | NULL |
| email | email | ✅ Found | text | NO | NULL |
| firstName | firstName | ✅ Found | text | YES | NULL |
| lastName | lastName | ✅ Found | text | YES | NULL |
| role | role | ✅ Found | text | NO | 'user'::text |
| isActive | isActive | ✅ Found | boolean | NO | true |
| lastLogin | lastLogin | ✅ Found | timestamp without time zone | YES | NULL |
| createdAt | createdAt | ✅ Found | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | updatedAt | ✅ Found | timestamp without time zone | NO | NULL |

## Table: tenants

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | text | NO | NULL |
| name | name | ✅ Found | text | NO | NULL |
| companyName | companyName | ✅ Found | text | YES | NULL |
| email | email | ✅ Found | text | NO | NULL |
| phone | phone | ✅ Found | text | YES | NULL |
| address | address | ✅ Found | text | YES | NULL |
| city | city | ✅ Found | text | YES | NULL |
| country | country | ✅ Found | text | YES | NULL |
| isActive | isActive | ✅ Found | boolean | NO | true |
| plan | plan | ✅ Found | text | YES | 'free'::text |
| maxUsers | maxUsers | ✅ Found | integer | NO | 10 |
| createdAt | createdAt | ✅ Found | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | updatedAt | ✅ Found | timestamp without time zone | NO | NULL |

## Table: assessment_templates

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('assessment_templates_id_seq'::regclass) |
| name | name | ✅ Found | text | NO | NULL |
| type | type | ✅ Found | text | YES | NULL |
| description | description | ✅ Found | text | YES | NULL |
| isActive | isActive | ✅ Found | boolean | NO | true |
| suggestedRoles | suggestedRoles | ✅ Found | ARRAY | YES | NULL |
| targetSoftSkillIds | targetSoftSkillIds | ✅ Found | ARRAY | YES | NULL |
| createdBy | createdBy | ✅ Found | text | YES | NULL |
| version | version | ✅ Found | text | YES | NULL |
| createdAt | createdAt | ✅ Found | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | updatedAt | ✅ Found | timestamp without time zone | NO | NULL |

## Table: assessment_questions

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('assessment_questions_id_seq'::regclass) |
| templateId | templateId | ✅ Found | integer | NO | NULL |
| text | text | ✅ Found | text | NO | NULL |
| type | type | ✅ Found | text | NO | NULL |
| category | category | ✅ Found | text | YES | NULL |
| order | order | ✅ Found | integer | YES | NULL |

## Table: assessment_options

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('assessment_options_id_seq'::regclass) |
| questionId | questionId | ✅ Found | integer | NO | NULL |
| text | text | ✅ Found | text | NO | NULL |
| value | value | ✅ Found | integer | NO | NULL |

## Table: soft_skills

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('soft_skills_id_seq'::regclass) |
| name | name | ✅ Found | text | NO | NULL |
| nameEn | nameEn | ✅ Found | text | YES | NULL |
| description | description | ✅ Found | text | YES | NULL |
| category | category | ✅ Found | text | YES | NULL |
| isActive | isActive | ✅ Found | boolean | NO | true |
| createdAt | createdAt | ✅ Found | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| updatedAt | updatedAt | ✅ Found | timestamp without time zone | NO | NULL |

## Table: role_soft_skills

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('role_soft_skills_id_seq'::regclass) |
| roleId | roleId | ✅ Found | integer | NO | NULL |
| softSkillId | softSkillId | ✅ Found | integer | NO | NULL |
| priority | priority | ✅ Found | integer | NO | NULL |
| minScore | minScore | ✅ Found | integer | YES | NULL |
| createdAt | createdAt | ✅ Found | timestamp without time zone | NO | CURRENT_TIMESTAMP |

## Table: roles

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | YES | NULL |
| name | - | ❌ Not Found | - | - | - |
| nameKnown | - | ❌ Not Found | - | - | - |
| synonyms | - | ❌ Not Found | - | - | - |

### Undocumented Database Fields:

| Database Field | Data Type | Note |
|----------------|-----------|------|
| Role | text | ⚠️ Not in API docs |
| NameKnown_Role | text | ⚠️ Not in API docs |
| Synonyms_Role | ARRAY | ⚠️ Not in API docs |

## Table: departments

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('departments_id_seq'::regclass) |
| department_name | department_name | ✅ Found | character varying | NO | NULL |
| department_code | department_code | ✅ Found | character varying | YES | NULL |
| manager_id | manager_id | ✅ Found | integer | YES | NULL |
| parent_department_id | parent_department_id | ✅ Found | integer | YES | NULL |
| is_active | is_active | ✅ Found | boolean | YES | true |
| created_at | created_at | ✅ Found | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | updated_at | ✅ Found | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| tenant_id | tenant_id | ✅ Found | uuid | NO | NULL |

## Table: assessments

✅ Table exists in database

### Field Analysis:

| API Field | DB Field | Status | Data Type | Nullable | Default |
|-----------|----------|--------|-----------|----------|---------|
| id | id | ✅ Found | integer | NO | nextval('assessments_id_seq'::regclass) |
| employee_id | employee_id | ✅ Found | integer | NO | NULL |
| assessment_type | assessment_type | ✅ Found | character varying | NO | NULL |
| assessment_date | assessment_date | ✅ Found | date | NO | CURRENT_DATE |
| overall_score | overall_score | ✅ Found | numeric | YES | NULL |
| technical_score | technical_score | ✅ Found | numeric | YES | NULL |
| soft_skills_score | soft_skills_score | ✅ Found | numeric | YES | NULL |
| notes | notes | ✅ Found | text | YES | NULL |
| assessed_by | assessed_by | ✅ Found | integer | YES | NULL |
| status | status | ✅ Found | character varying | YES | 'DRAFT'::character varying |
| created_at | created_at | ✅ Found | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | updated_at | ✅ Found | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| tenant_id | tenant_id | ✅ Found | uuid | NO | NULL |

## Undocumented Tables in Database

These tables exist in the database but are not documented in the API:

- ⚠️ assessment_soft_skill_scores
- ⚠️ assessment_template_roles
- ⚠️ career_aspirations
- ⚠️ employee_roles
- ⚠️ employee_skills
- ⚠️ engagement_surveys
- ⚠️ extended_descriptions_roles
- ⚠️ extended_descriptions_skills
- ⚠️ extended_descriptions_sub_roles
- ⚠️ extended_tech_skills_roles_descriptions_full
- ⚠️ notifications
- ⚠️ project_assignments
- ⚠️ project_skills_required
- ⚠️ projects
- ⚠️ role_mappings
- ⚠️ role_sub_role
- ⚠️ role_sub_role_backup
- ⚠️ role_sub_role_backup_final
- ⚠️ skill_gaps
- ⚠️ skills
- ⚠️ soft_skills_assessments
- ⚠️ sub_roles
- ⚠️ tenant_api_keys
- ⚠️ tenant_assessment_selections
- ⚠️ tenant_audit_log
- ⚠️ tenant_billing
- ⚠️ tenant_features
- ⚠️ tenant_soft_skill_profiles
- ⚠️ training_plans