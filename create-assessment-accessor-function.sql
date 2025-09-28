-- Crea una funzione che gestisce automaticamente la conversione degli ID
-- Questa è l'unica soluzione possibile senza modificare il backend

-- Funzione per ottenere un assessment template con ID come text
CREATE OR REPLACE FUNCTION get_assessment_template_by_string_id(p_id text)
RETURNS TABLE (
  id integer,
  name text,
  type text,
  description text,
  "isActive" boolean,
  "createdBy" text,
  "targetRoles" text[],
  duration integer,
  "aiProvider" text,
  "aiModel" text,
  "aiTemperature" double precision,
  "aiMaxTokens" integer,
  "aiSystemPrompt" text,
  "aiCustomInstructions" text,
  "aiLanguage" text,
  "isGlobal" boolean,
  status text,
  version text,
  "scoringAlgorithm" text,
  "passingScore" numeric,
  "generationStatus" text,
  "generationMetadata" jsonb,
  "customPrompt" text,
  "suggestedRoles" text[],
  "softSkillsEnabled" boolean,
  "targetSoftSkillIds" integer[],
  "generationLogId" integer,
  category text,
  "orderIndex" integer,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    at.*
  FROM assessment_templates at
  WHERE at.id = p_id::integer;
END;
$$ LANGUAGE plpgsql;

-- Crea una view che può essere utilizzata con string IDs
CREATE OR REPLACE VIEW v_assessment_templates_string_id AS
SELECT
  id::text as id_string,
  *
FROM assessment_templates;

-- Permetti SELECT sulla view
GRANT SELECT ON v_assessment_templates_string_id TO PUBLIC;

-- Info
SELECT 'Assessment string ID accessor functions created' AS status;