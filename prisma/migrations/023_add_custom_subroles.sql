-- Migration 023: Add Custom Sub-Roles Support
-- Date: 3 October 2025, 15:30
-- Purpose: Allow tenant-specific custom sub-roles with AI parent role assignment

-- Step 1: Add tenant_id column (nullable for backward compatibility)
ALTER TABLE railway.public.sub_roles
ADD COLUMN tenant_id VARCHAR(255) DEFAULT NULL;

-- Step 2: Add index for fast tenant filtering
CREATE INDEX idx_sub_roles_tenant_id ON railway.public.sub_roles(tenant_id);

-- Step 3: Add is_custom flag (to distinguish custom vs global)
ALTER TABLE railway.public.sub_roles
ADD COLUMN is_custom BOOLEAN DEFAULT FALSE;

-- Step 4: Add created_by column (user who created it)
ALTER TABLE railway.public.sub_roles
ADD COLUMN created_by VARCHAR(255) DEFAULT NULL;

-- Step 5: Add created_at column
ALTER TABLE railway.public.sub_roles
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 6: Update existing records (global sub-roles)
UPDATE railway.public.sub_roles
SET is_custom = FALSE
WHERE tenant_id IS NULL;

-- Step 7: Add constraint (custom sub-roles must have tenant_id)
ALTER TABLE railway.public.sub_roles
ADD CONSTRAINT check_custom_subroles
CHECK (
  (is_custom = FALSE AND tenant_id IS NULL) OR
  (is_custom = TRUE AND tenant_id IS NOT NULL)
);

-- Step 8: Create unique constraint for custom sub-roles per tenant
CREATE UNIQUE INDEX idx_unique_subrole_per_tenant
ON railway.public.sub_roles(tenant_id, "Sub_Role")
WHERE tenant_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN railway.public.sub_roles.tenant_id IS 'Tenant ID for custom sub-roles (NULL for global)';
COMMENT ON COLUMN railway.public.sub_roles.is_custom IS 'TRUE if custom sub-role, FALSE if global';
COMMENT ON COLUMN railway.public.sub_roles.created_by IS 'User email/ID who created the custom sub-role';
COMMENT ON COLUMN railway.public.sub_roles.created_at IS 'Timestamp when custom sub-role was created';

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 023 completed successfully';
  RAISE NOTICE 'Global sub-roles: %', (SELECT COUNT(*) FROM railway.public.sub_roles WHERE is_custom = FALSE);
  RAISE NOTICE 'Custom sub-roles: %', (SELECT COUNT(*) FROM railway.public.sub_roles WHERE is_custom = TRUE);
END $$;
