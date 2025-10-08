-- Rollback: Remove seniority field from employee_roles

-- Drop index
DROP INDEX IF EXISTS idx_employee_roles_seniority;

-- Remove seniority column
ALTER TABLE employee_roles
DROP COLUMN IF EXISTS seniority;
