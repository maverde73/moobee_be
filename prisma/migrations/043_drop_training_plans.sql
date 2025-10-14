-- Migration: 043 - Drop training_plans table
-- Description: Remove unused training_plans table (zombie table, 0 records, no FK, never used in code)
-- Author: System
-- Date: 12 October 2025
-- Reason: Table defined but never implemented - no foreign keys, no code usage, 0 records

-- Drop the table (table is verified empty by run_migration_043.js before execution)
DROP TABLE IF EXISTS training_plans;

-- Verification
-- This should return FALSE (table no longer exists)
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables
--   WHERE table_name = 'training_plans'
-- );
