-- Rollback Migration 035: Restore Single Role per Employee Constraint
-- Date: 2025-10-09

-- ============================================================================
-- STEP 1: Remove the new unique index
-- ============================================================================

DROP INDEX IF EXISTS public.idx_employee_roles_combo_unique;

-- ============================================================================
-- STEP 2: Re-create the original unique constraint from migration 014
-- ============================================================================

-- First, remove any duplicate roles (keep the most recent one)
DELETE FROM public.employee_roles
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY employee_id, role_id, sub_role_id
      ORDER BY created_at DESC
    ) as rn
    FROM public.employee_roles
  ) t
  WHERE rn > 1
);

-- If multiple roles with is_current = true exist, keep only the most recent one
UPDATE public.employee_roles
SET is_current = false
WHERE id NOT IN (
  SELECT MAX(id) FROM public.employee_roles
  WHERE is_current = true
  GROUP BY employee_id
);

-- Re-create the original unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_roles_unique
  ON public.employee_roles(employee_id, role_id, COALESCE(sub_role_id, 0));

-- Re-create the partial unique index that enforces single current role
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_roles_one_current
  ON public.employee_roles(employee_id) WHERE (is_current = true);

-- ============================================================================
-- LOGGING
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 035 rollback completed';
  RAISE NOTICE '🔄 Restored single-role-per-employee constraint';
END $$;
