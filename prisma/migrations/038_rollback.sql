-- Rollback Migration 038: Restore original cv_extractions status CHECK constraint
-- Date: 2025-10-09, 22:30

-- Drop current CHECK constraint
ALTER TABLE cv_extractions
DROP CONSTRAINT IF EXISTS check_cv_extractions_status;

-- Restore original CHECK constraint with only old values
ALTER TABLE cv_extractions
ADD CONSTRAINT check_cv_extractions_status
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
