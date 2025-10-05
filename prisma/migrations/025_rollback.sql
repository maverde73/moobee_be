-- Rollback Migration 025: Drop job_family_soft_skills table
-- Date: 2025-10-04 00:10
-- Purpose: Rollback job_family_soft_skills table creation if needed

-- WARNING: This will delete all data in job_family_soft_skills table!

-- Drop indexes first
DROP INDEX IF EXISTS idx_jfss_job_family;
DROP INDEX IF EXISTS idx_jfss_soft_skill;
DROP INDEX IF EXISTS idx_jfss_required;
DROP INDEX IF EXISTS idx_jfss_priority;
DROP INDEX IF EXISTS idx_jfss_job_family_priority;

-- Drop the table (CASCADE will remove foreign key constraints)
DROP TABLE IF EXISTS job_family_soft_skills CASCADE;

COMMIT;
