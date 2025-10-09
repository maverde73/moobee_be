-- Migration 036: Drop single current role constraint to allow multiple current roles
-- Date: 2025-10-09
-- Issue: Employee should be able to have multiple current roles simultaneously

-- Drop the partial unique index that enforces single is_current=true per employee
DROP INDEX IF EXISTS idx_employee_roles_one_current;

-- Note: This allows employees to have multiple roles with is_current=true
-- The frontend and business logic will manage which roles are considered "current"
