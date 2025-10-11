-- Migration 041: Remove file_content column from cv_extractions
-- Date: 2025-10-10
-- Purpose: Complete migration to volume storage - remove BYTEA column

-- Remove file_content column (no longer needed - files stored on volume)
ALTER TABLE cv_extractions DROP COLUMN IF EXISTS file_content;

-- Comment
COMMENT ON TABLE cv_extractions IS 'CV extraction metadata - files now stored on volume (see cv_files table)';
