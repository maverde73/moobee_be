-- Migration 037: Add UNIQUE constraint on employee_skills (employee_id, skill_id)
-- Date: 2025-10-09
-- Critical fix: Missing constraint causes duplicate records instead of upsert

-- First, remove any existing duplicates (keep the most recent)
DELETE FROM employee_skills
WHERE id NOT IN (
  SELECT MAX(id)
  FROM employee_skills
  GROUP BY employee_id, skill_id
);

-- Add UNIQUE constraint
ALTER TABLE employee_skills
ADD CONSTRAINT employee_skills_employee_id_skill_id_key
UNIQUE (employee_id, skill_id);

-- Verify the constraint was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'employee_skills_employee_id_skill_id_key'
    AND table_name = 'employee_skills'
  ) THEN
    RAISE NOTICE 'UNIQUE constraint employee_skills_employee_id_skill_id_key created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create UNIQUE constraint employee_skills_employee_id_skill_id_key';
  END IF;
END $$;
