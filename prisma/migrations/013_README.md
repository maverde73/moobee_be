# Migration 013: Employee Skills & Competenze Restructure

**Date**: 2 October 2025, 02:00
**Status**: ✅ Schema Ready - Migration SQL Created (not yet executed on Railway DB)

## 📋 Overview

Questa migration ristruttura il database per ottimizzare la gestione delle skills e competenze trasversali degli employee.

## 🎯 Obiettivi

1. **Centralizzare competenze trasversali** in `employees.competenze_trasversali` (JSONB)
2. **Rimuovere ridondanza** certificazioni da `employee_skills`
3. **Creare tabella ricercabile** `employee_competenze_trasversali` per full-text search
4. **Ottimizzare employee_skills** per grading 0.0-1.0 e source tracking

## 🔄 Modifiche Database

### 1. `employee_roles` (REMOVED FIELD)
```sql
DROP COLUMN competenze_tecniche_trasversali
```
**Motivo**: Competenze trasversali sono per employee, non per ruolo specifico.

### 2. `employee_skills` (CLEANED UP)

**Removed**:
- `is_certified` (usa `employee_certifications` table)
- `certification_date` (usa `employee_certifications` table)
- `certification_authority` (usa `employee_certifications` table)

**Added**:
- `source VARCHAR(50)` - Traccia provenienza ('manual', 'cv_extracted', 'assessment')

**Modified**:
- `proficiency_level INT → FLOAT` - Supporta grading 0.0-1.0

**Added Constraints**:
- `UNIQUE(employee_id, skill_id)` - Previene duplicati

### 3. `employee_competenze_trasversali` (NEW TABLE)

```sql
CREATE TABLE employee_competenze_trasversali (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL,
  competenza TEXT NOT NULL,          -- Full-text searchable
  categoria VARCHAR(50),              -- 'bancaria', 'automotive', etc.
  anni_esperienza INT,
  livello VARCHAR(20),                -- 'base', 'intermedio', 'avanzato', 'esperto'
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  tenant_id UUID NOT NULL
);
```

**Indexes**:
- Full-text search (Italian): `gin(to_tsvector('italian', competenza))`
- Performance indexes: `employee_id`, `tenant_id`, `categoria`

## 📊 Data Migration

### Step 1: Migrate to employees.competenze_trasversali
```sql
UPDATE employees e
SET competenze_trasversali = (
  SELECT er.competenze_tecniche_trasversali
  FROM employee_roles er
  WHERE er.employee_id = e.id
    AND er.is_current = true
);
```

### Step 2: Populate employee_competenze_trasversali
```sql
INSERT INTO employee_competenze_trasversali (employee_id, competenza, tenant_id)
SELECT
  e.id,
  jsonb_array_elements_text(e.competenze_trasversali::jsonb),
  e.tenant_id
FROM employees e
WHERE e.competenze_trasversali IS NOT NULL;
```

## 🚀 Execution

### Option 1: Railway Dashboard (RECOMMENDED)
1. Login to Railway dashboard
2. Navigate to PostgreSQL database
3. Open "Query" tab
4. Copy content from `013_restructure_employee_skills.sql`
5. Execute query
6. Verify output logs

### Option 2: Prisma Migrate (if Railway allows)
```bash
# Add to Prisma migrations
npx prisma migrate dev --name restructure_employee_skills

# Deploy to Railway
npx prisma migrate deploy
```

### Option 3: Manual psql (from Railway CLI)
```bash
railway login
railway link
railway run psql $DATABASE_URL -f prisma/migrations/013_restructure_employee_skills.sql
```

## ⚠️ Pre-Execution Checklist

- [ ] Backup database (Railway snapshot)
- [ ] Test on development environment first
- [ ] Verify no active transactions
- [ ] Schedule maintenance window
- [ ] Notify team of potential downtime
- [ ] Review rollback script (`013_rollback.sql`)

## 🔙 Rollback

Se necessario, esegui:
```bash
psql $DATABASE_URL -f prisma/migrations/013_rollback.sql
```

**Warning**: Rollback potrebbe causare perdita dati se modifiche incompatibili sono state fatte.

## ✅ Post-Migration Verification

```sql
-- Check employees with competenze_trasversali
SELECT COUNT(*) FROM employees
WHERE competenze_trasversali IS NOT NULL
  AND jsonb_array_length(competenze_trasversali::jsonb) > 0;

-- Check employee_competenze_trasversali records
SELECT COUNT(*) FROM employee_competenze_trasversali;

-- Verify employee_skills structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employee_skills'
ORDER BY ordinal_position;

-- Verify employee_roles structure (should NOT have competenze_tecniche_trasversali)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'employee_roles'
  AND column_name = 'competenze_tecniche_trasversali';
-- Should return 0 rows
```

## 📝 Next Steps After Migration

1. **Update Backend Services**:
   - `employeeService.js` - Add methods for competenze_trasversali CRUD
   - `employeeSkillsService.js` - Update for new structure

2. **Update API Endpoints**:
   ```javascript
   // GET /api/employees/:id/competenze
   // POST /api/employees/:id/competenze
   // DELETE /api/employees/:id/competenze/:competenzaId
   // GET /api/employees/search-competenze?q=bancaria
   ```

3. **Frontend Integration**:
   - Update Employee Edit form
   - Add competenze trasversali search
   - Implement categoria autocomplete

4. **Full-Text Search**:
   ```sql
   -- Example search
   SELECT e.first_name, e.last_name, ct.competenza, ct.categoria
   FROM employees e
   JOIN employee_competenze_trasversali ct ON e.id = ct.employee_id
   WHERE to_tsvector('italian', ct.competenza) @@ to_tsquery('italian', 'bancaria')
   ORDER BY ct.anni_esperienza DESC;
   ```

## 📚 Related Documentation

- **CLAUDE.md** - Section "🚧 Prossimi Sviluppi - Skills & Employee Roles"
- **Prisma Schema** - `prisma/schema.prisma` lines 209-260
- **Migration SQL** - `013_restructure_employee_skills.sql`
- **Rollback SQL** - `013_rollback.sql`

---

**Migration Author**: Claude Code
**Reviewed By**: _Pending_
**Executed On**: _Pending_
**Execution Time**: _Pending_
