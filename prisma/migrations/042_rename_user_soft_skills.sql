-- Migration: 042 - Rename user_soft_skills to employee_soft_skill_assessments
-- Description: Rename table and columns for clarity and consistency
-- Author: System
-- Date: 12 October 2025
-- Status: Safe (table is empty)

BEGIN;

-- Step 1: Rename table
ALTER TABLE user_soft_skills RENAME TO employee_soft_skill_assessments;

-- Step 2: Convert userId from TEXT to INTEGER (if not empty)
-- Since table is empty, this is safe
ALTER TABLE employee_soft_skill_assessments ALTER COLUMN "userId" TYPE INTEGER USING NULLIF("userId", '')::INTEGER;

-- Step 3: Rename columns for consistency
ALTER TABLE employee_soft_skill_assessments RENAME COLUMN "userId" TO "employeeId";
ALTER TABLE employee_soft_skill_assessments RENAME COLUMN "instanceId" TO "assessmentInstanceId";

-- Step 4: Drop old unique constraint
ALTER TABLE employee_soft_skill_assessments
  DROP CONSTRAINT IF EXISTS "user_soft_skills_userId_softSkillId_instanceId_key";

-- Step 5: Add new unique constraint with better naming
ALTER TABLE employee_soft_skill_assessments
  ADD CONSTRAINT "employee_soft_skill_assessments_unique"
  UNIQUE ("employeeId", "softSkillId", "assessmentInstanceId");

-- Step 6: Drop old indexes
DROP INDEX IF EXISTS "user_soft_skills_softSkillId_idx";
DROP INDEX IF EXISTS "user_soft_skills_userId_idx";

-- Step 7: Create new indexes with descriptive names
CREATE INDEX "idx_employee_soft_skill_assessments_employee"
  ON employee_soft_skill_assessments("employeeId");

CREATE INDEX "idx_employee_soft_skill_assessments_soft_skill"
  ON employee_soft_skill_assessments("softSkillId");

CREATE INDEX "idx_employee_soft_skill_assessments_instance"
  ON employee_soft_skill_assessments("assessmentInstanceId");

-- Step 8: Add foreign key to employees (for referential integrity)
ALTER TABLE employee_soft_skill_assessments
  ADD CONSTRAINT "fk_employee_soft_skill_assessments_employee"
  FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE;

COMMIT;

-- Verification query (uncomment to check)
-- SELECT
--   table_name,
--   column_name,
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'employee_soft_skill_assessments'
-- ORDER BY ordinal_position;
