-- Migration 044: Create MCP Optimized Views
-- Created: 2025-10-12
-- Purpose: Create views optimized for MCP server queries
-- Author: Claude Code
-- Reference: MCP Table Documentation System

-- ============================================================================
-- VIEW 1: v_employee_skills_summary
-- Purpose: Employee skills with grading based on their roles
-- Usage: Skills dashboard, profile pages, project matching
-- ============================================================================

CREATE OR REPLACE VIEW v_employee_skills_summary AS
SELECT
  es.employee_id,
  es.skill_id,
  COALESCE(s."NameKnown_Skill", s."Skill") AS skill_name,
  es.proficiency_level,
  es.source,
  -- Grading basato su employee_roles (max grading tra tutti i ruoli dell'employee)
  COALESCE(
    MAX(ssrv."Grading")::TEXT,
    'N/A'
  ) AS skill_grading,
  -- Indica se la skill è rilevante per almeno un ruolo corrente
  BOOL_OR(er.is_current = true) AS is_relevant_for_current_role,
  es.years_experience,
  es.last_used_date,
  es.created_at,
  es.updated_at,
  es.tenant_id
FROM employee_skills es
JOIN skills s ON es.skill_id = s.id
LEFT JOIN employee_roles er ON es.employee_id = er.employee_id
LEFT JOIN skills_sub_roles_value ssrv ON (
  es.skill_id = ssrv.id_skill
  AND er.sub_role_id = ssrv.id_sub_role
)
GROUP BY
  es.employee_id,
  es.skill_id,
  s."NameKnown_Skill",
  s."Skill",
  es.proficiency_level,
  es.source,
  es.years_experience,
  es.last_used_date,
  es.created_at,
  es.updated_at,
  es.tenant_id;

COMMENT ON VIEW v_employee_skills_summary IS
'Employee skills with grading calculated from skills_sub_roles_value based on employee roles.
Used for skills dashboard and profile pages. Optimized for MCP server queries.';

-- ============================================================================
-- VIEW 2: v_employee_complete_profile
-- Purpose: Complete employee profile with all related data in one query
-- Usage: Employee detail pages, profile cards, search results
-- ============================================================================

CREATE OR REPLACE VIEW v_employee_complete_profile AS
SELECT
  e.id,
  e.employee_code,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  e.position,
  e.hire_date,
  e.is_active,
  e.tenant_id,

  -- Department info
  e.department_id,
  d.department_name,

  -- Current role principale (primo ruolo con is_current=true ordinato per id)
  (
    SELECT er.id
    FROM employee_roles er
    WHERE er.employee_id = e.id AND er.is_current = true
    ORDER BY er.id ASC
    LIMIT 1
  ) AS current_role_id,
  (
    SELECT COALESCE(r.name, r."Role", r."NameKnown_Role")
    FROM employee_roles er
    JOIN roles r ON er.role_id = r.id
    WHERE er.employee_id = e.id AND er.is_current = true
    ORDER BY er.id ASC
    LIMIT 1
  ) AS current_role_name,
  (
    SELECT sr."Sub_Role"
    FROM employee_roles er
    JOIN sub_roles sr ON er.sub_role_id = sr.id
    WHERE er.employee_id = e.id AND er.is_current = true
    ORDER BY er.id ASC
    LIMIT 1
  ) AS current_sub_role_name,
  (
    SELECT er.anni_esperienza
    FROM employee_roles er
    WHERE er.employee_id = e.id AND er.is_current = true
    ORDER BY er.id ASC
    LIMIT 1
  ) AS current_role_years,

  -- Conteggi aggregati
  (SELECT COUNT(*) FROM employee_skills WHERE employee_id = e.id) AS total_skills,
  (SELECT COUNT(*) FROM employee_certifications WHERE employee_id = e.id) AS total_certifications,
  (SELECT COUNT(*) FROM employee_work_experiences WHERE employee_id = e.id) AS total_work_experiences,
  (SELECT COUNT(*) FROM employee_education WHERE employee_id = e.id) AS total_education,
  (SELECT COUNT(*) FROM employee_languages WHERE employee_id = e.id) AS total_languages,

  -- Latest CV extraction
  (
    SELECT id
    FROM cv_extractions
    WHERE employee_id = e.id AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  ) AS latest_cv_extraction_id,
  (
    SELECT created_at
    FROM cv_extractions
    WHERE employee_id = e.id AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  ) AS latest_cv_date,

  -- Soft skills profile
  e."softSkillProfileId",

  -- Timestamps
  e.created_at,
  e.updated_at,
  e."lastAssessmentDate",
  e."nextAssessmentDue"

FROM employees e
LEFT JOIN departments d ON e.department_id = d.id;

COMMENT ON VIEW v_employee_complete_profile IS
'Complete employee profile with department, current role, and aggregated counts.
Optimized for employee detail pages and profile cards. Single query instead of 10+ joins.';

-- ============================================================================
-- VIEW 3: v_assessment_results_summary
-- Purpose: Assessment results with scores and employee info
-- Usage: Assessment dashboard, employee assessment history
-- ============================================================================

CREATE OR REPLACE VIEW v_assessment_results_summary AS
SELECT
  ar.id AS assessment_result_id,
  ar.employee_id,
  e.first_name,
  e.last_name,
  e.email,
  ar.campaign_id,
  ar.assignment_id,
  ar.overall_score,
  ar.percentile,
  ar.scores AS skill_scores,
  ar.responses,
  ar.strengths,
  ar.improvements,
  ar.recommendations,
  ar.completed_at,
  ar.time_taken,
  ar.attempt_number

FROM assessment_results ar
JOIN employees e ON ar.employee_id = e.id
WHERE ar.completed_at IS NOT NULL;

COMMENT ON VIEW v_assessment_results_summary IS
'Assessment results with employee info and scores.
Only includes completed assessments. Optimized for dashboard and history views.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify views created
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'v_employee_skills_summary',
      'v_employee_complete_profile',
      'v_assessment_results_summary'
    );

  IF view_count = 3 THEN
    RAISE NOTICE '✅ Migration 044: Successfully created 3 MCP optimized views';
  ELSE
    RAISE EXCEPTION '❌ Migration 044: Expected 3 views, found %', view_count;
  END IF;
END $$;
