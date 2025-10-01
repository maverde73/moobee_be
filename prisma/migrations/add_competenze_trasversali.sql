-- Add competenze_trasversali JSONB field to employees table
-- Created: 2025-09-28 22:15

ALTER TABLE railway.public.employees
ADD COLUMN IF NOT EXISTS competenze_trasversali JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN railway.public.employees.competenze_trasversali IS 'Array of soft skills/transversal competencies as JSONB';