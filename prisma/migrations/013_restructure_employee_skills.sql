-- Migration 013: Restructure Employee Skills and Competenze Trasversali
-- Date: 2025-10-02
-- Description:
--   1. Remove competenze_tecniche_trasversali from employee_roles (move to employees)
--   2. Remove certification fields from employee_skills (use employee_certifications table)
--   3. Create employee_competenze_trasversali table for full-text search
--   4. Migrate existing data

-- ============================================================================
-- STEP 1: Migrate competenze_tecniche_trasversali from employee_roles to employees
-- ============================================================================

-- Update employees.competenze_trasversali with data from employee_roles
-- Only if employees.competenze_trasversali is NULL or empty
UPDATE railway.public.employees e
SET competenze_trasversali = COALESCE(
  (
    SELECT er.competenze_tecniche_trasversali
    FROM railway.public.employee_roles er
    WHERE er.employee_id = e.id
      AND er.is_current = true
      AND er.competenze_tecniche_trasversali IS NOT NULL
      AND jsonb_array_length(er.competenze_tecniche_trasversali::jsonb) > 0
    ORDER BY er.created_at DESC
    LIMIT 1
  ),
  e.competenze_trasversali
)
WHERE e.competenze_trasversali IS NULL
   OR jsonb_array_length(e.competenze_trasversali::jsonb) = 0;

-- ============================================================================
-- STEP 2: Create employee_competenze_trasversali table for full-text search
-- ============================================================================

CREATE TABLE IF NOT EXISTS railway.public.employee_competenze_trasversali (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL,
  competenza TEXT NOT NULL,
  categoria VARCHAR(50),  -- 'bancaria', 'automotive', 'pubblica_amministrazione', 'software', etc.
  anni_esperienza INT,
  livello VARCHAR(20),    -- 'base', 'intermedio', 'avanzato', 'esperto'
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  tenant_id UUID NOT NULL,

  CONSTRAINT fk_employee_competenze_employee
    FOREIGN KEY (employee_id)
    REFERENCES railway.public.employees(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_competenze_employee_id
  ON railway.public.employee_competenze_trasversali(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_competenze_tenant_id
  ON railway.public.employee_competenze_trasversali(tenant_id);

CREATE INDEX IF NOT EXISTS idx_employee_competenze_categoria
  ON railway.public.employee_competenze_trasversali(categoria);

-- Create full-text search index (Italian language)
CREATE INDEX IF NOT EXISTS idx_employee_competenze_search
  ON railway.public.employee_competenze_trasversali
  USING gin(to_tsvector('italian', competenza));

-- ============================================================================
-- STEP 3: Populate employee_competenze_trasversali from employees.competenze_trasversali
-- ============================================================================

-- Insert competenze trasversali from employees JSONB field
-- Parse JSON array and create individual records
INSERT INTO railway.public.employee_competenze_trasversali (
  employee_id,
  competenza,
  tenant_id
)
SELECT
  e.id,
  jsonb_array_elements_text(e.competenze_trasversali::jsonb) as competenza,
  e.tenant_id
FROM railway.public.employees e
WHERE e.competenze_trasversali IS NOT NULL
  AND jsonb_array_length(e.competenze_trasversali::jsonb) > 0
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Remove competenze_tecniche_trasversali from employee_roles
-- ============================================================================

ALTER TABLE railway.public.employee_roles
DROP COLUMN IF EXISTS competenze_tecniche_trasversali;

-- ============================================================================
-- STEP 5: Remove certification fields from employee_skills
-- ============================================================================

-- These fields are redundant with employee_certifications table
ALTER TABLE railway.public.employee_skills
DROP COLUMN IF EXISTS is_certified,
DROP COLUMN IF EXISTS certification_date,
DROP COLUMN IF EXISTS certification_authority;

-- ============================================================================
-- STEP 6: Add source field to employee_skills if not exists
-- ============================================================================

-- Track where the skill data came from
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_skills'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE railway.public.employee_skills
    ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Change proficiency_level from INT to FLOAT for grading (0.0-1.0)
-- ============================================================================

-- Update proficiency_level to support decimal values (0.0 to 1.0)
ALTER TABLE railway.public.employee_skills
ALTER COLUMN proficiency_level TYPE FLOAT USING proficiency_level::FLOAT;

-- Normalize existing values (assuming INT was 1-5 scale, convert to 0.0-1.0)
UPDATE railway.public.employee_skills
SET proficiency_level = CASE
  WHEN proficiency_level > 1 THEN proficiency_level / 5.0  -- Convert 1-5 to 0.2-1.0
  WHEN proficiency_level <= 1 AND proficiency_level > 0 THEN proficiency_level  -- Already 0-1
  ELSE NULL
END
WHERE proficiency_level IS NOT NULL;

-- ============================================================================
-- STEP 8: Add unique constraint to employee_skills
-- ============================================================================

-- Prevent duplicate skill assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_skills_unique
  ON railway.public.employee_skills(employee_id, skill_id);

-- ============================================================================
-- LOGGING
-- ============================================================================

DO $$
DECLARE
  migrated_count INT;
  competenze_count INT;
BEGIN
  -- Count migrated competenze
  SELECT COUNT(*) INTO migrated_count
  FROM railway.public.employees
  WHERE competenze_trasversali IS NOT NULL
    AND jsonb_array_length(competenze_trasversali::jsonb) > 0;

  SELECT COUNT(*) INTO competenze_count
  FROM railway.public.employee_competenze_trasversali;

  RAISE NOTICE '✅ Migration 013 completed successfully';
  RAISE NOTICE '📊 Employees with competenze_trasversali: %', migrated_count;
  RAISE NOTICE '📊 Total competenze_trasversali records: %', competenze_count;
  RAISE NOTICE '🗑️ Removed competenze_tecniche_trasversali from employee_roles';
  RAISE NOTICE '🗑️ Removed certification fields from employee_skills';
  RAISE NOTICE '✨ Created employee_competenze_trasversali table with full-text search';
END $$;
