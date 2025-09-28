-- ====================================================
-- ROLLBACK SCRIPT - EMERGENCY USE ONLY
-- Date: 2025-09-25 23:30
-- Purpose: Rollback employee_id migration if something goes wrong
-- ====================================================

-- OPTION 1: QUICK ROLLBACK (if still have _old columns)
-- Use this within 1 hour of migration

BEGIN;

-- Check if old columns still exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'engagement_campaign_assignments'
        AND column_name = 'employee_id_old'
    ) THEN
        -- Rollback engagement_campaign_assignments
        ALTER TABLE engagement_campaign_assignments
        DROP CONSTRAINT IF EXISTS fk_engagement_assignments_employee;

        ALTER TABLE engagement_campaign_assignments
        RENAME COLUMN employee_id TO employee_id_new;

        ALTER TABLE engagement_campaign_assignments
        RENAME COLUMN employee_id_old TO employee_id;

        -- Rollback assessment_campaign_assignments
        ALTER TABLE assessment_campaign_assignments
        DROP CONSTRAINT IF EXISTS fk_assessment_assignments_employee;

        ALTER TABLE assessment_campaign_assignments
        RENAME COLUMN employee_id TO employee_id_new;

        ALTER TABLE assessment_campaign_assignments
        RENAME COLUMN employee_id_old TO employee_id;

        -- Rollback assessment_results
        ALTER TABLE assessment_results
        DROP CONSTRAINT IF EXISTS fk_assessment_results_employee;

        ALTER TABLE assessment_results
        RENAME COLUMN employee_id TO employee_id_new;

        ALTER TABLE assessment_results
        RENAME COLUMN employee_id_old TO employee_id;

        RAISE NOTICE 'Quick rollback completed successfully';
    ELSE
        RAISE NOTICE 'Old columns not found. Use FULL RESTORE option.';
    END IF;
END $$;

COMMIT;

-- ====================================================
-- OPTION 2: FULL RESTORE FROM BACKUP
-- Use this if old columns have been dropped
-- ====================================================

/*
-- Uncomment and run if needed

BEGIN;

-- Drop current tables (CAREFUL!)
DROP TABLE IF EXISTS engagement_campaign_assignments CASCADE;
DROP TABLE IF EXISTS assessment_campaign_assignments CASCADE;
DROP TABLE IF EXISTS assessment_results CASCADE;

-- Recreate from backup
CREATE TABLE engagement_campaign_assignments AS
SELECT * FROM engagement_campaign_assignments_backup_20250925;

CREATE TABLE assessment_campaign_assignments AS
SELECT * FROM assessment_campaign_assignments_backup_20250925;

CREATE TABLE assessment_results AS
SELECT * FROM assessment_results_backup_20250925;

-- Recreate indexes
CREATE INDEX idx_engagement_assignments_id ON engagement_campaign_assignments(id);
CREATE INDEX idx_engagement_assignments_campaign_id ON engagement_campaign_assignments(campaign_id);
CREATE INDEX idx_engagement_assignments_employee_id ON engagement_campaign_assignments(employee_id);

CREATE INDEX idx_assessment_assignments_id ON assessment_campaign_assignments(id);
CREATE INDEX idx_assessment_assignments_campaign_id ON assessment_campaign_assignments(campaign_id);
CREATE INDEX idx_assessment_assignments_employee_id ON assessment_campaign_assignments(employee_id);

CREATE INDEX idx_assessment_results_id ON assessment_results(id);
CREATE INDEX idx_assessment_results_campaign_id ON assessment_results(campaign_id);
CREATE INDEX idx_assessment_results_employee_id ON assessment_results(employee_id);

-- Recreate primary keys
ALTER TABLE engagement_campaign_assignments ADD PRIMARY KEY (id);
ALTER TABLE assessment_campaign_assignments ADD PRIMARY KEY (id);
ALTER TABLE assessment_results ADD PRIMARY KEY (id);

COMMIT;

*/

-- Verify rollback
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
AND column_name LIKE 'employee_id%'
ORDER BY table_name, column_name;