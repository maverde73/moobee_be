-- Rollback Migration 024: Drop job_family table
-- Date: 2025-10-03 23:58
-- Purpose: Rollback job_family table creation if needed

-- WARNING: This will delete all data in job_family table!

-- Drop indexes first
DROP INDEX IF EXISTS idx_job_family_name;
DROP INDEX IF EXISTS idx_job_family_is_active;

-- If you added job_family_id to sub_roles, uncomment this:
-- ALTER TABLE sub_roles DROP COLUMN IF EXISTS job_family_id;

-- Drop the table
DROP TABLE IF EXISTS job_family;

COMMIT;
