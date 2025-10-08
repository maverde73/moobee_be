-- Migration 030: Seed common languages
-- Data: 6 Ottobre 2025, 15:40
-- Purpose: Populate languages table with most common languages

BEGIN;

-- Insert 15 common languages with ISO codes
INSERT INTO railway.public.languages (name, iso_code_639_1, iso_code_639_3, created_at, updated_at)
VALUES
  ('Italian', 'it', 'ita', NOW(), NOW()),
  ('English', 'en', 'eng', NOW(), NOW()),
  ('Spanish', 'es', 'spa', NOW(), NOW()),
  ('French', 'fr', 'fra', NOW(), NOW()),
  ('German', 'de', 'deu', NOW(), NOW()),
  ('Portuguese', 'pt', 'por', NOW(), NOW()),
  ('Chinese', 'zh', 'zho', NOW(), NOW()),
  ('Japanese', 'ja', 'jpn', NOW(), NOW()),
  ('Russian', 'ru', 'rus', NOW(), NOW()),
  ('Arabic', 'ar', 'ara', NOW(), NOW()),
  ('Hindi', 'hi', 'hin', NOW(), NOW()),
  ('Korean', 'ko', 'kor', NOW(), NOW()),
  ('Dutch', 'nl', 'nld', NOW(), NOW()),
  ('Polish', 'pl', 'pol', NOW(), NOW()),
  ('Turkish', 'tr', 'tur', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON TABLE railway.public.languages IS 'Common languages with ISO codes';

COMMIT;

-- Verification query
-- SELECT name, iso_code_639_1, iso_code_639_3
-- FROM railway.public.languages
-- ORDER BY name;
