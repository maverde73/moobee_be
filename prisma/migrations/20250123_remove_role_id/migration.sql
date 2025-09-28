-- DropForeignKey (se esiste)
ALTER TABLE "engagement_templates" DROP CONSTRAINT IF EXISTS "engagement_templates_role_id_fkey";

-- DropIndex (se esiste)
DROP INDEX IF EXISTS "engagement_templates_role_id_idx";

-- DropColumn
ALTER TABLE "engagement_templates" DROP COLUMN IF EXISTS "role_id";