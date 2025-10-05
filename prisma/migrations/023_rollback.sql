-- Rollback Migration 023: Remove Custom Sub-Roles Support
-- Date: 3 October 2025, 15:30

-- Remove constraints and indexes
ALTER TABLE railway.public.sub_roles DROP CONSTRAINT IF EXISTS check_custom_subroles;
DROP INDEX IF EXISTS railway.public.idx_unique_subrole_per_tenant;
DROP INDEX IF EXISTS railway.public.idx_sub_roles_tenant_id;

-- Remove columns
ALTER TABLE railway.public.sub_roles DROP COLUMN IF EXISTS created_at;
ALTER TABLE railway.public.sub_roles DROP COLUMN IF EXISTS created_by;
ALTER TABLE railway.public.sub_roles DROP COLUMN IF EXISTS is_custom;
ALTER TABLE railway.public.sub_roles DROP COLUMN IF EXISTS tenant_id;

-- Verify rollback
DO $$
BEGIN
  RAISE NOTICE 'Migration 023 rollback completed successfully';
END $$;
