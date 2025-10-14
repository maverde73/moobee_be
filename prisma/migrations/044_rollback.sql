-- Migration 044 ROLLBACK: Drop MCP Optimized Views
-- Created: 2025-10-12
-- Purpose: Rollback script to drop all MCP optimized views

-- ============================================================================
-- DROP VIEWS (reverse order of creation)
-- ============================================================================

DROP VIEW IF EXISTS v_assessment_results_summary CASCADE;
DROP VIEW IF EXISTS v_employee_complete_profile CASCADE;
DROP VIEW IF EXISTS v_employee_skills_summary CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'v_employee_skills_summary',
      'v_employee_complete_profile',
      'v_assessment_results_summary'
    );

  IF view_count = 0 THEN
    RAISE NOTICE '✅ Rollback 044: Successfully dropped 3 MCP optimized views';
  ELSE
    RAISE EXCEPTION '❌ Rollback 044: Expected 0 views, found %', view_count;
  END IF;
END $$;
