-- ====================================================
-- MIGRATION STEP 3: MIGRATE DATA WITH PROPER CASTING
-- Date: 2025-09-26 00:00
-- Purpose: Populate employee_id_new with correct employees.id values
-- Fixed: Added explicit type casting for UUID comparison
-- ====================================================

BEGIN;

-- Migrate engagement_campaign_assignments
UPDATE engagement_campaign_assignments eca
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e
        ON e.email = tu.email
        AND e.tenant_id::text = tu.tenant_id  -- Cast UUID to TEXT for comparison
    WHERE tu.id = eca.employee_id
    LIMIT 1
)
WHERE eca.employee_id IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.id = eca.employee_id
);

-- Check engagement results
DO $$
DECLARE
    total_count INTEGER;
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(employee_id_new)
    INTO total_count, migrated_count
    FROM engagement_campaign_assignments;

    RAISE NOTICE 'Engagement: Total=%, Migrated=%', total_count, migrated_count;
END $$;

-- Migrate assessment_campaign_assignments
UPDATE assessment_campaign_assignments aca
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e
        ON e.email = tu.email
        AND e.tenant_id::text = tu.tenant_id  -- Cast UUID to TEXT
    WHERE tu.id = aca.employee_id
    LIMIT 1
)
WHERE aca.employee_id IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.id = aca.employee_id
);

-- Check assessment results
DO $$
DECLARE
    total_count INTEGER;
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(employee_id_new)
    INTO total_count, migrated_count
    FROM assessment_campaign_assignments;

    RAISE NOTICE 'Assessment: Total=%, Migrated=%', total_count, migrated_count;
END $$;

-- Migrate assessment_results
UPDATE assessment_results ar
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e
        ON e.email = tu.email
        AND e.tenant_id::text = tu.tenant_id  -- Cast UUID to TEXT
    WHERE tu.id = ar.employee_id
    LIMIT 1
)
WHERE ar.employee_id IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.id = ar.employee_id
);

-- Final report
SELECT
    table_name,
    total,
    migrated,
    failed,
    ROUND((migrated::numeric / NULLIF(total, 0)) * 100, 2) as success_rate
FROM (
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
    FROM assessment_results
) migration_stats
ORDER BY table_name;

COMMIT;