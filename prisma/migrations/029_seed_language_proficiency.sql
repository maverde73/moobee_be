-- Migration 029: Seed language proficiency levels
-- Data: 6 Ottobre 2025, 15:40
-- Purpose: Populate language_proficiency_levels table with standard CEFR levels

BEGIN;

-- Insert 6 standard proficiency levels
INSERT INTO railway.public.language_proficiency_levels (level, cefr_code, numeric_value, description, created_at, updated_at)
VALUES
  ('Native', 'C2', 6, 'Native or bilingual proficiency', NOW(), NOW()),
  ('Fluent', 'C1', 5, 'Full professional proficiency', NOW(), NOW()),
  ('Professional', 'B2', 4, 'Professional working proficiency', NOW(), NOW()),
  ('Intermediate', 'B1', 3, 'Limited working proficiency', NOW(), NOW()),
  ('Basic', 'A2', 2, 'Elementary proficiency', NOW(), NOW()),
  ('Beginner', 'A1', 1, 'Basic knowledge', NOW(), NOW())
ON CONFLICT (level) DO NOTHING;

-- Add comments
COMMENT ON TABLE railway.public.language_proficiency_levels IS 'Standard CEFR language proficiency levels';

COMMIT;

-- Verification query
-- SELECT level, cefr_code, numeric_value, description
-- FROM railway.public.language_proficiency_levels
-- ORDER BY numeric_value DESC;
