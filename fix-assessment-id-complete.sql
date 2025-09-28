-- Script completo per cambiare i tipi di ID da INT a VARCHAR
-- per risolvere il problema di conversione

BEGIN;

-- 1. Prima elimina tutte le foreign key
ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_templateid_fkey;
ALTER TABLE assessment_options DROP CONSTRAINT IF EXISTS assessment_options_questionid_fkey;
ALTER TABLE assessment_template_roles DROP CONSTRAINT IF EXISTS assessment_template_roles_templateid_fkey;
ALTER TABLE tenant_assessment_selections DROP CONSTRAINT IF EXISTS tenant_assessment_selections_templateid_fkey;
ALTER TABLE assessment_generation_logs DROP CONSTRAINT IF EXISTS assessment_generation_logs_templateid_fkey;
ALTER TABLE question_soft_skill_mappings DROP CONSTRAINT IF EXISTS question_soft_skill_mappings_questionid_fkey;
ALTER TABLE template_soft_skill_mappings DROP CONSTRAINT IF EXISTS template_soft_skill_mappings_templateid_fkey;

-- 2. Cambia i tipi di colonna per assessment_generation_logs prima delle altre tabelle
ALTER TABLE assessment_generation_logs ALTER COLUMN "templateId" TYPE VARCHAR(50) USING "templateId"::text;

-- 3. Ora cambia i tipi nelle tabelle principali
ALTER TABLE assessment_templates ALTER COLUMN id TYPE VARCHAR(50) USING id::text;
ALTER TABLE assessment_questions ALTER COLUMN id TYPE VARCHAR(50) USING id::text;
ALTER TABLE assessment_questions ALTER COLUMN "templateId" TYPE VARCHAR(50) USING "templateId"::text;
ALTER TABLE assessment_options ALTER COLUMN id TYPE VARCHAR(50) USING id::text;
ALTER TABLE assessment_options ALTER COLUMN "questionId" TYPE VARCHAR(50) USING "questionId"::text;

-- 4. Cambia i tipi nelle tabelle correlate
ALTER TABLE assessment_template_roles ALTER COLUMN "templateId" TYPE VARCHAR(50) USING "templateId"::text;
ALTER TABLE tenant_assessment_selections ALTER COLUMN "templateId" TYPE VARCHAR(50) USING "templateId"::text;
ALTER TABLE question_soft_skill_mappings ALTER COLUMN "questionId" TYPE VARCHAR(50) USING "questionId"::text;
ALTER TABLE template_soft_skill_mappings ALTER COLUMN "templateId" TYPE VARCHAR(50) USING "templateId"::text;

-- 5. Ricrea tutte le foreign key
ALTER TABLE assessment_questions
  ADD CONSTRAINT assessment_questions_templateid_fkey
  FOREIGN KEY ("templateId") REFERENCES assessment_templates(id) ON DELETE CASCADE;

ALTER TABLE assessment_options
  ADD CONSTRAINT assessment_options_questionid_fkey
  FOREIGN KEY ("questionId") REFERENCES assessment_questions(id) ON DELETE CASCADE;

ALTER TABLE assessment_template_roles
  ADD CONSTRAINT assessment_template_roles_templateid_fkey
  FOREIGN KEY ("templateId") REFERENCES assessment_templates(id) ON DELETE CASCADE;

ALTER TABLE tenant_assessment_selections
  ADD CONSTRAINT tenant_assessment_selections_templateid_fkey
  FOREIGN KEY ("templateId") REFERENCES assessment_templates(id) ON DELETE CASCADE;

ALTER TABLE assessment_generation_logs
  ADD CONSTRAINT assessment_generation_logs_templateid_fkey
  FOREIGN KEY ("templateId") REFERENCES assessment_templates(id) ON DELETE SET NULL;

ALTER TABLE question_soft_skill_mappings
  ADD CONSTRAINT question_soft_skill_mappings_questionid_fkey
  FOREIGN KEY ("questionId") REFERENCES assessment_questions(id) ON DELETE CASCADE;

ALTER TABLE template_soft_skill_mappings
  ADD CONSTRAINT template_soft_skill_mappings_templateid_fkey
  FOREIGN KEY ("templateId") REFERENCES assessment_templates(id) ON DELETE CASCADE;

COMMIT;

-- Verifica i cambiamenti
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('assessment_templates', 'assessment_questions', 'assessment_options', 'assessment_generation_logs')
  AND column_name IN ('id', 'templateId', 'questionId')
ORDER BY table_name, column_name;