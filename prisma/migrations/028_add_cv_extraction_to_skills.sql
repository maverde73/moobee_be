-- Migration 028: Add cv_extraction_id to employee_skills
-- Data: 6 Ottobre 2025, 15:40
-- Purpose: Enable tracking which skills were extracted from which CV
-- Author: Claude Code AI Assistant

BEGIN;

-- Add cv_extraction_id column (nullable)
ALTER TABLE railway.public.employee_skills
ADD COLUMN cv_extraction_id UUID;

-- Add foreign key constraint
ALTER TABLE railway.public.employee_skills
ADD CONSTRAINT fk_employee_skills_cv_extraction
FOREIGN KEY (cv_extraction_id)
REFERENCES railway.public.cv_extractions(id)
ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_employee_skills_cv_extraction
ON railway.public.employee_skills(cv_extraction_id);

-- Add comment
COMMENT ON COLUMN railway.public.employee_skills.cv_extraction_id IS 'Link to CV extraction that added this skill';

COMMIT;

-- Verification query
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'employee_skills'
--   AND column_name = 'cv_extraction_id';
