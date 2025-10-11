const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const LLMAuditService = require('../services/llmAuditService');
const { authenticate } = require('../middlewares/authMiddleware');
const { determineTenant } = require('../middlewares/tenantMiddleware');
const { requireSuperAdmin } = require('../middlewares/superAdminAuth');

/**
 * Analytics Routes
 * All routes require authentication and appropriate permissions
 */

// Get analytics overview
router.get(
  '/overview',
  authenticate,
  analyticsController.getOverview.bind(analyticsController)
);

// Get real-time activity
router.get(
  '/activity',
  authenticate,
  analyticsController.getActivity.bind(analyticsController)
);

// Export analytics data
router.get(
  '/export',
  authenticate,
  analyticsController.exportAnalytics.bind(analyticsController)
);

// Get completion statistics
router.get(
  '/completion-stats',
  authenticate,
  analyticsController.getCompletionStats.bind(analyticsController)
);

// Get AI usage statistics
router.get(
  '/ai-usage',
  authenticate,
  analyticsController.getAIUsageStats.bind(analyticsController)
);

// Get tenant-specific analytics
router.get(
  '/tenant/:tenantId',
  authenticate,
  analyticsController.getTenantAnalytics.bind(analyticsController)
);

// =============== LLM AUDIT & COST TRACKING ===============

/**
 * GET /api/analytics/llm-costs
 * Get LLM usage costs summary for current tenant
 *
 * Query Parameters:
 * - start_date: ISO date string (optional) - Start of date range
 * - end_date: ISO date string (optional) - End of date range
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     total_cost: 0.0234,
 *     total_tokens: 15000,
 *     total_calls: 10,
 *     by_operation: [...],
 *     by_model: [...],
 *     period: { start: '2025-10-01', end: '2025-10-10' }
 *   }
 * }
 */
router.get('/llm-costs', authenticate, determineTenant, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { start_date, end_date } = req.query;

    console.log(`[Analytics] 📊 Fetching LLM costs for tenant ${tenantId}`);

    const summary = await LLMAuditService.getCostSummary(
      tenantId,
      start_date ? new Date(start_date) : null,
      end_date ? new Date(end_date) : null
    );

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('[Analytics] ❌ Error fetching LLM costs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch LLM costs',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/llm-failed-ops
 * Get failed LLM operations for debugging
 *
 * Query Parameters:
 * - limit: Number (optional, default 20) - Max records to return
 *
 * Response:
 * {
 *   success: true,
 *   data: [{ id, operation_type, provider, model, status, error_message, ... }]
 * }
 */
router.get('/llm-failed-ops', authenticate, determineTenant, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { limit = 20 } = req.query;

    console.log(`[Analytics] 🔍 Fetching failed LLM operations for tenant ${tenantId}`);

    const failedOps = await LLMAuditService.getFailedOperations(
      tenantId,
      parseInt(limit, 10)
    );

    res.json({
      success: true,
      data: failedOps
    });

  } catch (error) {
    console.error('[Analytics] ❌ Error fetching failed LLM operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch failed operations',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/llm-operations
 * Get all LLM operations with filtering and pagination
 *
 * Query Parameters:
 * - operation_type: String (optional)
 * - status: String (optional) - success/failed/timeout/rate_limited
 * - entity_type: String (optional)
 * - entity_id: String (optional)
 * - limit: Number (optional, default 50)
 * - offset: Number (optional, default 0)
 */
router.get('/llm-operations', authenticate, determineTenant, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      operation_type,
      status,
      entity_type,
      entity_id,
      limit = 50,
      offset = 0
    } = req.query;

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const where = { tenant_id: tenantId };

      if (operation_type) where.operation_type = operation_type;
      if (status) where.status = status;
      if (entity_type) where.entity_type = entity_type;
      if (entity_id) where.entity_id = entity_id;

      const [operations, total] = await Promise.all([
        prisma.llm_usage_logs.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: parseInt(limit, 10),
          skip: parseInt(offset, 10),
          select: {
            id: true,
            operation_type: true,
            provider: true,
            model: true,
            status: true,
            total_tokens: true,
            estimated_cost: true,
            response_time_ms: true,
            entity_type: true,
            entity_id: true,
            error_message: true,
            created_at: true
          }
        }),
        prisma.llm_usage_logs.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          operations,
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10)
        }
      });

    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('[Analytics] ❌ Error fetching LLM operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch LLM operations',
      error: error.message
    });
  }
});

// =============== SUPER ADMIN ENDPOINTS (CROSS-TENANT) ===============

/**
 * GET /api/analytics/super-admin/llm-global-kpis
 * Get global LLM KPIs for all tenants (Super Admin only)
 *
 * Query Parameters:
 * - start_date: ISO date string (optional)
 * - end_date: ISO date string (optional)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     total_cost: 1245.32,
 *     total_tokens: 45800000,
 *     total_calls: 23456,
 *     active_tenants: 18,
 *     trends: { cost: 23.4, tokens: 18.9, calls: 31.2, tenants: 0 }
 *   }
 * }
 */
router.get('/super-admin/llm-global-kpis', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    console.log('[Super Admin Analytics] 📊 Fetching global LLM KPIs');

    const kpis = await LLMAuditService.getGlobalKPIs(
      start_date ? new Date(start_date) : null,
      end_date ? new Date(end_date) : null
    );

    res.json({
      success: true,
      data: kpis
    });

  } catch (error) {
    console.error('[Super Admin Analytics] ❌ Error fetching global KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global KPIs',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/super-admin/llm-top-tenants
 * Get top tenant spenders (Super Admin only)
 *
 * Query Parameters:
 * - limit: Number (optional, default 10, max 50)
 * - start_date: ISO date string (optional)
 * - end_date: ISO date string (optional)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     top_tenants: [
 *       {
 *         rank: 1,
 *         tenant_id: 'uuid',
 *         tenant_name: 'Acme Corp',
 *         total_cost: 234.56,
 *         total_tokens: 12500000,
 *         total_calls: 5432,
 *         percentage_of_total: 18.8,
 *         avg_cost_per_call: 0.043
 *       }
 *     ],
 *     total_cost_all_tenants: 1245.32,
 *     period: { start: '...', end: '...' }
 *   }
 * }
 */
router.get('/super-admin/llm-top-tenants', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10), 50); // Max 50

    console.log(`[Super Admin Analytics] 🏆 Fetching top ${parsedLimit} tenant spenders`);

    const topTenants = await LLMAuditService.getTopTenantSpenders(
      parsedLimit,
      start_date ? new Date(start_date) : null,
      end_date ? new Date(end_date) : null
    );

    res.json({
      success: true,
      data: topTenants
    });

  } catch (error) {
    console.error('[Super Admin Analytics] ❌ Error fetching top tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top tenants',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/super-admin/llm-trends
 * Get LLM usage trends over time (Super Admin only)
 *
 * Query Parameters:
 * - start_date: ISO date string (optional)
 * - end_date: ISO date string (optional)
 * - granularity: 'day' | 'week' | 'month' (optional, default 'day')
 * - tenant_id: UUID (optional) - Filter by specific tenant
 * - include_top_tenants: Boolean (optional, default true) - Include top 3 tenant breakdown
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     trends: [
 *       {
 *         date: '2025-10-01',
 *         total_cost: 42.15,
 *         total_tokens: 1850000,
 *         total_calls: 856,
 *         tenant_breakdown: { 'uuid-1': 8.23, 'uuid-2': 6.78, ... }
 *       }
 *     ],
 *     granularity: 'day',
 *     period: { start: '...', end: '...' }
 *   }
 * }
 */
router.get('/super-admin/llm-trends', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      granularity = 'day',
      tenant_id,
      include_top_tenants = 'true'
    } = req.query;

    console.log(`[Super Admin Analytics] 📈 Fetching LLM trends (${granularity})`);

    const trends = await LLMAuditService.getTrends(
      start_date ? new Date(start_date) : null,
      end_date ? new Date(end_date) : null,
      granularity,
      tenant_id || null,
      include_top_tenants === 'true'
    );

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('[Super Admin Analytics] ❌ Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/super-admin/llm-costs
 * Get LLM costs summary for all tenants or specific tenant (Super Admin only)
 *
 * Query Parameters:
 * - tenant_id: UUID (optional) - If omitted, returns data for ALL tenants
 * - start_date: ISO date string (optional)
 * - end_date: ISO date string (optional)
 *
 * Response: Same as regular /llm-costs but with cross-tenant data
 */
router.get('/super-admin/llm-costs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { tenant_id, start_date, end_date } = req.query;

    console.log(`[Super Admin Analytics] 📊 Fetching LLM costs ${tenant_id ? `for tenant ${tenant_id}` : 'for all tenants'}`);

    // If tenant_id is provided, get data for that tenant
    // Otherwise, getCostSummary with null tenantId will aggregate all tenants
    const summary = await LLMAuditService.getCostSummary(
      tenant_id || null,
      start_date ? new Date(start_date) : null,
      end_date ? new Date(end_date) : null
    );

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('[Super Admin Analytics] ❌ Error fetching LLM costs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch LLM costs',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/super-admin/llm-failed-ops
 * Get failed LLM operations across all tenants (Super Admin only)
 *
 * Query Parameters:
 * - limit: Number (optional, default 20)
 * - tenant_id: UUID (optional) - Filter by specific tenant
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     failed_operations: [
 *       {
 *         id: 'uuid',
 *         timestamp: '2025-10-10T14:23:45Z',
 *         tenant_id: 'uuid',
 *         tenant_name: 'Acme Corp',
 *         operation_type: 'cv_extraction',
 *         provider: 'openai',
 *         model: 'gpt-4o',
 *         status: 'timeout',
 *         error_message: 'Request timeout after 30s',
 *         response_time_ms: 30000
 *       }
 *     ],
 *     total_failed: 156
 *   }
 * }
 */
router.get('/super-admin/llm-failed-ops', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 20, tenant_id } = req.query;

    console.log(`[Super Admin Analytics] 🔍 Fetching failed LLM operations ${tenant_id ? `for tenant ${tenant_id}` : 'for all tenants'}`);

    const failedOps = await LLMAuditService.getFailedOperations(
      tenant_id || null,  // null = all tenants
      parseInt(limit, 10)
    );

    res.json({
      success: true,
      data: {
        failed_operations: failedOps,
        total_failed: failedOps.length
      }
    });

  } catch (error) {
    console.error('[Super Admin Analytics] ❌ Error fetching failed operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch failed operations',
      error: error.message
    });
  }
});

module.exports = router;