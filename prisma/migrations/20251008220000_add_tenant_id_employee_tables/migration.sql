-- Migration 033: Add tenant_id to employee tables
-- Description: Add tenant_id column to all employee-related tables for multi-tenant isolation
-- Created: 2025-10-08
-- Strategy: Database Trigger (see docs/TENANT_ID_PROPAGATION_STRATEGY.md)

-- Step 1: Add tenant_id columns (nullable for backfill)
-- Note: tenants.id is TEXT, not UUID
ALTER TABLE employee_additional_info ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_awards ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_certifications ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_domain_knowledge ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_education ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_languages ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_projects ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE employee_publications ADD COLUMN IF NOT EXISTS tenant_id TEXT;
-- employee_skills already has tenant_id (converted from UUID to TEXT)
ALTER TABLE employee_work_experiences ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Step 2: Backfill tenant_id for existing records
UPDATE employee_additional_info eai
SET tenant_id = e.tenant_id
FROM employees e
WHERE eai.employee_id = e.id AND eai.tenant_id IS NULL;

UPDATE employee_awards ea
SET tenant_id = e.tenant_id
FROM employees e
WHERE ea.employee_id = e.id AND ea.tenant_id IS NULL;

UPDATE employee_certifications ec
SET tenant_id = e.tenant_id
FROM employees e
WHERE ec.employee_id = e.id AND ec.tenant_id IS NULL;

UPDATE employee_domain_knowledge edk
SET tenant_id = e.tenant_id
FROM employees e
WHERE edk.employee_id = e.id AND edk.tenant_id IS NULL;

UPDATE employee_education ee
SET tenant_id = e.tenant_id
FROM employees e
WHERE ee.employee_id = e.id AND ee.tenant_id IS NULL;

UPDATE employee_languages el
SET tenant_id = e.tenant_id
FROM employees e
WHERE el.employee_id = e.id AND el.tenant_id IS NULL;

UPDATE employee_projects ep
SET tenant_id = e.tenant_id
FROM employees e
WHERE ep.employee_id = e.id AND ep.tenant_id IS NULL;

UPDATE employee_publications epub
SET tenant_id = e.tenant_id
FROM employees e
WHERE epub.employee_id = e.id AND epub.tenant_id IS NULL;

UPDATE employee_skills es
SET tenant_id = e.tenant_id
FROM employees e
WHERE es.employee_id = e.id AND es.tenant_id IS NULL;

UPDATE employee_work_experiences ewe
SET tenant_id = e.tenant_id
FROM employees e
WHERE ewe.employee_id = e.id AND ewe.tenant_id IS NULL;

-- Step 3: Add foreign key constraints
ALTER TABLE employee_additional_info
ADD CONSTRAINT fk_employee_additional_info_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_awards
ADD CONSTRAINT fk_employee_awards_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_certifications
ADD CONSTRAINT fk_employee_certifications_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_domain_knowledge
ADD CONSTRAINT fk_employee_domain_knowledge_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_education
ADD CONSTRAINT fk_employee_education_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_languages
ADD CONSTRAINT fk_employee_languages_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_projects
ADD CONSTRAINT fk_employee_projects_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE employee_publications
ADD CONSTRAINT fk_employee_publications_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- employee_skills constraint already added in fix_existing_uuid_tenant_id.sql

ALTER TABLE employee_work_experiences
ADD CONSTRAINT fk_employee_work_experiences_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Verification: Check for any NULL tenant_id values
DO $$
DECLARE
  null_count INTEGER;
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'employee_additional_info',
    'employee_awards',
    'employee_certifications',
    'employee_domain_knowledge',
    'employee_education',
    'employee_languages',
    'employee_projects',
    'employee_publications',
    'employee_skills',
    'employee_work_experiences'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE tenant_id IS NULL', table_name) INTO null_count;
    IF null_count > 0 THEN
      RAISE WARNING 'Table % has % records with NULL tenant_id', table_name, null_count;
    ELSE
      RAISE NOTICE 'Table %: All records have tenant_id (OK)', table_name;
    END IF;
  END LOOP;
END $$;
