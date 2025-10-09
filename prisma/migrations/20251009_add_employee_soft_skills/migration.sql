-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_soft_skills" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "soft_skill_id" INTEGER NOT NULL,
    "sub_role_id" INTEGER NOT NULL,
    "importance" INTEGER,
    "source" VARCHAR(50) DEFAULT 'auto_from_role',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" VARCHAR(255) NOT NULL,

    CONSTRAINT "employee_soft_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unique_employee_soft_skill_role" ON "employee_soft_skills"("employee_id", "soft_skill_id", "sub_role_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_employee" ON "employee_soft_skills"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_soft_skill" ON "employee_soft_skills"("soft_skill_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_sub_role" ON "employee_soft_skills"("sub_role_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_tenant_employee" ON "employee_soft_skills"("tenant_id", "employee_id");

-- AddForeignKey
ALTER TABLE "employee_soft_skills" ADD CONSTRAINT "fk_employee_soft_skills_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_soft_skills" ADD CONSTRAINT "fk_employee_soft_skills_soft_skill" FOREIGN KEY ("soft_skill_id") REFERENCES "soft_skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_soft_skills" ADD CONSTRAINT "fk_employee_soft_skills_sub_role" FOREIGN KEY ("sub_role_id") REFERENCES "sub_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_soft_skills" ADD CONSTRAINT "fk_employee_soft_skills_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
