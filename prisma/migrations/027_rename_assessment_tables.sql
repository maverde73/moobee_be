-- Migration 027: Rename template_soft_skill_mappings and drop assessment_template_roles
-- Date: 2025-10-05 01:00
-- Author: Claude Code
-- Purpose: Standardize table names to assessment_template_* pattern

BEGIN;

-- 1. Rename template_soft_skill_mappings to assessment_template_soft_skill
ALTER TABLE railway.public.template_soft_skill_mappings
  RENAME TO assessment_template_soft_skill;

-- 2. Rename indexes
ALTER INDEX IF EXISTS template_soft_skill_mappings_pkey
  RENAME TO assessment_template_soft_skill_pkey;

ALTER INDEX IF EXISTS template_soft_skill_mappings_templateId_idx
  RENAME TO assessment_template_soft_skill_templateId_idx;

ALTER INDEX IF EXISTS template_soft_skill_mappings_softSkillId_idx
  RENAME TO assessment_template_soft_skill_softSkillId_idx;

-- 3. Drop assessment_template_roles table (no longer needed)
DROP TABLE IF EXISTS railway.public.assessment_template_roles CASCADE;

COMMIT;
