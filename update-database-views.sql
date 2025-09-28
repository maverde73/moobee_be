-- =================================================
-- UPDATE DATABASE VIEWS TO USE EMPLOYEES TABLE
-- =================================================
-- Script per aggiornare le viste che usano tenant_users.first_name/last_name
-- Da eseguire PRIMA della migration per rimuovere i campi duplicati
-- =================================================

-- 1. v_employee_roles_complete
DROP VIEW IF EXISTS v_employee_roles_complete CASCADE;

CREATE VIEW v_employee_roles_complete AS
SELECT
    er.id AS employee_role_id,
    er.employee_id,
    e.first_name,    -- NOW FROM employees table
    e.last_name,     -- NOW FROM employees table
    e.email,
    e.position,
    e.tenant_id,
    er.role_id,
    r."Role" AS role_name,
    r."NameKnown_Role" AS role_description,
    er.sub_role_id,
    sr."Sub_Role" AS sub_role_name,
    sr."NameKnown_Sub_Role" AS sub_role_description,
    er.start_date,
    er.end_date,
    er.is_current,
    er.created_at
FROM employee_roles er
LEFT JOIN employees e ON er.employee_id = e.id
LEFT JOIN roles r ON er.role_id = r.id
LEFT JOIN sub_roles sr ON er.sub_role_id = sr.id;

-- 2. v_employee_skills_complete
DROP VIEW IF EXISTS v_employee_skills_complete CASCADE;

CREATE VIEW v_employee_skills_complete AS
SELECT
    es.id AS employee_skill_id,
    es.employee_id,
    e.first_name,    -- NOW FROM employees table
    e.last_name,     -- NOW FROM employees table
    e.email,
    e.position,
    e.tenant_id,
    e.department_id,
    d.department_name,
    es.skill_id,
    s."Skill" AS skill_name,
    s."NameKnown_Skill" AS skill_category,
    NULL AS skill_type,
    es.proficiency_level,
    es.years_experience,
    es.last_used_date,
    es.is_certified,
    es.certification_date,
    es.certification_authority,
    es.notes,
    es.created_at,
    es.updated_at
FROM employee_skills es
LEFT JOIN employees e ON es.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN skills s ON es.skill_id = s.id;

-- 3. v_employee_planner
DROP VIEW IF EXISTS v_employee_planner CASCADE;

CREATE VIEW v_employee_planner AS
SELECT
    e.id AS employee_id,
    e.first_name,    -- NOW FROM employees table
    e.last_name,     -- NOW FROM employees table
    e.email,
    e.position,
    e.tenant_id,
    e.department_id,
    d.department_name,
    er.role_id,
    r."Role" AS role_name,
    er.sub_role_id,
    sr."Sub_Role" AS sub_role_name,
    -- Skill counts
    COUNT(DISTINCT es.skill_id) AS total_skills,
    COUNT(DISTINCT CASE WHEN es.proficiency_level >= 4 THEN es.skill_id END) AS expert_skills,
    COUNT(DISTINCT CASE WHEN es.proficiency_level = 3 THEN es.skill_id END) AS proficient_skills,
    COUNT(DISTINCT CASE WHEN es.proficiency_level <= 2 THEN es.skill_id END) AS learning_skills,
    -- Project involvement
    COUNT(DISTINCT pa.project_id) AS active_projects,
    -- Performance metrics
    AVG(a.overall_rating) AS avg_assessment_score,
    MAX(a.assessment_date) AS last_assessment_date
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN employee_roles er ON e.id = er.employee_id AND er.is_current = true
LEFT JOIN roles r ON er.role_id = r.id
LEFT JOIN sub_roles sr ON er.sub_role_id = sr.id
LEFT JOIN employee_skills es ON e.id = es.employee_id
LEFT JOIN project_assignments pa ON e.id = pa.employee_id AND pa.is_active = true
LEFT JOIN assessments a ON e.id = a.employee_id
WHERE e.is_active = true
GROUP BY
    e.id, e.first_name, e.last_name, e.email, e.position, e.tenant_id,
    e.department_id, d.department_name,
    er.role_id, r."Role", er.sub_role_id, sr."Sub_Role";

-- 4. v_skill_gap_analysis
DROP VIEW IF EXISTS v_skill_gap_analysis CASCADE;

CREATE VIEW v_skill_gap_analysis AS
WITH role_skill_requirements_cte AS (
    SELECT
        r.id AS role_id,
        r."Role" AS role_name,
        rsr.skill_id,
        s."Skill" AS skill_name,
        rsr.required_level AS required_proficiency
    FROM roles r
    JOIN role_skills_required rsr ON r.id = rsr.role_id
    JOIN skills s ON rsr.skill_id = s.id
),
employee_current_skills AS (
    SELECT
        e.id AS employee_id,
        e.first_name,    -- NOW FROM employees table
        e.last_name,     -- NOW FROM employees table
        e.tenant_id,
        er.role_id,
        es.skill_id,
        es.proficiency_level
    FROM employees e
    JOIN employee_roles er ON e.id = er.employee_id AND er.is_current = true
    LEFT JOIN employee_skills es ON e.id = es.employee_id
    WHERE e.is_active = true
)
SELECT
    ecs.employee_id,
    ecs.first_name,
    ecs.last_name,
    ecs.tenant_id,
    ecs.role_id,
    rsr.role_name,
    rsr.skill_id,
    rsr.skill_name,
    rsr.required_proficiency,
    COALESCE(ecs.proficiency_level, 0) AS current_proficiency,
    rsr.required_proficiency - COALESCE(ecs.proficiency_level, 0) AS proficiency_gap,
    CASE
        WHEN COALESCE(ecs.proficiency_level, 0) >= rsr.required_proficiency THEN 'Met'
        WHEN COALESCE(ecs.proficiency_level, 0) > 0 THEN 'Partial'
        ELSE 'Missing'
    END AS skill_status
FROM employee_current_skills ecs
CROSS JOIN role_skill_requirements_cte rsr
WHERE ecs.role_id = rsr.role_id;

-- =================================================
-- VERIFICA VIEWS AGGIORNATE
-- =================================================
-- Dopo l'esecuzione, verificare che le viste funzionino correttamente:

-- Test v_employee_roles_complete
-- SELECT * FROM v_employee_roles_complete LIMIT 5;

-- Test v_employee_skills_complete
-- SELECT * FROM v_employee_skills_complete LIMIT 5;

-- Test v_employee_planner
-- SELECT * FROM v_employee_planner LIMIT 5;

-- Test v_skill_gap_analysis
-- SELECT * FROM v_skill_gap_analysis LIMIT 5;

-- =================================================
-- NOTA IMPORTANTE
-- =================================================
-- Questo script deve essere eseguito PRIMA di procedere con:
-- npx prisma migrate dev --name remove_duplicate_name_fields
--
-- Le viste ora utilizzano employees.first_name e employees.last_name
-- invece di tenant_users.first_name e tenant_users.last_name
-- =================================================