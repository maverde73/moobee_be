-- Rollback Migration 026: Restore obsolete fields (NOT RECOMMENDED)
-- Date: 4 October 2025, 13:00
-- WARNING: This will restore deprecated fields that should not be used

BEGIN;

-- Restore obsolete columns to assessment_templates
ALTER TABLE railway.public.assessment_templates
  ADD COLUMN IF NOT EXISTS "suggestedRoles" TEXT[],
  ADD COLUMN IF NOT EXISTS "targetSoftSkillIds" INT[],
  ADD COLUMN IF NOT EXISTS "aiModelUsed" VARCHAR(255);

COMMIT;

-- Warning message
DO $$
BEGIN
  RAISE WARNING '⚠️  Rollback 026 completed - Restored obsolete fields';
  RAISE WARNING 'These fields are DEPRECATED and should not be used';
  RAISE WARNING 'Use job_family_id and template_soft_skill_mappings instead';
END $$;
