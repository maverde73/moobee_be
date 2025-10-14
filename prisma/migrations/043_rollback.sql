-- Rollback Migration: 043
-- Recreates training_plans table if migration 043 needs to be reverted
-- Use only if migration 043 needs to be undone

BEGIN;

-- Recreate training_plans table with original structure
CREATE TABLE training_plans (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL,
  skill_id      INTEGER,
  training_type VARCHAR(100),
  provider      VARCHAR(200),
  start_date    DATE,
  end_date      DATE,
  status        VARCHAR(50) DEFAULT 'PLANNED',
  cost          DECIMAL(10, 2),
  notes         TEXT,
  created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  tenant_id     UUID NOT NULL
);

-- Note: Original table had NO foreign keys and NO indexes (except primary key)
-- This rollback recreates the table in its original "zombie" state

COMMIT;

-- Verification
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'training_plans';
