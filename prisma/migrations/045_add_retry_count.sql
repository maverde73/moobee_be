-- Migration 045: Add retry_count to cv_extractions
-- Date: 14 October 2025, 17:30
-- Purpose: Support automatic retry for failed CV imports in background worker
--
-- This field tracks how many times the background worker has attempted to import
-- a CV extraction. After 3 failed attempts, the extraction is marked as 'failed'.

ALTER TABLE cv_extractions
ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- Add comment
COMMENT ON COLUMN cv_extractions.retry_count IS 'Number of import retry attempts by background worker (max 3)';

-- Create index for worker queries
CREATE INDEX idx_cv_extractions_status_retry ON cv_extractions(status, retry_count) WHERE status = 'extracted';
