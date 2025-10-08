-- Migration 034: Create tenant_id auto-population trigger
-- Description: Automatically populate tenant_id from employee table on INSERT/UPDATE
-- Created: 2025-10-08
-- Strategy: Database Trigger (see docs/TENANT_ID_PROPAGATION_STRATEGY.md)

-- Create trigger function
CREATE OR REPLACE FUNCTION set_tenant_id_from_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- If tenant_id is already set, validate it matches employee's tenant
  IF NEW.tenant_id IS NOT NULL THEN
    -- Verify tenant_id matches the employee's tenant
    IF NOT EXISTS (
      SELECT 1 FROM employees
      WHERE id = NEW.employee_id
      AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'tenant_id % does not match employee % tenant_id', NEW.tenant_id, NEW.employee_id;
    END IF;
  ELSE
    -- Auto-populate tenant_id from employees table
    SELECT tenant_id INTO STRICT NEW.tenant_id
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

-- Apply trigger to all employee tables
CREATE TRIGGER trg_set_tenant_id_employee_additional_info
BEFORE INSERT OR UPDATE ON employee_additional_info
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_awards
BEFORE INSERT OR UPDATE ON employee_awards
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_certifications
BEFORE INSERT OR UPDATE ON employee_certifications
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_domain_knowledge
BEFORE INSERT OR UPDATE ON employee_domain_knowledge
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_education
BEFORE INSERT OR UPDATE ON employee_education
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_languages
BEFORE INSERT OR UPDATE ON employee_languages
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_projects
BEFORE INSERT OR UPDATE ON employee_projects
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_publications
BEFORE INSERT OR UPDATE ON employee_publications
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_skills
BEFORE INSERT OR UPDATE ON employee_skills
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

CREATE TRIGGER trg_set_tenant_id_employee_work_experiences
BEFORE INSERT OR UPDATE ON employee_work_experiences
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_employee();

-- Verification: List all triggers
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_set_tenant_id_%'
ORDER BY event_object_table;

DO $$ BEGIN
  RAISE NOTICE 'Tenant ID trigger installed on 10 employee tables';
END $$;
