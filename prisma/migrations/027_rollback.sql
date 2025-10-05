-- Migration 027 Rollback: Restore original table names
-- Date: 2025-10-05 01:00

BEGIN;

-- 1. Rename assessment_template_soft_skill back to template_soft_skill_mappings
ALTER TABLE IF EXISTS railway.public.assessment_template_soft_skill
  RENAME TO template_soft_skill_mappings;

-- 2. Rename indexes back
ALTER INDEX IF EXISTS assessment_template_soft_skill_pkey
  RENAME TO template_soft_skill_mappings_pkey;

ALTER INDEX IF EXISTS assessment_template_soft_skill_templateId_idx
  RENAME TO template_soft_skill_mappings_templateId_idx;

ALTER INDEX IF EXISTS assessment_template_soft_skill_softSkillId_idx
  RENAME TO template_soft_skill_mappings_softSkillId_idx;

-- 3. Recreate assessment_template_roles table
CREATE TABLE IF NOT EXISTS railway.public.assessment_template_roles (
  id SERIAL PRIMARY KEY,
  templateId INT NOT NULL,
  roleId INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (templateId) REFERENCES railway.public.assessment_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (roleId) REFERENCES railway.public.roles(id) ON DELETE CASCADE
);

COMMIT;
