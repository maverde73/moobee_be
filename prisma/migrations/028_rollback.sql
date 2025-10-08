-- Migration 028 Rollback
-- Data: 6 Ottobre 2025, 15:40

BEGIN;

-- Drop index
DROP INDEX IF EXISTS railway.public.idx_employee_skills_cv_extraction;

-- Drop foreign key constraint
ALTER TABLE railway.public.employee_skills
DROP CONSTRAINT IF EXISTS fk_employee_skills_cv_extraction;

-- Drop column
ALTER TABLE railway.public.employee_skills
DROP COLUMN IF EXISTS cv_extraction_id;

COMMIT;
