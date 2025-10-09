-- Rollback migration 037
-- Remove fields added for CV import notification polling

ALTER TABLE cv_extractions DROP COLUMN IF EXISTS import_stats;
ALTER TABLE cv_extractions DROP COLUMN IF EXISTS error_phase;

-- Revert status comment
COMMENT ON COLUMN cv_extractions.status IS NULL;
