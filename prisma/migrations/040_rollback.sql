-- Rollback migration 040: Drop cv_files table
-- Date: 2025-10-10

DROP TABLE IF EXISTS cv_files CASCADE;
