-- Migration: Add seniority field to employee_roles
-- Date: 2025-10-07
-- Purpose: Store seniority level from CV extraction (Junior, Mid, Senior, Lead, etc.)

-- Add seniority column to employee_roles
ALTER TABLE employee_roles
ADD COLUMN IF NOT EXISTS seniority VARCHAR(50);

-- Add comment to document the field
COMMENT ON COLUMN employee_roles.seniority IS 'Seniority level extracted from CV (e.g., Junior, Mid, Senior, Lead, Principal)';

-- Create index for faster queries by seniority
CREATE INDEX IF NOT EXISTS idx_employee_roles_seniority ON employee_roles(seniority);
