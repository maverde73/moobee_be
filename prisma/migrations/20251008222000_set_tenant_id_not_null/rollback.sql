-- Rollback Migration 035: Remove NOT NULL constraint from tenant_id
-- Created: 2025-10-08

-- Set tenant_id to nullable
ALTER TABLE employee_additional_info ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_awards ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_certifications ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_domain_knowledge ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_education ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_languages ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_projects ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_publications ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_skills ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE employee_work_experiences ALTER COLUMN tenant_id DROP NOT NULL;

RAISE NOTICE 'Rollback complete: tenant_id columns set to nullable';
