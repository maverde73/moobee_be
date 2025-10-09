-- Migration 036: Add missing foreign key employee_skills.employee_id → employees.id
-- Date: 2025-10-09
-- Critical fix: employee_skills table was missing FK to employees table

-- Add foreign key constraint
ALTER TABLE employee_skills
ADD CONSTRAINT fk_employee_skills_employee
FOREIGN KEY (employee_id)
REFERENCES employees(id)
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id
ON employee_skills(employee_id);

-- Verify the constraint was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_employee_skills_employee'
    AND table_name = 'employee_skills'
  ) THEN
    RAISE NOTICE 'Foreign key fk_employee_skills_employee created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create foreign key fk_employee_skills_employee';
  END IF;
END $$;
