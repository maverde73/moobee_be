-- Migration 032: Add index on employee_roles.sub_role_id
-- Date: 6 October 2025, 23:58
-- Purpose: Improve query performance for employee role lookups by sub_role

-- Create index on sub_role_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_roles_sub_role_id
ON railway.public.employee_roles(sub_role_id);

-- Create composite index for common queries (employee + sub_role)
CREATE INDEX IF NOT EXISTS idx_employee_roles_employee_subrole
ON railway.public.employee_roles(employee_id, sub_role_id);

-- Add index on role_id for parent role queries
CREATE INDEX IF NOT EXISTS idx_employee_roles_role_id
ON railway.public.employee_roles(role_id)
WHERE role_id IS NOT NULL;

-- Verify indexes created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'employee_roles'
  AND schemaname = 'public'
ORDER BY indexname;
