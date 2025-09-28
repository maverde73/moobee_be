-- ====================================================
-- MIGRATION STEP 4: SWITCH COLUMNS (SAFE VERSION)
-- Date: 2025-09-26 00:05
-- Purpose: Replace old String employee_id with new INT employee_id
-- Note: Handles NULL values for unmapped records
-- ====================================================

BEGIN;

-- Check for any NULL values first
DO $$
DECLARE
    null_engagement INTEGER;
    null_assessment INTEGER;
    null_results INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_engagement FROM engagement_campaign_assignments WHERE employee_id_new IS NULL;
    SELECT COUNT(*) INTO null_assessment FROM assessment_campaign_assignments WHERE employee_id_new IS NULL;
    SELECT COUNT(*) INTO null_results FROM assessment_results WHERE employee_id_new IS NULL;

    IF null_engagement > 0 THEN
        RAISE WARNING 'Found % engagement assignments with NULL employee_id_new', null_engagement;
    END IF;
    IF null_assessment > 0 THEN
        RAISE WARNING 'Found % assessment assignments with NULL employee_id_new', null_assessment;
    END IF;
    IF null_results > 0 THEN
        RAISE WARNING 'Found % assessment results with NULL employee_id_new', null_results;
    END IF;
END $$;

-- ENGAGEMENT_CAMPAIGN_ASSIGNMENTS
ALTER TABLE engagement_campaign_assignments
RENAME COLUMN employee_id TO employee_id_old;

ALTER TABLE engagement_campaign_assignments
RENAME COLUMN employee_id_new TO employee_id;

-- Only add NOT NULL if all values are populated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM engagement_campaign_assignments WHERE employee_id IS NULL) THEN
        ALTER TABLE engagement_campaign_assignments
        ALTER COLUMN employee_id SET NOT NULL;
    ELSE
        RAISE WARNING 'Skipping NOT NULL constraint for engagement_campaign_assignments due to NULL values';
    END IF;
END $$;

-- Add Foreign Key (will still work with NULL values)
ALTER TABLE engagement_campaign_assignments
ADD CONSTRAINT fk_engagement_assignments_employee
FOREIGN KEY (employee_id) REFERENCES employees(id)
ON DELETE CASCADE;

-- ASSESSMENT_CAMPAIGN_ASSIGNMENTS
ALTER TABLE assessment_campaign_assignments
RENAME COLUMN employee_id TO employee_id_old;

ALTER TABLE assessment_campaign_assignments
RENAME COLUMN employee_id_new TO employee_id;

-- Only add NOT NULL if all values are populated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM assessment_campaign_assignments WHERE employee_id IS NULL) THEN
        ALTER TABLE assessment_campaign_assignments
        ALTER COLUMN employee_id SET NOT NULL;
    ELSE
        RAISE WARNING 'Skipping NOT NULL constraint for assessment_campaign_assignments due to NULL values';
    END IF;
END $$;

-- Add Foreign Key
ALTER TABLE assessment_campaign_assignments
ADD CONSTRAINT fk_assessment_assignments_employee
FOREIGN KEY (employee_id) REFERENCES employees(id)
ON DELETE CASCADE;

-- ASSESSMENT_RESULTS (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'assessment_results'
               AND column_name = 'employee_id_new') THEN

        ALTER TABLE assessment_results
        RENAME COLUMN employee_id TO employee_id_old;

        ALTER TABLE assessment_results
        RENAME COLUMN employee_id_new TO employee_id;

        IF NOT EXISTS (SELECT 1 FROM assessment_results WHERE employee_id IS NULL) THEN
            ALTER TABLE assessment_results
            ALTER COLUMN employee_id SET NOT NULL;
        END IF;

        ALTER TABLE assessment_results
        ADD CONSTRAINT fk_assessment_results_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_engagement_assignments_employee_id
ON engagement_campaign_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_employee_id
ON assessment_campaign_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_employee_id
ON assessment_results(employee_id) WHERE employee_id IS NOT NULL;

-- Verify Foreign Keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
AND kcu.column_name = 'employee_id';

COMMIT;

-- Summary
SELECT
    'Migration Complete!' as status,
    (SELECT COUNT(*) FROM engagement_campaign_assignments WHERE employee_id IS NOT NULL) as engagement_migrated,
    (SELECT COUNT(*) FROM assessment_campaign_assignments WHERE employee_id IS NOT NULL) as assessment_migrated,
    (SELECT COUNT(*) FROM assessment_results WHERE employee_id IS NOT NULL) as results_migrated;