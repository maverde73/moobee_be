-- ====================================================
-- MIGRATION STEP 3: MIGRATE DATA
-- Date: 2025-09-25 23:30
-- Purpose: Populate employee_id_new with correct employees.id values
-- ====================================================

BEGIN;

-- Migrate engagement_campaign_assignments
WITH mapping AS (
    SELECT
        eca.id as assignment_id,
        eca.employee_id as tenant_user_id,
        e.id as employee_id
    FROM engagement_campaign_assignments eca
    INNER JOIN tenant_users tu ON tu.id = eca.employee_id
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
)
UPDATE engagement_campaign_assignments
SET employee_id_new = mapping.employee_id
FROM mapping
WHERE engagement_campaign_assignments.id = mapping.assignment_id;

-- Verify engagement migration
DO $$
DECLARE
    total_count INTEGER;
    migrated_count INTEGER;
    failed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM engagement_campaign_assignments;
    SELECT COUNT(*) INTO migrated_count FROM engagement_campaign_assignments WHERE employee_id_new IS NOT NULL;
    failed_count := total_count - migrated_count;

    RAISE NOTICE 'Engagement assignments - Total: %, Migrated: %, Failed: %', total_count, migrated_count, failed_count;

    IF failed_count > 0 THEN
        -- Log failed migrations for investigation
        RAISE WARNING 'Found % engagement assignments without mapping', failed_count;
    END IF;
END $$;

-- Migrate assessment_campaign_assignments
WITH mapping AS (
    SELECT
        aca.id as assignment_id,
        aca.employee_id as tenant_user_id,
        e.id as employee_id
    FROM assessment_campaign_assignments aca
    INNER JOIN tenant_users tu ON tu.id = aca.employee_id
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
)
UPDATE assessment_campaign_assignments
SET employee_id_new = mapping.employee_id
FROM mapping
WHERE assessment_campaign_assignments.id = mapping.assignment_id;

-- Verify assessment migration
DO $$
DECLARE
    total_count INTEGER;
    migrated_count INTEGER;
    failed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM assessment_campaign_assignments;
    SELECT COUNT(*) INTO migrated_count FROM assessment_campaign_assignments WHERE employee_id_new IS NOT NULL;
    failed_count := total_count - migrated_count;

    RAISE NOTICE 'Assessment assignments - Total: %, Migrated: %, Failed: %', total_count, migrated_count, failed_count;

    IF failed_count > 0 THEN
        RAISE WARNING 'Found % assessment assignments without mapping', failed_count;
    END IF;
END $$;

-- Migrate assessment_results
WITH mapping AS (
    SELECT
        ar.id as result_id,
        ar.employee_id as tenant_user_id,
        e.id as employee_id
    FROM assessment_results ar
    INNER JOIN tenant_users tu ON tu.id = ar.employee_id
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
)
UPDATE assessment_results
SET employee_id_new = mapping.employee_id
FROM mapping
WHERE assessment_results.id = mapping.result_id;

-- Final verification
SELECT
    'engagement_campaign_assignments' as table_name,
    COUNT(*) as total,
    COUNT(employee_id_new) as migrated,
    COUNT(*) - COUNT(employee_id_new) as failed
FROM engagement_campaign_assignments
UNION ALL
SELECT
    'assessment_campaign_assignments' as table_name,
    COUNT(*) as total,
    COUNT(employee_id_new) as migrated,
    COUNT(*) - COUNT(employee_id_new) as failed
FROM assessment_campaign_assignments
UNION ALL
SELECT
    'assessment_results' as table_name,
    COUNT(*) as total,
    COUNT(employee_id_new) as migrated,
    COUNT(*) - COUNT(employee_id_new) as failed
FROM assessment_results;

COMMIT;