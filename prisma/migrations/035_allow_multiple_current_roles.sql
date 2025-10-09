-- Migration 035: Allow Multiple Current Roles per Employee
-- Date: 2025-10-09
-- Remove unique constraint on employee_id that prevents multiple roles
-- Allow multiple is_current = true roles for the same employee

-- ============================================================================
-- STEP 1: Drop the unique constraint that enforces single role per employee
-- ============================================================================

-- Check if the unique constraint/index exists and drop it
DO $$
BEGIN
    -- Drop the unique index from migration 014 if it exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'employee_roles'
        AND indexname = 'idx_employee_roles_unique'
    ) THEN
        DROP INDEX public.idx_employee_roles_unique;
        RAISE NOTICE '✅ Dropped idx_employee_roles_unique index';
    END IF;

    -- Drop the partial unique index that prevents multiple current roles
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'employee_roles'
        AND indexname = 'idx_employee_roles_one_current'
    ) THEN
        DROP INDEX public.idx_employee_roles_one_current;
        RAISE NOTICE '✅ Dropped idx_employee_roles_one_current index (partial unique on is_current)';
    END IF;

    -- Drop any other unique constraint on employee_id alone if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname LIKE '%employee_roles%employee_id%'
        AND contype = 'u'
    ) THEN
        EXECUTE 'ALTER TABLE public.employee_roles DROP CONSTRAINT ' ||
                (SELECT conname FROM pg_constraint
                 WHERE conrelid = 'public.employee_roles'::regclass
                 AND contype = 'u'
                 AND conname LIKE '%employee_id%'
                 LIMIT 1);
        RAISE NOTICE '✅ Dropped unique constraint on employee_id';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Re-create a proper unique constraint
-- ============================================================================

-- Keep unique constraint on (employee_id, role_id, sub_role_id) to prevent
-- duplicate role assignments, but allow multiple different roles per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_roles_combo_unique
  ON public.employee_roles(employee_id, role_id, COALESCE(sub_role_id, 0));

-- ============================================================================
-- STEP 3: Add check constraint (optional - removed to allow flexibility)
-- ============================================================================

-- Note: We DO NOT add a constraint to enforce single is_current = true
-- This allows employees to have multiple current roles simultaneously

-- ============================================================================
-- LOGGING
-- ============================================================================

DO $$
DECLARE
  role_count INT;
  multi_current_count INT;
BEGIN
  -- Count total roles
  SELECT COUNT(*) INTO role_count FROM public.employee_roles;

  -- Count employees with multiple current roles (after changes)
  SELECT COUNT(DISTINCT employee_id) INTO multi_current_count
  FROM public.employee_roles
  WHERE is_current = true
  GROUP BY employee_id
  HAVING COUNT(*) > 1;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 035 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 Total roles: %', role_count;
  RAISE NOTICE '👥 Employees with multiple current roles: %', COALESCE(multi_current_count, 0);
  RAISE NOTICE '✨ Changes:';
  RAISE NOTICE '   - Removed single-role-per-employee constraint';
  RAISE NOTICE '   - Employees can now have multiple current roles';
  RAISE NOTICE '   - Kept constraint on (employee_id, role_id, sub_role_id)';
  RAISE NOTICE '========================================';
END $$;
