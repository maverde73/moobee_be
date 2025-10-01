-- Migration: Add Custom Skills Support (Tenant-specific skills)
-- Created: 2025-10-01 22:30
-- Description: Aggiunge supporto per custom skills isolate per tenant

-- Step 1: Aggiungi colonne alla tabella skills esistente
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Step 2: Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_skills_tenant_id ON skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skills_skill ON skills("Skill");
CREATE INDEX IF NOT EXISTS idx_skills_active ON skills(is_active);
CREATE INDEX IF NOT EXISTS idx_skills_composite ON skills(tenant_id, is_active, "Skill");

-- Step 3: Constraint di unicità (nome skill univoco per tenant)
-- Permette stesso nome per tenant diversi, ma non duplicati nello stesso tenant
-- NULLS NOT DISTINCT: NULL = NULL per unicità (skills globali)
ALTER TABLE skills
  DROP CONSTRAINT IF EXISTS unique_skill_per_tenant;

ALTER TABLE skills
  ADD CONSTRAINT unique_skill_per_tenant
  UNIQUE NULLS NOT DISTINCT ("Skill", tenant_id);

-- Step 4: Commento per documentazione
COMMENT ON COLUMN skills.tenant_id IS 'NULL = skill globale (visibile a tutti), VARCHAR = skill custom (visibile solo al tenant creatore)';
COMMENT ON COLUMN skills.created_by IS 'User email che ha creato la skill custom';
COMMENT ON COLUMN skills.is_active IS 'Flag per soft delete delle skills';

-- Step 5: Aggiorna skills esistenti (imposta come globali)
UPDATE skills
SET
  tenant_id = NULL,
  is_active = true,
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE tenant_id IS NULL;

-- Rollback Script (da usare solo in caso di problemi)
-- ALTER TABLE skills DROP CONSTRAINT IF EXISTS unique_skill_per_tenant;
-- DROP INDEX IF EXISTS idx_skills_composite;
-- DROP INDEX IF EXISTS idx_skills_active;
-- DROP INDEX IF EXISTS idx_skills_name;
-- DROP INDEX IF EXISTS idx_skills_tenant_id;
-- ALTER TABLE skills DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE skills DROP COLUMN IF EXISTS created_at;
-- ALTER TABLE skills DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE skills DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE skills DROP COLUMN IF EXISTS tenant_id;
