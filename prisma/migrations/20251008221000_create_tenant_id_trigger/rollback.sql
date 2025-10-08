-- Rollback Migration 034: Remove tenant_id triggers
-- Created: 2025-10-08

-- Drop all triggers
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_additional_info ON employee_additional_info;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_awards ON employee_awards;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_certifications ON employee_certifications;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_domain_knowledge ON employee_domain_knowledge;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_education ON employee_education;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_languages ON employee_languages;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_projects ON employee_projects;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_publications ON employee_publications;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_skills ON employee_skills;
DROP TRIGGER IF EXISTS trg_set_tenant_id_employee_work_experiences ON employee_work_experiences;

-- Drop trigger function
DROP FUNCTION IF EXISTS set_tenant_id_from_employee();

RAISE NOTICE 'Rollback complete: All tenant_id triggers removed';
