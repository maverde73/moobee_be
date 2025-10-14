-- Migration 045 Rollback: Remove retry_count from cv_extractions
-- Date: 14 October 2025, 17:30

DROP INDEX IF EXISTS idx_cv_extractions_status_retry;

ALTER TABLE cv_extractions
DROP COLUMN IF EXISTS retry_count;
