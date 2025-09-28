-- Create Campaign Assignment Details View
-- Date: 2025-09-26 16:05
-- Purpose: Optimize campaign assignment queries

-- Drop the view if it exists
DROP VIEW IF EXISTS campaign_assignment_details;

-- Create the view
CREATE VIEW campaign_assignment_details AS
-- Engagement campaign assignments
SELECT
    eca.campaign_id,
    'engagement' AS campaign_type,
    eca.employee_id::text AS employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.email,
    e.position,
    d.department_name AS department,
    eca.status AS assignment_status,
    eca.assigned_at,
    eca.started_at,
    eca.completed_at,
    eca.assigned_at AS created_at,
    eca.assigned_at AS updated_at,
    ec.tenant_id
FROM engagement_campaign_assignments eca
INNER JOIN employees e ON eca.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
INNER JOIN engagement_campaigns ec ON eca.campaign_id = ec.id
WHERE e.is_active = true

UNION ALL

-- Assessment campaign assignments (if table exists)
SELECT
    aca.campaign_id,
    'assessment' AS campaign_type,
    aca.employee_id::text AS employee_id,
    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
    e.email,
    e.position,
    d.department_name AS department,
    aca.status AS assignment_status,
    aca.assigned_at,
    aca.started_at,
    aca.completed_at,
    aca.assigned_at AS created_at,
    aca.assigned_at AS updated_at,
    ac.tenant_id
FROM assessment_campaign_assignments aca
INNER JOIN employees e ON aca.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
INNER JOIN assessment_campaigns ac ON aca.campaign_id = ac.id
WHERE e.is_active = true;

-- Add comment to the view
COMMENT ON VIEW campaign_assignment_details IS 'Unified view for all campaign assignments with employee details for efficient querying';