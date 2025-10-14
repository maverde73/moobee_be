-- Rollback Migration: 042
-- Reverts employee_soft_skill_assessments back to user_soft_skills
-- Use only if migration 042 needs to be reverted

BEGIN;

-- Step 1: Drop foreign key added in migration
ALTER TABLE employee_soft_skill_assessments
  DROP CONSTRAINT IF EXISTS "fk_employee_soft_skill_assessments_employee";

-- Step 2: Drop new indexes
DROP INDEX IF EXISTS "idx_employee_soft_skill_assessments_employee";
DROP INDEX IF EXISTS "idx_employee_soft_skill_assessments_soft_skill";
DROP INDEX IF EXISTS "idx_employee_soft_skill_assessments_instance";

-- Step 3: Recreate old indexes
CREATE INDEX "user_soft_skills_softSkillId_idx"
  ON employee_soft_skill_assessments("softSkillId");

CREATE INDEX "user_soft_skills_userId_idx"
  ON employee_soft_skill_assessments("employeeId");

-- Step 4: Drop new unique constraint
ALTER TABLE employee_soft_skill_assessments
  DROP CONSTRAINT IF EXISTS "employee_soft_skill_assessments_unique";

-- Step 5: Add old unique constraint
ALTER TABLE employee_soft_skill_assessments
  ADD CONSTRAINT "user_soft_skills_userId_softSkillId_instanceId_key"
  UNIQUE ("employeeId", "softSkillId", "assessmentInstanceId");

-- Step 6: Rename columns back
ALTER TABLE employee_soft_skill_assessments RENAME COLUMN "employeeId" TO "userId";
ALTER TABLE employee_soft_skill_assessments RENAME COLUMN "assessmentInstanceId" TO "instanceId";

-- Step 6.5: Convert userId back to TEXT
ALTER TABLE employee_soft_skill_assessments ALTER COLUMN "userId" TYPE TEXT;

-- Step 7: Rename table back
ALTER TABLE employee_soft_skill_assessments RENAME TO user_soft_skills;

COMMIT;

-- Verification
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'user_soft_skills';
