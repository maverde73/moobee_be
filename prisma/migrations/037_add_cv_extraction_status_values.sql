-- Migration 037: Add new status values and import_stats to cv_extractions
-- Date: 2025-10-09, 17:45
-- Purpose: Enable granular status tracking for CV import notification

-- Update status column comment to document new status flow
COMMENT ON COLUMN cv_extractions.status IS
'Extraction status:
- pending: Upload completed, waiting for Python extraction
- processing: Python is extracting data from CV
- extracted: Python finished extraction, JSON ready
- importing: BE_nodejs is saving data to database tables
- completed: All data saved to database successfully
- failed: Error occurred in any phase';

-- Add import_stats field to store summary of saved data
ALTER TABLE cv_extractions
ADD COLUMN IF NOT EXISTS import_stats JSONB DEFAULT NULL;

COMMENT ON COLUMN cv_extractions.import_stats IS
'Summary of data imported to database tables: {personal_info_updated, education_saved, work_experiences_saved, skills_saved, languages_saved, certifications_saved, roles_saved, import_timestamp}';

-- Add error_phase field for better debugging
ALTER TABLE cv_extractions
ADD COLUMN IF NOT EXISTS error_phase TEXT DEFAULT NULL;

COMMENT ON COLUMN cv_extractions.error_phase IS
'Which phase failed: python_connection, python_extraction, database_save, unknown';
