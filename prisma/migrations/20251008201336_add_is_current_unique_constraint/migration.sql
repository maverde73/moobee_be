-- Migration: Add is_current unique constraint
-- Description: Ensure only one current role per employee
-- Created: 2025-10-08

-- Step 0: Add is_current column if not exists
ALTER TABLE employee_roles
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;

-- Step 1: Cleanup - Set oldest role as current for employees with multiple is_current=true
WITH ranked_roles AS (
  SELECT
    id,
    employee_id,
    ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY created_at ASC) as rn
  FROM employee_roles
  WHERE is_current = true
)
UPDATE employee_roles er
SET is_current = false
FROM ranked_roles rr
WHERE er.id = rr.id AND rr.rn > 1;

-- Step 2: Auto-set single role as current
-- If employee has only 1 role and it's not current, set it as current
WITH single_role_employees AS (
  SELECT employee_id, MIN(id) as role_id
  FROM employee_roles
  GROUP BY employee_id
  HAVING COUNT(*) = 1
)
UPDATE employee_roles er
SET is_current = true
FROM single_role_employees sre
WHERE er.id = sre.role_id AND er.is_current = false;

-- Step 3: Create partial unique index
-- Allows only one is_current=true per employee
CREATE UNIQUE INDEX idx_employee_roles_one_current
ON employee_roles (employee_id)
WHERE is_current = true;

-- Step 4: Add trigger to auto-set single role as current
CREATE OR REPLACE FUNCTION ensure_single_role_is_current()
RETURNS TRIGGER AS $$
DECLARE
  role_count INTEGER;
BEGIN
  -- Count roles for this employee
  SELECT COUNT(*) INTO role_count
  FROM employee_roles
  WHERE employee_id = NEW.employee_id;

  -- If only one role exists, force it to be current
  IF role_count = 1 THEN
    NEW.is_current := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_single_role_current
BEFORE INSERT OR UPDATE ON employee_roles
FOR EACH ROW
EXECUTE FUNCTION ensure_single_role_is_current();

-- Step 5: Add trigger to prevent deleting the last current role
CREATE OR REPLACE FUNCTION prevent_delete_last_current_role()
RETURNS TRIGGER AS $$
DECLARE
  role_count INTEGER;
  current_count INTEGER;
BEGIN
  -- Count total roles and current roles for this employee
  SELECT COUNT(*) INTO role_count
  FROM employee_roles
  WHERE employee_id = OLD.employee_id;

  SELECT COUNT(*) INTO current_count
  FROM employee_roles
  WHERE employee_id = OLD.employee_id AND is_current = true;

  -- If deleting the only current role and other roles exist, prevent deletion
  IF OLD.is_current = true AND current_count = 1 AND role_count > 1 THEN
    RAISE EXCEPTION 'Cannot delete the only current role. Set another role as current first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_delete_last_current
BEFORE DELETE ON employee_roles
FOR EACH ROW
EXECUTE FUNCTION prevent_delete_last_current_role();
