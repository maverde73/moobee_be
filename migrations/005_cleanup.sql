-- ====================================================
-- MIGRATION STEP 5: CLEANUP
-- Date: 2025-09-25 23:30
-- Purpose: Remove old columns after successful migration
-- ====================================================

-- WARNING: Only run this after confirming migration success!

BEGIN;

-- Drop old columns
ALTER TABLE engagement_campaign_assignments
DROP COLUMN IF EXISTS employee_id_old;

ALTER TABLE assessment_campaign_assignments
DROP COLUMN IF EXISTS employee_id_old;

ALTER TABLE assessment_results
DROP COLUMN IF EXISTS employee_id_old;

-- Drop temporary indexes
DROP INDEX IF EXISTS idx_engagement_assignments_employee_id_new;
DROP INDEX IF EXISTS idx_assessment_assignments_employee_id_new;
DROP INDEX IF EXISTS idx_assessment_results_employee_id_new;

-- Final schema verification
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
AND column_name = 'employee_id'
ORDER BY table_name;

COMMIT;

-- Optional: Drop backup tables after 30 days
-- DROP TABLE IF EXISTS engagement_campaign_assignments_backup_20250925;
-- DROP TABLE IF EXISTS assessment_campaign_assignments_backup_20250925;
-- DROP TABLE IF EXISTS assessment_results_backup_20250925;