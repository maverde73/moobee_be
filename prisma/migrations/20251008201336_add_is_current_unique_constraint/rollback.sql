-- Rollback Migration: Add is_current unique constraint
-- Description: Remove triggers, unique constraint, and is_current column
-- Created: 2025-10-08

-- Drop triggers
DROP TRIGGER IF EXISTS trg_prevent_delete_last_current ON employee_roles;
DROP TRIGGER IF EXISTS trg_ensure_single_role_current ON employee_roles;

-- Drop functions
DROP FUNCTION IF EXISTS prevent_delete_last_current_role();
DROP FUNCTION IF EXISTS ensure_single_role_is_current();

-- Drop unique index
DROP INDEX IF EXISTS idx_employee_roles_one_current;

-- Drop is_current column
ALTER TABLE employee_roles
DROP COLUMN IF EXISTS is_current;
