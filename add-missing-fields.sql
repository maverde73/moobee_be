-- Aggiungi campi mancanti ad assessment_templates
ALTER TABLE assessment_templates
ADD COLUMN IF NOT EXISTS "aiPrompt" TEXT,
ADD COLUMN IF NOT EXISTS "instructions" TEXT,
ADD COLUMN IF NOT EXISTS "suggestedFrequency" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "aiModel" VARCHAR(255) DEFAULT 'gpt-4-turbo',
ADD COLUMN IF NOT EXISTS "aiTemperature" DECIMAL(3,2) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS "aiMaxTokens" INTEGER DEFAULT 4000,
ADD COLUMN IF NOT EXISTS "aiLanguage" VARCHAR(10) DEFAULT 'it';

-- Aggiungi campo isRequired ad assessment_questions
ALTER TABLE assessment_questions
ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN DEFAULT true;

-- Verifica le colonne aggiunte
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assessment_templates'
AND column_name IN ('aiPrompt', 'instructions', 'suggestedFrequency', 'aiModel', 'aiTemperature', 'aiMaxTokens', 'aiLanguage');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assessment_questions'
AND column_name = 'isRequired';