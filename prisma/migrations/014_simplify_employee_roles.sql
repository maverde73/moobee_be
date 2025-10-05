-- Migration 014: Simplify Employee Roles Structure
-- Date: 2025-10-02
-- Remove is_current, start_date, end_date from employee_roles
-- Keep only essential fields: employee_id, role_id, sub_role_id, anni_esperienza

-- ============================================================================
-- STEP 1: Remove is_current, start_date, end_date columns
-- ============================================================================

ALTER TABLE railway.public.employee_roles
DROP COLUMN IF EXISTS is_current,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS end_date;

-- ============================================================================
-- STEP 2: Add unique constraint to prevent duplicate role assignments
-- ============================================================================

-- First, remove any existing duplicates (keep the most recent one)
DELETE FROM railway.public.employee_roles
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY employee_id, role_id, sub_role_id
      ORDER BY created_at DESC
    ) as rn
    FROM railway.public.employee_roles
  ) t
  WHERE rn > 1
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_roles_unique
  ON railway.public.employee_roles(employee_id, role_id, COALESCE(sub_role_id, 0));

-- ============================================================================
-- LOGGING
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 014 completed successfully';
  RAISE NOTICE '📊 Simplified employee_roles structure';
  RAISE NOTICE '🗑️  Removed: is_current, start_date, end_date';
  RAISE NOTICE '✨ Added: unique constraint on (employee_id, role_id, sub_role_id)';
END $$;
