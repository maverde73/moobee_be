-- ====================================================
-- MIGRATION STEP 2: ADD NEW COLUMNS
-- Date: 2025-09-25 23:30
-- Purpose: Add employee_id_new (INT) columns to campaign_assignments
-- ====================================================

BEGIN;

-- Add new column to engagement_campaign_assignments
ALTER TABLE engagement_campaign_assignments
ADD COLUMN IF NOT EXISTS employee_id_new INTEGER;

-- Add new column to assessment_campaign_assignments
ALTER TABLE assessment_campaign_assignments
ADD COLUMN IF NOT EXISTS employee_id_new INTEGER;

-- Add new column to assessment_results
ALTER TABLE assessment_results
ADD COLUMN IF NOT EXISTS employee_id_new INTEGER;

-- Create indexes on new columns for performance during migration
CREATE INDEX IF NOT EXISTS idx_engagement_assignments_employee_id_new
ON engagement_campaign_assignments(employee_id_new);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_employee_id_new
ON assessment_campaign_assignments(employee_id_new);

CREATE INDEX IF NOT EXISTS idx_assessment_results_employee_id_new
ON assessment_results(employee_id_new);

-- Verify columns were added
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
AND column_name = 'employee_id_new';

COMMIT;

-- Show progress
SELECT
    'engagement_campaign_assignments' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id_new) as migrated_records
FROM engagement_campaign_assignments
UNION ALL
SELECT
    'assessment_campaign_assignments' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id_new) as migrated_records
FROM assessment_campaign_assignments
UNION ALL
SELECT
    'assessment_results' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id_new) as migrated_records
FROM assessment_results;