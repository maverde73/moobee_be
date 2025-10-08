-- Migration 032 Rollback: Remove employee_roles indexes
-- Date: 6 October 2025, 23:58

-- Drop indexes
DROP INDEX IF EXISTS railway.public.idx_employee_roles_sub_role_id;
DROP INDEX IF EXISTS railway.public.idx_employee_roles_employee_subrole;
DROP INDEX IF EXISTS railway.public.idx_employee_roles_role_id;

-- Verify indexes removed
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'employee_roles'
  AND schemaname = 'public'
ORDER BY indexname;
