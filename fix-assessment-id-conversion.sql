-- Fix per gestire la conversione automatica degli ID da string a integer
-- Questo script crea delle funzioni e trigger che gestiscono automaticamente la conversione

-- Crea una funzione che converte automaticamente gli ID string in integer
CREATE OR REPLACE FUNCTION cast_id_to_int(id_value text)
RETURNS integer AS $$
BEGIN
    -- Tenta di convertire l'ID in integer
    -- Se fallisce, ritorna NULL
    BEGIN
        RETURN id_value::integer;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Crea delle viste che gestiscono la conversione automatica
-- Non possiamo creare viste con lo stesso nome delle tabelle, quindi useremo un approccio diverso

-- Aggiungiamo una colonna computed che accetta string ID
ALTER TABLE assessment_templates
  ADD COLUMN IF NOT EXISTS id_string text GENERATED ALWAYS AS (id::text) STORED;

ALTER TABLE assessment_questions
  ADD COLUMN IF NOT EXISTS id_string text GENERATED ALWAYS AS (id::text) STORED,
  ADD COLUMN IF NOT EXISTS template_id_string text GENERATED ALWAYS AS ("templateId"::text) STORED;

ALTER TABLE assessment_options
  ADD COLUMN IF NOT EXISTS id_string text GENERATED ALWAYS AS (id::text) STORED,
  ADD COLUMN IF NOT EXISTS question_id_string text GENERATED ALWAYS AS ("questionId"::text) STORED;

-- Crea degli indici sulle colonne string per performance
CREATE INDEX IF NOT EXISTS idx_assessment_templates_id_string ON assessment_templates(id_string);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_id_string ON assessment_questions(id_string);
CREATE INDEX IF NOT EXISTS idx_assessment_options_id_string ON assessment_options(id_string);

-- Info per verificare
SELECT 'Assessment ID conversion fix applied' AS status;