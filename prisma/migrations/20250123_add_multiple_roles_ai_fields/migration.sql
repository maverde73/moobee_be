-- AlterTable
ALTER TABLE "engagement_templates" ADD COLUMN IF NOT EXISTS "suggested_roles" JSONB;
ALTER TABLE "engagement_templates" ADD COLUMN IF NOT EXISTS "ai_prompt" TEXT;
ALTER TABLE "engagement_templates" ADD COLUMN IF NOT EXISTS "ai_provider" TEXT;
ALTER TABLE "engagement_templates" ADD COLUMN IF NOT EXISTS "ai_model" TEXT;