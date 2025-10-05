-- Migration 026: Remove obsolete fields from assessment_templates
-- Date: 4 October 2025, 13:00
-- Purpose: Remove deprecated fields and prepare for job_family integration

BEGIN;

-- Drop obsolete columns from assessment_templates
ALTER TABLE railway.public.assessment_templates
  DROP COLUMN IF EXISTS "suggestedRoles",
  DROP COLUMN IF EXISTS "targetSoftSkillIds",
  DROP COLUMN IF EXISTS "aiModelUsed";

-- Verify job_family_id column exists (should already exist from previous schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'assessment_templates'
    AND column_name = 'job_family_id'
  ) THEN
    ALTER TABLE railway.public.assessment_templates
      ADD COLUMN job_family_id INT;

    -- Add foreign key constraint
    ALTER TABLE railway.public.assessment_templates
      ADD CONSTRAINT fk_assessment_job_family
      FOREIGN KEY (job_family_id)
      REFERENCES railway.public.job_family(id)
      ON DELETE SET NULL;

    -- Add index
    CREATE INDEX IF NOT EXISTS idx_assessment_templates_job_family
      ON railway.public.assessment_templates(job_family_id);
  END IF;
END $$;

COMMIT;

-- Verification queries
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assessment_templates'
  AND column_name IN ('job_family_id', 'suggestedRoles', 'targetSoftSkillIds', 'aiModelUsed')
ORDER BY column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 026 completed successfully';
  RAISE NOTICE 'Removed fields: suggestedRoles, targetSoftSkillIds, aiModelUsed';
  RAISE NOTICE 'Verified field: job_family_id (with FK and index)';
END $$;
