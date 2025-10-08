-- Migration 031: Add file_content, extracted_text, llm_cost to cv_extractions
-- Date: 6 October 2025, 15:30
-- Purpose: Store CV binary file, extracted text, and LLM cost for admin tracking

BEGIN;

-- Add file_content column (BYTEA for binary PDF storage)
ALTER TABLE railway.public.cv_extractions
ADD COLUMN file_content BYTEA;

-- Add extracted_text column (TEXT for raw extracted text from PDF)
ALTER TABLE railway.public.cv_extractions
ADD COLUMN extracted_text TEXT;

-- Add llm_cost column (DECIMAL for cost tracking per extraction)
ALTER TABLE railway.public.cv_extractions
ADD COLUMN llm_cost DECIMAL(10, 6);

-- Add comment for documentation
COMMENT ON COLUMN railway.public.cv_extractions.file_content IS 'Binary content of uploaded CV file (PDF/DOCX)';
COMMENT ON COLUMN railway.public.cv_extractions.extracted_text IS 'Raw text extracted from CV file before LLM processing';
COMMENT ON COLUMN railway.public.cv_extractions.llm_cost IS 'Estimated cost in USD for LLM extraction (for admin cost tracking per tenant)';

COMMIT;
