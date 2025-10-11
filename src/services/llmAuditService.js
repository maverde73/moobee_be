/**
 * LLM Audit Service
 * Centralized logging for ALL LLM API calls across the platform
 * Date: 10 October 2025
 *
 * Purpose:
 * - Track token usage and costs per tenant
 * - Monitor LLM performance and failures
 * - Audit trail for compliance
 * - Cost optimization insights
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

// Singleton Prisma instance to avoid creating multiple connections
const prisma = new PrismaClient();

/**
 * LLM Provider Pricing (per 1M tokens) - Update regularly!
 * Source: https://openai.com/pricing, https://www.anthropic.com/pricing
 */
const PRICING = {
  openai: {
    'gpt-5': { input: 3.00, output: 12.00 }, // GPT-5 estimated pricing (per 1M tokens)
    'gpt-4o': { input: 2.50, output: 10.00 }, // Per 1M tokens
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 10.00, output: 30.00 }, // ✅ ADDED: gpt-4 (same as gpt-4-turbo)
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
  },
  anthropic: {
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 }
  },
  google: {
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-pro-vision': { input: 0.50, output: 1.50 }
  }
};

class LLMAuditService {
  /**
   * Calculate cost based on provider, model, and token usage
   * @param {string} provider - 'openai', 'anthropic', 'google'
   * @param {string} model - Model name (e.g., 'gpt-4o')
   * @param {number} promptTokens - Input tokens
   * @param {number} completionTokens - Output tokens
   * @returns {number} Cost in USD
   */
  static calculateCost(provider, model, promptTokens = 0, completionTokens = 0) {
    const pricing = PRICING[provider]?.[model];

    if (!pricing) {
      console.warn(`[LLM Audit] No pricing found for ${provider}/${model}`);
      return 0;
    }

    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;

    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Log LLM usage to database
   * @param {Object} params - Logging parameters
   * @param {string} params.tenantId - Tenant UUID
   * @param {string} params.operationType - Type of operation (e.g., 'cv_extraction')
   * @param {string} params.provider - LLM provider
   * @param {string} params.model - Model name
   * @param {Object} params.usage - Token usage { prompt_tokens, completion_tokens, total_tokens }
   * @param {string} params.status - 'success', 'failed', 'timeout', 'rate_limited'
   * @param {number} params.responseTime - Response time in milliseconds
   * @param {Object} [params.requestParams] - Sanitized request parameters
   * @param {Object} [params.responseSummary] - Response summary (not full text)
   * @param {string} [params.entityType] - Entity type (e.g., 'cv_extraction', 'employee')
   * @param {string} [params.entityId] - Entity ID
   * @param {string} [params.userId] - User ID who triggered the operation
   * @param {string} [params.requestId] - Unique request ID for correlation
   * @param {string} [params.parentOperationId] - Parent operation UUID for nested calls
   * @param {string} [params.errorMessage] - Error message if failed
   * @param {Object} [params.metadata] - Additional context-specific data
   * @param {number} [params.preCalculatedCost] - Pre-calculated cost from external service (e.g., Python's exact LLM cost)
   * @returns {Promise<Object>} Created log entry
   */
  static async logUsage({
    tenantId,
    operationType,
    provider,
    model,
    usage,
    status,
    responseTime,
    requestParams = null,
    responseSummary = null,
    entityType = null,
    entityId = null,
    userId = null,
    requestId = null,
    parentOperationId = null,
    errorMessage = null,
    metadata = null,
    preCalculatedCost = null  // ✅ NEW: Use pre-calculated cost from external service (e.g., Python)
  }) {
    // DEBUG: Log function entry
    console.log('[LLM Audit] 🔍 logUsage() called with:', {
      tenantId: tenantId?.substring(0, 8) + '...' || 'MISSING',
      operationType,
      provider,
      model,
      userId: userId?.substring(0, 8) + '...' || 'MISSING',
      status,
      totalTokens: usage?.total_tokens || 0
    });

    try {
      const promptTokens = usage?.prompt_tokens || 0;
      const completionTokens = usage?.completion_tokens || 0;
      const totalTokens = usage?.total_tokens || (promptTokens + completionTokens);

      // Use pre-calculated cost if provided (e.g., from Python), otherwise calculate
      // ⚠️ IMPORTANT: Python's cost calculation is more accurate (actual LLM response)
      const estimatedCost = preCalculatedCost !== null
        ? preCalculatedCost
        : this.calculateCost(provider, model, promptTokens, completionTokens);

      // Create log entry
      const logEntry = await prisma.llm_usage_logs.create({
        data: {
          tenant_id: tenantId,
          operation_type: operationType,
          entity_type: entityType,
          entity_id: entityId ? String(entityId) : null,
          provider,
          model,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost,
          request_params: requestParams,
          response_summary: responseSummary,
          status,
          response_time_ms: responseTime,
          error_message: errorMessage,
          user_id: userId,
          request_id: requestId || uuidv4(),
          parent_operation_id: parentOperationId,
          metadata
        }
      });

      // IMPORTANT: Log success AFTER database write completes
      console.log(`[LLM Audit] ✅ Logged ${operationType} | ${provider}/${model} | ${totalTokens} tokens | $${estimatedCost.toFixed(4)} | DB ID: ${logEntry.id.substring(0, 8)}...`);

      return logEntry;
    } catch (error) {
      console.error('[LLM Audit] ❌ Failed to log LLM usage:', error.message);
      console.error('[LLM Audit] ❌ Error stack:', error.stack);
      console.error('[LLM Audit] ❌ Data:', JSON.stringify({
        tenantId,
        operationType,
        provider,
        model,
        userId,
        entityType,
        entityId
      }, null, 2));

      // Don't throw - logging failure shouldn't break the main operation
      return null;
    }
  }

  /**
   * Get total cost for a tenant in a date range (UPDATED for Super Admin)
   * @param {string} tenantId - Tenant UUID (null = all tenants for super admin)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Cost summary
   */
  static async getCostSummary(tenantId = null, startDate = null, endDate = null) {
    try {
      const where = {
        status: 'success' // Only count successful calls
      };

      // If tenantId is provided, filter by it; otherwise get all (super admin)
      if (tenantId) {
        where.tenant_id = tenantId;
      }

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = startDate;
        if (endDate) where.created_at.lte = endDate;
      }

      const result = await prisma.llm_usage_logs.aggregate({
        where,
        _sum: {
          estimated_cost: true,
          total_tokens: true
        },
        _count: {
          id: true
        }
      });

      // Group by operation type
      const byOperation = await prisma.llm_usage_logs.groupBy({
        by: ['operation_type'],
        where,
        _sum: {
          estimated_cost: true,
          total_tokens: true
        },
        _count: {
          id: true
        },
        orderBy: {
          _sum: {
            estimated_cost: 'desc'
          }
        }
      });

      // Group by model
      const byModel = await prisma.llm_usage_logs.groupBy({
        by: ['provider', 'model'],
        where,
        _sum: {
          estimated_cost: true,
          total_tokens: true
        },
        _count: {
          id: true
        },
        orderBy: {
          _sum: {
            estimated_cost: 'desc'
          }
        }
      });

      return {
        total_cost: result._sum.estimated_cost || 0,
        total_tokens: result._sum.total_tokens || 0,
        total_calls: result._count.id || 0,
        by_operation: byOperation,
        by_model: byModel,
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      console.error('[LLM Audit] Error in getCostSummary:', error);
      throw error;
    }
  }

  /**
   * Get failed LLM operations for debugging (UPDATED for Super Admin)
   * @param {string} tenantId - Tenant UUID (null = all tenants for super admin)
   * @param {number} limit - Number of records to return
   * @returns {Promise<Array>} Failed operations with tenant names
   */
  static async getFailedOperations(tenantId = null, limit = 20) {
    try {
      const where = {
        status: { in: ['failed', 'timeout', 'rate_limited'] }
      };

      // If tenantId is provided, filter by it; otherwise get all (super admin)
      if (tenantId) {
        where.tenant_id = tenantId;
      }

      const failedOps = await prisma.llm_usage_logs.findMany({
        where,
        orderBy: {
          created_at: 'desc'
        },
        take: limit,
        select: {
          id: true,
          created_at: true,
          tenant_id: true,
          operation_type: true,
          provider: true,
          model: true,
          status: true,
          error_message: true,
          entity_type: true,
          entity_id: true,
          response_time_ms: true
        }
      });

      // Enrich with tenant names
      const enriched = await Promise.all(
        failedOps.map(async (op) => {
          const tenant = await prisma.tenants.findUnique({
            where: { id: op.tenant_id },
            select: { name: true }
          });

          return {
            ...op,
            tenant_name: tenant?.name || 'Unknown',
            timestamp: op.created_at.toISOString()
          };
        })
      );

      return enriched;
    } catch (error) {
      console.error('[LLM Audit] Error in getFailedOperations:', error);
      throw error;
    }
  }

  /**
   * Get top tenant spenders (Super Admin only)
   * @param {number} limit - Number of top tenants to return
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Promise<Object>} Top tenants data with rankings
   */
  static async getTopTenantSpenders(limit = 10, startDate = null, endDate = null) {
    try {
      const where = { status: 'success' };

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = startDate;
        if (endDate) where.created_at.lte = endDate;
      }

      // Get total cost for percentage calculation
      const totalCost = await prisma.llm_usage_logs.aggregate({
        where,
        _sum: { estimated_cost: true }
      });

      const topTenants = await prisma.llm_usage_logs.groupBy({
        by: ['tenant_id'],
        where,
        _sum: {
          estimated_cost: true,
          total_tokens: true
        },
        _count: { id: true },
        orderBy: {
          _sum: { estimated_cost: 'desc' }
        },
        take: limit
      });

      // Enrich with tenant names
      const enriched = await Promise.all(
        topTenants.map(async (t, index) => {
          const tenant = await prisma.tenants.findUnique({
            where: { id: t.tenant_id },
            select: { name: true }
          });

          const cost = t._sum.estimated_cost || 0;
          const tokens = t._sum.total_tokens || 0;
          const calls = t._count.id;

          return {
            rank: index + 1,
            tenant_id: t.tenant_id,
            tenant_name: tenant?.name || 'Unknown',
            total_cost: cost,
            total_tokens: tokens,
            total_calls: calls,
            percentage_of_total: totalCost._sum.estimated_cost > 0
              ? parseFloat(((cost / totalCost._sum.estimated_cost) * 100).toFixed(2))
              : 0,
            avg_cost_per_call: calls > 0
              ? parseFloat((cost / calls).toFixed(4))
              : 0
          };
        })
      );

      return {
        top_tenants: enriched,
        total_cost_all_tenants: totalCost._sum.estimated_cost || 0,
        period: { start: startDate, end: endDate }
      };
    } catch (error) {
      console.error('[LLM Audit] Error in getTopTenantSpenders:', error);
      throw error;
    }
  }

  /**
   * Get trends over time (Super Admin)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} granularity - 'day', 'week', 'month'
   * @param {string} tenantId - Tenant ID (optional, null = all)
   * @param {boolean} includeTopTenants - Include breakdown for top 3 tenants
   * @returns {Promise<Object>} Trend data
   */
  static async getTrends(startDate, endDate, granularity = 'day', tenantId = null, includeTopTenants = true) {
    try {
      // Set default dates if not provided
      const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const defaultEndDate = endDate || new Date();

      // Use raw query for complex grouping by date
      const dateFormat = {
        day: "DATE(created_at)",
        week: "DATE_TRUNC('week', created_at)::date",
        month: "DATE_TRUNC('month', created_at)::date"
      }[granularity] || "DATE(created_at)";

      const tenantFilter = tenantId ? `AND tenant_id = '${tenantId}'` : '';

      const query = `
        SELECT
          ${dateFormat} as date,
          SUM(estimated_cost) as total_cost,
          SUM(total_tokens) as total_tokens,
          COUNT(*) as total_calls
        FROM llm_usage_logs
        WHERE status = 'success'
          AND created_at >= $1
          AND created_at <= $2
          ${tenantFilter}
        GROUP BY ${dateFormat}
        ORDER BY date ASC
      `;

      const trends = await prisma.$queryRawUnsafe(
        query,
        defaultStartDate,
        defaultEndDate
      );

      // Format trends data
      const formattedTrends = trends.map(t => ({
        date: t.date.toISOString().split('T')[0],
        total_cost: parseFloat(t.total_cost) || 0,
        total_tokens: parseInt(t.total_tokens) || 0,
        total_calls: parseInt(t.total_calls) || 0,
        tenant_breakdown: {}
      }));

      // If requested and no specific tenant, include top 3 tenant breakdown
      if (includeTopTenants && !tenantId) {
        // Get top 3 tenants
        const topTenants = await this.getTopTenantSpenders(3, defaultStartDate, defaultEndDate);
        const topTenantIds = topTenants.top_tenants.map(t => t.tenant_id);

        // Get daily breakdown for each top tenant
        for (const topTenantId of topTenantIds) {
          const tenantQuery = `
            SELECT
              ${dateFormat} as date,
              SUM(estimated_cost) as cost
            FROM llm_usage_logs
            WHERE status = 'success'
              AND created_at >= $1
              AND created_at <= $2
              AND tenant_id = $3
            GROUP BY ${dateFormat}
            ORDER BY date ASC
          `;

          const tenantTrends = await prisma.$queryRawUnsafe(
            tenantQuery,
            defaultStartDate,
            defaultEndDate,
            topTenantId
          );

          // Map tenant costs to main trends array
          tenantTrends.forEach(tt => {
            const dateStr = tt.date.toISOString().split('T')[0];
            const trendIndex = formattedTrends.findIndex(t => t.date === dateStr);
            if (trendIndex >= 0) {
              formattedTrends[trendIndex].tenant_breakdown[topTenantId] = parseFloat(tt.cost) || 0;
            }
          });
        }
      }

      return {
        trends: formattedTrends,
        granularity,
        period: { start: defaultStartDate, end: defaultEndDate }
      };
    } catch (error) {
      console.error('[LLM Audit] Error in getTrends:', error);
      throw error;
    }
  }

  /**
   * Get global KPIs for all tenants (Super Admin only)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Global KPIs with trends
   */
  static async getGlobalKPIs(startDate = null, endDate = null) {
    try {
      const where = { status: 'success' };

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = startDate;
        if (endDate) where.created_at.lte = endDate;
      }

      // Current period aggregates
      const current = await prisma.llm_usage_logs.aggregate({
        where,
        _sum: {
          estimated_cost: true,
          total_tokens: true
        },
        _count: {
          id: true
        }
      });

      // Count active tenants (tenants with at least 1 call in period)
      const activeTenants = await prisma.llm_usage_logs.groupBy({
        by: ['tenant_id'],
        where,
        _count: {
          id: true
        }
      });

      // Calculate previous period for trend comparison
      const periodLength = endDate && startDate
        ? endDate.getTime() - startDate.getTime()
        : 30 * 24 * 60 * 60 * 1000; // 30 days default

      const prevStartDate = new Date((startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).getTime() - periodLength);
      const prevEndDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const prevWhere = {
        ...where,
        created_at: {
          gte: prevStartDate,
          lte: prevEndDate
        }
      };

      const previous = await prisma.llm_usage_logs.aggregate({
        where: prevWhere,
        _sum: {
          estimated_cost: true,
          total_tokens: true
        },
        _count: {
          id: true
        }
      });

      const prevActiveTenants = await prisma.llm_usage_logs.groupBy({
        by: ['tenant_id'],
        where: prevWhere,
        _count: {
          id: true
        }
      });

      // Calculate percentage changes
      const calculateTrend = (current, previous) => {
        if (!previous || previous === 0) return 0;
        return parseFloat((((current - previous) / previous) * 100).toFixed(2));
      };

      return {
        total_cost: current._sum.estimated_cost || 0,
        total_tokens: current._sum.total_tokens || 0,
        total_calls: current._count.id || 0,
        active_tenants: activeTenants.length,
        trends: {
          cost: calculateTrend(current._sum.estimated_cost || 0, previous._sum.estimated_cost || 0),
          tokens: calculateTrend(current._sum.total_tokens || 0, previous._sum.total_tokens || 0),
          calls: calculateTrend(current._count.id || 0, previous._count.id || 0),
          tenants: activeTenants.length - prevActiveTenants.length
        }
      };
    } catch (error) {
      console.error('[LLM Audit] Error in getGlobalKPIs:', error);
      throw error;
    }
  }
}

module.exports = LLMAuditService;
