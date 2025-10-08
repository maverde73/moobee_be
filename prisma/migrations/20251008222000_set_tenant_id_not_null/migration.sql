-- Migration 035: Set tenant_id NOT NULL constraint
-- Description: Enforce tenant_id presence in all employee tables
-- Created: 2025-10-08
-- Prerequisites: Migration 033 (columns added) and 034 (triggers installed)

-- Safety check: Verify no NULL tenant_id values exist
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
  RAISE NOTICE 'Checking for NULL tenant_id values...';

  FOREACH table_name IN ARRAY tables
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE tenant_id IS NULL', table_name) INTO null_count;

    IF null_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION BLOCKED: Table % has % records with NULL tenant_id. Run migration 033 backfill first.',
        table_name, null_count;
    ELSE
      RAISE NOTICE 'Table %: 0 NULL values (OK)', table_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'All tables verified: No NULL tenant_id values found';
END $$;

-- Set NOT NULL constraint on all tables
ALTER TABLE employee_additional_info ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_awards ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_certifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_domain_knowledge ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_education ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_languages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_projects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_publications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_skills ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employee_work_experiences ALTER COLUMN tenant_id SET NOT NULL;

-- Verify constraints
SELECT
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_name IN (
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
)
AND column_name = 'tenant_id'
ORDER BY table_name;

DO $$ BEGIN
  RAISE NOTICE 'NOT NULL constraint applied to tenant_id on 10 employee tables';
END $$;
