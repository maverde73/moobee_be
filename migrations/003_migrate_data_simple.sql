-- ====================================================
-- MIGRATION STEP 3: MIGRATE DATA (SIMPLIFIED)
-- Date: 2025-09-25 23:50
-- Purpose: Populate employee_id_new with correct employees.id values
-- ====================================================

BEGIN;

-- Migrate engagement_campaign_assignments
UPDATE engagement_campaign_assignments eca
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id::text = eca.employee_id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id::text = eca.employee_id
);

-- Check engagement results
SELECT 'engagement_campaign_assignments' as table_name,
       COUNT(*) as total_records,
       COUNT(employee_id_new) as migrated_records;

-- Migrate assessment_campaign_assignments
UPDATE assessment_campaign_assignments aca
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id::text = aca.employee_id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id::text = aca.employee_id
);

-- Check assessment results
SELECT 'assessment_campaign_assignments' as table_name,
       COUNT(*) as total_records,
       COUNT(employee_id_new) as migrated_records;

-- Migrate assessment_results
UPDATE assessment_results ar
SET employee_id_new = (
    SELECT e.id
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id::text = ar.employee_id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM tenant_users tu
    INNER JOIN employees e ON e.email = tu.email AND e.tenant_id = tu.tenant_id
    WHERE tu.id::text = ar.employee_id
);

-- Final report
SELECT
    'Summary' as report,
    (SELECT COUNT(*) FROM engagement_campaign_assignments WHERE employee_id_new IS NOT NULL) as engagement_migrated,
    (SELECT COUNT(*) FROM assessment_campaign_assignments WHERE employee_id_new IS NOT NULL) as assessment_migrated,
    (SELECT COUNT(*) FROM assessment_results WHERE employee_id_new IS NOT NULL) as results_migrated;

COMMIT;