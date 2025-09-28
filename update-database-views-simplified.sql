-- =================================================
-- SIMPLIFIED UPDATE DATABASE VIEWS
-- =================================================
-- Aggiorna solo le viste esistenti per usare employees.first_name/last_name
-- invece di tenant_users.first_name/last_name
-- =================================================

-- Verifica quali viste esistono
SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;

-- Drop delle viste esistenti che potrebbero usare tenant_users
DROP VIEW IF EXISTS v_employee_roles_complete CASCADE;
DROP VIEW IF EXISTS v_employee_skills_complete CASCADE;
DROP VIEW IF EXISTS v_employee_planner CASCADE;
DROP VIEW IF EXISTS v_skill_gap_analysis CASCADE;

-- Le viste verranno ricreate dopo la migration se necessarie

-- =================================================
-- NOTA: Dopo l'esecuzione di questo script, procedere con:
-- npx prisma migrate dev --name remove_duplicate_name_fields
-- =================================================