-- Migration 036: Add composite indexes for tenant_id + employee_id
-- Description: Optimize multi-tenant queries with composite indexes
-- Created: 2025-10-08
-- Performance: Enables efficient queries with WHERE tenant_id = ? AND employee_id = ?

-- Create composite indexes (tenant_id, employee_id)
-- These indexes support both:
-- 1. Queries filtering by tenant_id AND employee_id
-- 2. Queries filtering by tenant_id only (leftmost column)

CREATE INDEX IF NOT EXISTS idx_employee_additional_info_tenant_employee
ON employee_additional_info(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_awards_tenant_employee
ON employee_awards(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_certifications_tenant_employee
ON employee_certifications(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_domain_knowledge_tenant_employee
ON employee_domain_knowledge(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_education_tenant_employee
ON employee_education(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_languages_tenant_employee
ON employee_languages(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_projects_tenant_employee
ON employee_projects(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_publications_tenant_employee
ON employee_publications(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_skills_tenant_employee
ON employee_skills(tenant_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_work_experiences_tenant_employee
ON employee_work_experiences(tenant_id, employee_id);

-- Analyze tables to update query planner statistics
ANALYZE employee_additional_info;
ANALYZE employee_awards;
ANALYZE employee_certifications;
ANALYZE employee_domain_knowledge;
ANALYZE employee_education;
ANALYZE employee_languages;
ANALYZE employee_projects;
ANALYZE employee_publications;
ANALYZE employee_skills;
ANALYZE employee_work_experiences;

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_employee_%_tenant_employee'
ORDER BY tablename;

DO $$ BEGIN
  RAISE NOTICE 'Composite indexes created on 10 employee tables for multi-tenant query optimization';
END $$;
