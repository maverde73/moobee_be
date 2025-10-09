const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('[Migration] Creating employee_soft_skills table...');

    // CreateTable
    await prisma.$executeRawUnsafe(`
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
      )
    `);
    console.log('✅ Table created');

    // CreateIndex - unique
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_employee_soft_skill_role"
      ON "employee_soft_skills"("employee_id", "soft_skill_id", "sub_role_id")
    `);
    console.log('✅ Unique index created');

    // CreateIndex - employee
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_employee"
      ON "employee_soft_skills"("employee_id")
    `);
    console.log('✅ Employee index created');

    // CreateIndex - soft_skill
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_soft_skill"
      ON "employee_soft_skills"("soft_skill_id")
    `);
    console.log('✅ Soft skill index created');

    // CreateIndex - sub_role
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_sub_role"
      ON "employee_soft_skills"("sub_role_id")
    `);
    console.log('✅ Sub role index created');

    // CreateIndex - tenant_employee
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_employee_soft_skills_tenant_employee"
      ON "employee_soft_skills"("tenant_id", "employee_id")
    `);
    console.log('✅ Tenant employee index created');

    // AddForeignKey - employee
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "employee_soft_skills"
      ADD CONSTRAINT "fk_employee_soft_skills_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    console.log('✅ Employee FK added');

    // AddForeignKey - soft_skill
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "employee_soft_skills"
      ADD CONSTRAINT "fk_employee_soft_skills_soft_skill"
      FOREIGN KEY ("soft_skill_id") REFERENCES "soft_skills"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    console.log('✅ Soft skill FK added');

    // AddForeignKey - sub_role
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "employee_soft_skills"
      ADD CONSTRAINT "fk_employee_soft_skills_sub_role"
      FOREIGN KEY ("sub_role_id") REFERENCES "sub_roles"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    console.log('✅ Sub role FK added');

    // AddForeignKey - tenant
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "employee_soft_skills"
      ADD CONSTRAINT "fk_employee_soft_skills_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    console.log('✅ Tenant FK added');

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
