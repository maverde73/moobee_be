-- ====================================================
-- MIGRATION STEP 1: BACKUP TABLES
-- Date: 2025-09-25 23:30
-- Purpose: Backup campaign_assignments tables before migration
-- ====================================================

-- Create timestamp for backup
DO $$
DECLARE
    backup_timestamp TEXT := TO_CHAR(NOW(), 'YYYYMMDD_HH24MI');
BEGIN
    RAISE NOTICE 'Creating backup with timestamp: %', backup_timestamp;
END $$;

-- Backup engagement_campaign_assignments
CREATE TABLE IF NOT EXISTS engagement_campaign_assignments_backup_20250925 AS
SELECT * FROM engagement_campaign_assignments;

-- Backup assessment_campaign_assignments
CREATE TABLE IF NOT EXISTS assessment_campaign_assignments_backup_20250925 AS
SELECT * FROM assessment_campaign_assignments;

-- Backup assessment_results (uses employee_id)
CREATE TABLE IF NOT EXISTS assessment_results_backup_20250925 AS
SELECT * FROM assessment_results;

-- Verify backups
SELECT
    'engagement_campaign_assignments_backup' as backup_table,
    COUNT(*) as record_count,
    NOW() as backup_time
FROM engagement_campaign_assignments_backup_20250925
UNION ALL
SELECT
    'assessment_campaign_assignments_backup' as backup_table,
    COUNT(*) as record_count,
    NOW() as backup_time
FROM assessment_campaign_assignments_backup_20250925
UNION ALL
SELECT
    'assessment_results_backup' as backup_table,
    COUNT(*) as record_count,
    NOW() as backup_time
FROM assessment_results_backup_20250925;

-- Create index on backup tables for faster recovery if needed
CREATE INDEX idx_engagement_backup_id ON engagement_campaign_assignments_backup_20250925(id);
CREATE INDEX idx_assessment_backup_id ON assessment_campaign_assignments_backup_20250925(id);
CREATE INDEX idx_results_backup_id ON assessment_results_backup_20250925(id);