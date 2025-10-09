-- Rollback Migration 037: Remove UNIQUE constraint from employee_skills

-- Remove UNIQUE constraint
ALTER TABLE employee_skills
DROP CONSTRAINT IF EXISTS employee_skills_employee_id_skill_id_key;

-- Verify removal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'employee_skills_employee_id_skill_id_key'
    AND table_name = 'employee_skills'
  ) THEN
    RAISE NOTICE 'UNIQUE constraint employee_skills_employee_id_skill_id_key removed successfully';
  ELSE
    RAISE EXCEPTION 'Failed to remove UNIQUE constraint employee_skills_employee_id_skill_id_key';
  END IF;
END $$;
