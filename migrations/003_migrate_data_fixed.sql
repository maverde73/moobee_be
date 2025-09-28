-- ====================================================
-- MIGRATION STEP 3: MIGRATE DATA (FIXED)
-- Date: 2025-09-25 23:45
-- Purpose: Populate employee_id_new with correct employees.id values
-- Fixed: Added proper type casting for UUID comparison
-- ====================================================

BEGIN;

-- Migrate engagement_campaign_assignments
UPDATE engagement_campaign_assignments eca
SET employee_id_new = e.id
FROM tenant_users tu
INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
WHERE eca.employee_id = tu.id::text;

-- Log engagement migration results
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
        RAISE WARNING 'Found % engagement assignments without mapping', failed_count;
    END IF;
END $$;

-- Migrate assessment_campaign_assignments
UPDATE assessment_campaign_assignments aca
SET employee_id_new = e.id
FROM tenant_users tu
INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
WHERE aca.employee_id = tu.id::text;

-- Log assessment migration results
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
UPDATE assessment_results ar
SET employee_id_new = e.id
FROM tenant_users tu
INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
WHERE ar.employee_id = tu.id::text;

-- Final verification report
SELECT
    'engagement_campaign_assignments' as table_name,
    COUNT(*) as total,
    COUNT(employee_id_new) as migrated,
    COUNT(*) - COUNT(employee_id_new) as failed,
    CASE
        WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(employee_id_new)::numeric / COUNT(*)) * 100, 2)
        ELSE 0
    END as success_rate
FROM engagement_campaign_assignments
UNION ALL
SELECT
    'assessment_campaign_assignments' as table_name,
    COUNT(*) as total,
    COUNT(employee_id_new) as migrated,
    COUNT(*) - COUNT(employee_id_new) as failed,
    CASE
        WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(employee_id_new)::numeric / COUNT(*)) * 100, 2)
        ELSE 0
    END as success_rate
FROM assessment_campaign_assignments
UNION ALL
SELECT
    'assessment_results' as table_name,
    COUNT(*) as total,
    COUNT(employee_id_new) as migrated,
    COUNT(*) - COUNT(employee_id_new) as failed,
    CASE
        WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(employee_id_new)::numeric / COUNT(*)) * 100, 2)
        ELSE 0
    END as success_rate
FROM assessment_results;

COMMIT;