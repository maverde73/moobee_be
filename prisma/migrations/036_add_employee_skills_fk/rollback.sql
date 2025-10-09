-- Rollback Migration 036: Remove foreign key from employee_skills

-- Remove index
DROP INDEX IF EXISTS idx_employee_skills_employee_id;

-- Remove foreign key constraint
ALTER TABLE employee_skills
DROP CONSTRAINT IF EXISTS fk_employee_skills_employee;

-- Verify removal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_employee_skills_employee'
    AND table_name = 'employee_skills'
  ) THEN
    RAISE NOTICE 'Foreign key fk_employee_skills_employee removed successfully';
  ELSE
    RAISE EXCEPTION 'Failed to remove foreign key fk_employee_skills_employee';
  END IF;
END $$;
