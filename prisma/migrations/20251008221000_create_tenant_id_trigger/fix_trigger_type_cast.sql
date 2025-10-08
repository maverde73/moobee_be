-- Fix tenant_id trigger to handle UUID/TEXT type mismatch
-- employees.tenant_id is UUID, but employee_*.tenant_id is TEXT

CREATE OR REPLACE FUNCTION set_tenant_id_from_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- If tenant_id is already set, validate it matches employee's tenant
  IF NEW.tenant_id IS NOT NULL THEN
    -- Verify tenant_id matches the employee's tenant (with type casting)
    IF NOT EXISTS (
      SELECT 1 FROM employees
      WHERE id = NEW.employee_id
      AND tenant_id::TEXT = NEW.tenant_id  -- Cast UUID to TEXT for comparison
    ) THEN
      RAISE EXCEPTION 'tenant_id % does not match employee % tenant_id', NEW.tenant_id, NEW.employee_id;
    END IF;
  ELSE
    -- Auto-populate tenant_id from employees table (cast UUID to TEXT)
    SELECT tenant_id::TEXT INTO STRICT NEW.tenant_id
    FROM employees
    WHERE id = NEW.employee_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'Employee ID % not found in employees table', NEW.employee_id;
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Multiple employees found with ID % (data integrity issue)', NEW.employee_id;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  RAISE NOTICE '✅ Trigger function updated to handle UUID → TEXT casting';
END $$;
