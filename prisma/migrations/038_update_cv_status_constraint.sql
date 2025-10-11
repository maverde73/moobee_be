-- Migration 038: Update cv_extractions status CHECK constraint
-- Date: 2025-10-09, 22:30
-- Purpose: Add 'extracted' and 'importing' status values to CHECK constraint

-- Drop existing CHECK constraint
ALTER TABLE cv_extractions
DROP CONSTRAINT IF EXISTS check_cv_extractions_status;

-- Add new CHECK constraint with all status values including 'extracted' and 'importing'
ALTER TABLE cv_extractions
ADD CONSTRAINT check_cv_extractions_status
CHECK (status IN ('pending', 'processing', 'extracted', 'importing', 'completed', 'failed'));

-- Update comment
COMMENT ON CONSTRAINT check_cv_extractions_status ON cv_extractions IS
'Valid status values: pending, processing, extracted, importing, completed, failed';
