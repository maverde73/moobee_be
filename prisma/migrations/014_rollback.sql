-- Rollback Migration 014: Restore Employee Roles Previous Structure
-- Date: 2025-10-02
-- Use this script ONLY if migration 014 needs to be reverted

-- ============================================================================
-- STEP 1: Remove unique constraint
-- ============================================================================

DROP INDEX IF EXISTS railway.public.idx_employee_roles_unique;

-- ============================================================================
-- STEP 2: Re-add is_current, start_date, end_date columns
-- ============================================================================

ALTER TABLE railway.public.employee_roles
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- ============================================================================
-- STEP 3: Set default values for existing records
-- ============================================================================

UPDATE railway.public.employee_roles
SET is_current = true
WHERE is_current IS NULL;

-- ============================================================================
-- LOGGING
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '⏪ Rollback 014 completed';
  RAISE NOTICE '⚠️  Restored previous structure';
  RAISE NOTICE '✅ Re-added: is_current, start_date, end_date';
END $$;
