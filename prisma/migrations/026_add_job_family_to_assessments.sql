-- Migration 026: Add job_family_id to assessment_templates
-- Date: 2025-10-04 01:40
-- Purpose: Link assessments to job families instead of generic roles
-- Author: Claude Code (Moobee Team)

BEGIN;

-- Add job_family_id column (nullable for backward compatibility)
ALTER TABLE assessment_templates
ADD COLUMN job_family_id INT;

-- Add foreign key constraint with ON DELETE SET NULL
ALTER TABLE assessment_templates
ADD CONSTRAINT fk_assessment_job_family
  FOREIGN KEY (job_family_id)
  REFERENCES job_family(id)
  ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_assessment_templates_job_family
ON assessment_templates(job_family_id);

-- Add comment for documentation
COMMENT ON COLUMN assessment_templates.job_family_id IS
  'Link to job_family table. Replaces suggestedRoles array with structured job family.';

COMMIT;
