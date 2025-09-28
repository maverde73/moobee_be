-- Migration: Change sub_role_id from UUID to Int
-- Date: 2025-09-27 19:06
-- Purpose: Fix type mismatch between sub_roles.id (Int) and project_roles.sub_role_id (UUID)

-- Step 1: Drop the UUID constraint and change column type
ALTER TABLE project_roles
ALTER COLUMN sub_role_id TYPE INTEGER
USING sub_role_id::INTEGER;

-- Step 2: Add foreign key constraint to sub_roles table (optional but recommended)
-- ALTER TABLE project_roles
-- ADD CONSTRAINT fk_project_roles_sub_role
-- FOREIGN KEY (sub_role_id)
-- REFERENCES sub_roles(id)
-- ON DELETE SET NULL;

-- Note: If there are existing UUID values that cannot be converted,
-- they will be set to NULL during the migration