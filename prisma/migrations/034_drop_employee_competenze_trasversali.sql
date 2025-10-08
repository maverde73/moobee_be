-- Migration 034: Drop employee_competenze_trasversali table
-- Date: 7 October 2025, 02:30
-- Purpose: Remove obsolete employee_competenze_trasversali table (replaced by employee_domain_knowledge)

-- Drop table if exists
DROP TABLE IF EXISTS railway.public.employee_competenze_trasversali CASCADE;

-- Verify table dropped
SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'employee_competenze_trasversali';

-- Note: This table has been replaced by employee_domain_knowledge (migration 033)
-- which provides better structure with domain_type categorization
