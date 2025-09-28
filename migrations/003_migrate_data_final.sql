-- ====================================================
-- MIGRATION STEP 3: MIGRATE DATA (FINAL VERSION)
-- Date: 2025-09-25 23:55
-- Purpose: Populate employee_id_new with correct employees.id values
-- ====================================================

BEGIN;

-- Migrate engagement_campaign_assignments
-- Direct comparison since both fields are TEXT
UPDATE engagement_campaign_assignments eca
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id = eca.employee_id
    LIMIT 1
)
WHERE eca.employee_id IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.id = eca.employee_id
);

-- Report engagement migration
SELECT
    'engagement_campaign_assignments' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id_new) as migrated_records,
    COUNT(*) - COUNT(employee_id_new) as failed_records
FROM engagement_campaign_assignments;

-- Migrate assessment_campaign_assignments
UPDATE assessment_campaign_assignments aca
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id = aca.employee_id
    LIMIT 1
)
WHERE aca.employee_id IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.id = aca.employee_id
);

-- Report assessment migration
SELECT
    'assessment_campaign_assignments' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id_new) as migrated_records,
    COUNT(*) - COUNT(employee_id_new) as failed_records
FROM assessment_campaign_assignments;

-- Migrate assessment_results
UPDATE assessment_results ar
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id = ar.employee_id
    LIMIT 1
)
WHERE ar.employee_id IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.id = ar.employee_id
);

-- Report results migration
SELECT
    'assessment_results' as table_name,
    COUNT(*) as total_records,
    COUNT(employee_id_new) as migrated_records,
    COUNT(*) - COUNT(employee_id_new) as failed_records
FROM assessment_results;

COMMIT;

-- Final summary
SELECT
    'MIGRATION COMPLETE' as status,
    NOW() as completed_at,
    (SELECT COUNT(employee_id_new) FROM engagement_campaign_assignments) as engagement_migrated,
    (SELECT COUNT(employee_id_new) FROM assessment_campaign_assignments) as assessment_migrated,
    (SELECT COUNT(employee_id_new) FROM assessment_results) as results_migrated;