-- =====================================================
-- Migration: Remove duplicate first_name and last_name from tenant_users
-- =====================================================
-- These fields are now managed in the employees table only
-- All queries have been updated to use JOIN with employees table
-- =====================================================

-- Drop the duplicate columns from tenant_users
ALTER TABLE "tenant_users"
  DROP COLUMN IF EXISTS "first_name",
  DROP COLUMN IF EXISTS "last_name";

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After this migration:
-- 1. first_name and last_name are ONLY in employees table
-- 2. All services use JOIN to get name information
-- 3. Single source of truth is established
-- =====================================================