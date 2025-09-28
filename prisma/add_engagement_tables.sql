-- ========================================
-- ENGAGEMENT SYSTEM - ADD MISSING TABLES
-- Date: 2025-01-23
-- ========================================

-- AlterTable: Add role_id to engagement_templates
ALTER TABLE "engagement_templates" ADD COLUMN "role_id" INTEGER;

-- CreateTable: response_details
CREATE TABLE "response_details" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "value" INTEGER,
    "text_value" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "response_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable: action_plans
CREATE TABLE "action_plans" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_id" INTEGER,
    "area" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "target_metrics" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: response_details indexes
CREATE INDEX "response_details_response_id_idx" ON "response_details"("response_id");
CREATE INDEX "response_details_question_id_idx" ON "response_details"("question_id");
CREATE UNIQUE INDEX "response_details_response_id_question_id_key" ON "response_details"("response_id", "question_id");

-- CreateIndex: action_plans indexes
CREATE INDEX "action_plans_tenant_id_idx" ON "action_plans"("tenant_id");
CREATE INDEX "action_plans_role_id_idx" ON "action_plans"("role_id");
CREATE INDEX "action_plans_area_idx" ON "action_plans"("area");
CREATE INDEX "action_plans_status_idx" ON "action_plans"("status");

-- CreateIndex: engagement_templates role_id index
CREATE INDEX "engagement_templates_role_id_idx" ON "engagement_templates"("role_id");

-- AddForeignKey: engagement_templates to roles
ALTER TABLE "engagement_templates" ADD CONSTRAINT "engagement_templates_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: response_details to engagement_responses
ALTER TABLE "response_details" ADD CONSTRAINT "response_details_response_id_fkey"
    FOREIGN KEY ("response_id") REFERENCES "engagement_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: response_details to engagement_questions
ALTER TABLE "response_details" ADD CONSTRAINT "response_details_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "engagement_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: action_plans to roles
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========================================
-- END OF MIGRATION
-- ========================================