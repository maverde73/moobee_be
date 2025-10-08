-- Migration 031 Rollback: Remove file_content, extracted_text, llm_cost
-- Date: 6 October 2025, 15:30

BEGIN;

ALTER TABLE railway.public.cv_extractions
DROP COLUMN IF EXISTS file_content;

ALTER TABLE railway.public.cv_extractions
DROP COLUMN IF EXISTS extracted_text;

ALTER TABLE railway.public.cv_extractions
DROP COLUMN IF EXISTS llm_cost;

COMMIT;
