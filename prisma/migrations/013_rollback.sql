-- Rollback Migration 013: Restructure Employee Skills
-- Date: 2025-10-02
-- Use this script ONLY if migration 013 needs to be reverted

-- ============================================================================
-- STEP 1: Re-add competenze_tecniche_trasversali to employee_roles
-- ============================================================================

ALTER TABLE railway.public.employee_roles
ADD COLUMN IF NOT EXISTS competenze_tecniche_trasversali JSONB DEFAULT '[]';

-- Restore data from employees.competenze_trasversali to employee_roles
UPDATE railway.public.employee_roles er
SET competenze_tecniche_trasversali = e.competenze_trasversali
FROM railway.public.employees e
WHERE er.employee_id = e.id
  AND er.is_current = true
  AND e.competenze_trasversali IS NOT NULL;

-- ============================================================================
-- STEP 2: Re-add certification fields to employee_skills
-- ============================================================================

ALTER TABLE railway.public.employee_skills
ADD COLUMN IF NOT EXISTS is_certified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certification_date DATE,
ADD COLUMN IF NOT EXISTS certification_authority VARCHAR(200);

-- ============================================================================
-- STEP 3: Remove source field from employee_skills
-- ============================================================================

ALTER TABLE railway.public.employee_skills
DROP COLUMN IF EXISTS source;

-- ============================================================================
-- STEP 4: Change proficiency_level back to INT
-- ============================================================================

-- Convert float back to int (multiply by 5 to get 1-5 scale)
UPDATE railway.public.employee_skills
SET proficiency_level = CASE
  WHEN proficiency_level <= 1 AND proficiency_level > 0 THEN ROUND(proficiency_level * 5)
  WHEN proficiency_level IS NULL THEN NULL
  ELSE proficiency_level
END;

ALTER TABLE railway.public.employee_skills
ALTER COLUMN proficiency_level TYPE INT USING proficiency_level::INT;

-- ============================================================================
-- STEP 5: Remove unique constraint
-- ============================================================================

DROP INDEX IF EXISTS railway.public.idx_employee_skills_unique;

-- ============================================================================
-- STEP 6: Drop employee_competenze_trasversali table
-- ============================================================================

DROP TABLE IF EXISTS railway.public.employee_competenze_trasversali CASCADE;

-- ============================================================================
-- LOGGING
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '⏪ Rollback 013 completed';
  RAISE NOTICE '⚠️  Data has been restored to previous structure';
  RAISE NOTICE '⚠️  Some data may have been lost if incompatible changes were made';
END $$;
