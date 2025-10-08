-- Fix existing UUID tenant_id columns in employee_skills and employee_roles
-- These tables already have tenant_id as UUID but tenants.id is TEXT

-- Convert employee_skills.tenant_id from UUID to TEXT
ALTER TABLE employee_skills ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::TEXT;

-- Convert employee_roles.tenant_id from UUID to TEXT
ALTER TABLE employee_roles ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::TEXT;

-- Now add foreign key constraints (drop first if exists)
ALTER TABLE employee_skills DROP CONSTRAINT IF EXISTS fk_employee_skills_tenant;
ALTER TABLE employee_skills
ADD CONSTRAINT fk_employee_skills_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_roles DROP CONSTRAINT IF EXISTS fk_employee_roles_tenant;
ALTER TABLE employee_roles
ADD CONSTRAINT fk_employee_roles_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DO $$ BEGIN
  RAISE NOTICE 'Converted employee_skills and employee_roles tenant_id from UUID to TEXT';
END $$;
