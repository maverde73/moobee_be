-- Rollback Migration 036: Remove tenant_id composite indexes
-- Created: 2025-10-08

-- Drop all composite indexes
DROP INDEX IF EXISTS idx_employee_additional_info_tenant_employee;
DROP INDEX IF EXISTS idx_employee_awards_tenant_employee;
DROP INDEX IF EXISTS idx_employee_certifications_tenant_employee;
DROP INDEX IF EXISTS idx_employee_domain_knowledge_tenant_employee;
DROP INDEX IF EXISTS idx_employee_education_tenant_employee;
DROP INDEX IF EXISTS idx_employee_languages_tenant_employee;
DROP INDEX IF EXISTS idx_employee_projects_tenant_employee;
DROP INDEX IF EXISTS idx_employee_publications_tenant_employee;
DROP INDEX IF EXISTS idx_employee_skills_tenant_employee;
DROP INDEX IF EXISTS idx_employee_work_experiences_tenant_employee;

RAISE NOTICE 'Rollback complete: All tenant_id composite indexes removed';
