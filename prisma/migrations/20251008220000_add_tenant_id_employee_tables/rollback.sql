-- Rollback Migration 033: Remove tenant_id from employee tables
-- Created: 2025-10-08

-- Drop foreign key constraints
ALTER TABLE employee_additional_info DROP CONSTRAINT IF EXISTS fk_employee_additional_info_tenant;
ALTER TABLE employee_awards DROP CONSTRAINT IF EXISTS fk_employee_awards_tenant;
ALTER TABLE employee_certifications DROP CONSTRAINT IF EXISTS fk_employee_certifications_tenant;
ALTER TABLE employee_domain_knowledge DROP CONSTRAINT IF EXISTS fk_employee_domain_knowledge_tenant;
ALTER TABLE employee_education DROP CONSTRAINT IF EXISTS fk_employee_education_tenant;
ALTER TABLE employee_languages DROP CONSTRAINT IF EXISTS fk_employee_languages_tenant;
ALTER TABLE employee_projects DROP CONSTRAINT IF EXISTS fk_employee_projects_tenant;
ALTER TABLE employee_publications DROP CONSTRAINT IF EXISTS fk_employee_publications_tenant;
ALTER TABLE employee_skills DROP CONSTRAINT IF EXISTS fk_employee_skills_tenant;
ALTER TABLE employee_work_experiences DROP CONSTRAINT IF EXISTS fk_employee_work_experiences_tenant;

-- Drop tenant_id columns
ALTER TABLE employee_additional_info DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_awards DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_certifications DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_domain_knowledge DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_education DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_languages DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_projects DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_publications DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_skills DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE employee_work_experiences DROP COLUMN IF EXISTS tenant_id;

RAISE NOTICE 'Rollback complete: tenant_id columns removed from all employee tables';
