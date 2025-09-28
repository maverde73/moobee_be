-- ====================================================
-- MIGRATION STEP 4: SWITCH COLUMNS
-- Date: 2025-09-25 23:30
-- Purpose: Replace old String employee_id with new INT employee_id
-- ====================================================

BEGIN;

-- ENGAGEMENT_CAMPAIGN_ASSIGNMENTS
-- Rename old column
ALTER TABLE engagement_campaign_assignments
RENAME COLUMN employee_id TO employee_id_old;

-- Rename new column
ALTER TABLE engagement_campaign_assignments
RENAME COLUMN employee_id_new TO employee_id;

-- Add NOT NULL constraint
ALTER TABLE engagement_campaign_assignments
ALTER COLUMN employee_id SET NOT NULL;

-- Add Foreign Key
ALTER TABLE engagement_campaign_assignments
ADD CONSTRAINT fk_engagement_assignments_employee
FOREIGN KEY (employee_id) REFERENCES employees(id)
ON DELETE CASCADE;

-- ASSESSMENT_CAMPAIGN_ASSIGNMENTS
-- Rename old column
ALTER TABLE assessment_campaign_assignments
RENAME COLUMN employee_id TO employee_id_old;

-- Rename new column
ALTER TABLE assessment_campaign_assignments
RENAME COLUMN employee_id_new TO employee_id;

-- Add NOT NULL constraint
ALTER TABLE assessment_campaign_assignments
ALTER COLUMN employee_id SET NOT NULL;

-- Add Foreign Key
ALTER TABLE assessment_campaign_assignments
ADD CONSTRAINT fk_assessment_assignments_employee
FOREIGN KEY (employee_id) REFERENCES employees(id)
ON DELETE CASCADE;

-- ASSESSMENT_RESULTS
-- Rename old column
ALTER TABLE assessment_results
RENAME COLUMN employee_id TO employee_id_old;

-- Rename new column
ALTER TABLE assessment_results
RENAME COLUMN employee_id_new TO employee_id;

-- Add NOT NULL constraint
ALTER TABLE assessment_results
ALTER COLUMN employee_id SET NOT NULL;

-- Add Foreign Key
ALTER TABLE assessment_results
ADD CONSTRAINT fk_assessment_results_employee
FOREIGN KEY (employee_id) REFERENCES employees(id)
ON DELETE CASCADE;

-- Drop old indexes if exist
DROP INDEX IF EXISTS idx_engagement_assignments_employee_id;
DROP INDEX IF EXISTS idx_assessment_assignments_employee_id;
DROP INDEX IF EXISTS idx_assessment_results_employee_id;

-- Create new indexes
CREATE INDEX idx_engagement_assignments_employee_id
ON engagement_campaign_assignments(employee_id);

CREATE INDEX idx_assessment_assignments_employee_id
ON assessment_campaign_assignments(employee_id);

CREATE INDEX idx_assessment_results_employee_id
ON assessment_results(employee_id);

-- Verify new schema
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
AND kcu.column_name = 'employee_id';

COMMIT;