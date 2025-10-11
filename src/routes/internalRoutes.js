/**
 * Internal API Routes
 *
 * Routes used by Python backend and other internal services.
 * NO AUTHENTICATION required - trusted network only.
 *
 * Security: These endpoints should be called ONLY from internal services
 * (Python backend on same network/localhost).
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * POST /api/internal/llm-usage-log
 *
 * Log LLM usage from Python backend
 * Called after every LLM API call (OpenAI, Anthropic, etc.)
 *
 * Body:
 * {
 *   tenant_id: number (required)
 *   operation_type: string (required) - e.g. "cv_extraction_personal_info"
 *   provider: string (required) - "openai" or "anthropic"
 *   model: string (required) - e.g. "gpt-4", "gpt-4o-mini"
 *   prompt_tokens: number
 *   completion_tokens: number
 *   total_tokens: number
 *   estimated_cost: number (in USD)
 *   status: string - "success", "failed", "timeout", "rate_limited"
 *   response_time_ms: number
 *   entity_type: string (optional) - "employee", "assessment", etc.
 *   entity_id: string (optional)
 *   error_message: string (optional)
 * }
 */
router.post('/llm-usage-log', async (req, res) => {
  try {
    const {
      tenant_id,
      operation_type,
      provider,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      estimated_cost,
      status,
      response_time_ms,
      entity_type,
      entity_id,
      error_message
    } = req.body;

    // Validate required fields
    if (!tenant_id || !operation_type || !provider || !model) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'operation_type', 'provider', 'model']
      });
    }

    // Validate tenant exists (optional check)
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      console.warn(`[Internal API] Warning: tenant_id ${tenant_id} not found`);
      // Continue anyway - don't block logging for invalid tenant
    }

    // Insert into llm_usage_logs
    const log = await prisma.llm_usage_logs.create({
      data: {
        tenant_id,
        operation_type,
        provider,
        model,
        prompt_tokens: prompt_tokens || 0,
        completion_tokens: completion_tokens || 0,
        total_tokens: total_tokens || 0,
        estimated_cost: estimated_cost ? parseFloat(estimated_cost) : 0,
        status: status || 'success',
        response_time_ms: response_time_ms || null,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        error_message: error_message || null
      }
    });

    console.log(`[LLM Audit] Logged ${operation_type} for tenant ${tenant_id}: ${total_tokens} tokens, $${estimated_cost?.toFixed(6)}`);

    res.status(201).json({
      success: true,
      log_id: log.id
    });

  } catch (error) {
    console.error('[Internal API] LLM usage log error:', error);
    res.status(500).json({
      error: 'Failed to log LLM usage',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/health
 *
 * Health check for internal services
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'internal-api',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
