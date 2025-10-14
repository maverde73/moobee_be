/**
 * MCP Proxy Routes
 *
 * Proxy autenticato per server MCP con:
 * - JWT authentication
 * - RBAC (Role-Based Access Control)
 * - Tenant isolation filtering
 * - Audit logging
 */

const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middlewares/authMiddleware');
const { mcpAuthMiddleware, mcpAuditMiddleware } = require('../middlewares/mcpAuthMiddleware');
const { getConfigStats } = require('../config/mcpRbacRules');

const router = express.Router();

// MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mcpjson2data-production.up.railway.app/mcp';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!MCP_AUTH_TOKEN) {
  console.error('❌ MCP_AUTH_TOKEN not configured in environment variables!');
}

/**
 * POST /api/mcp
 * Proxy autenticato per server MCP
 *
 * Headers richiesti:
 * - Authorization: Bearer <JWT token>
 *
 * Body: JSON-RPC 2.0 request
 */
router.post(
  '/mcp',
  authenticate,           // 1. Valida JWT e popola req.user
  mcpAuthMiddleware,      // 2. Trasforma query con filtri RBAC + tenant
  mcpAuditMiddleware,     // 3. Log audit
  async (req, res) => {
    try {
      // 4. Inoltra richiesta a MCP server
      const response = await axios.post(MCP_SERVER_URL, req.body, {
        headers: {
          'Authorization': `Bearer ${MCP_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        timeout: 30000, // 30 secondi
        validateStatus: null // Accetta tutti gli status code
      });

      // 5. Ritorna risposta (SSE format)
      res.status(response.status);

      // Se risposta è SSE, preserva content-type
      if (response.headers['content-type']?.includes('text/event-stream')) {
        res.set('Content-Type', 'text/event-stream');
      } else {
        res.set('Content-Type', 'application/json');
      }

      res.send(response.data);

    } catch (error) {
      console.error('❌ MCP Proxy Error:', {
        message: error.message,
        user: req.mcpContext?.userId,
        role: req.mcpContext?.role,
        method: req.body?.method
      });

      if (error.response) {
        // MCP server ha ritornato un errore
        res.status(error.response.status).json({
          error: 'MCP Server Error',
          message: error.response.data,
          details: {
            status: error.response.status,
            mcp_url: MCP_SERVER_URL
          }
        });
      } else if (error.code === 'ECONNREFUSED') {
        // MCP server non raggiungibile
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'MCP Server is not reachable',
          details: {
            mcp_url: MCP_SERVER_URL
          }
        });
      } else if (error.code === 'ETIMEDOUT') {
        // Timeout
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'MCP Server request timed out',
          details: {
            timeout_ms: 30000
          }
        });
      } else {
        // Errore generico
        res.status(500).json({
          error: 'Proxy Error',
          message: error.message
        });
      }
    }
  }
);

/**
 * GET /api/mcp/health
 * Health check del proxy MCP
 */
router.get('/mcp/health', (req, res) => {
  const stats = getConfigStats();

  res.json({
    status: 'healthy',
    service: 'MCP Auth Proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      mcp_server_url: MCP_SERVER_URL,
      mcp_auth_token_configured: !!MCP_AUTH_TOKEN,
      ...stats
    }
  });
});

/**
 * GET /api/mcp/config
 * Ottieni configurazione RBAC (solo per admin/debug)
 *
 * Richiede autenticazione
 */
router.get('/mcp/config', authenticate, (req, res) => {
  // Solo HR_MANAGER e SUPER_ADMIN possono vedere config
  if (!['HR_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only HR_MANAGER and SUPER_ADMIN can access configuration'
    });
  }

  const stats = getConfigStats();

  res.json({
    ...stats,
    user: {
      userId: req.user.userId,
      role: req.user.role,
      tenantId: req.user.tenantId
    }
  });
});

/**
 * POST /api/mcp/reload-config
 * Ricarica configurazione RBAC senza restart server
 *
 * Richiede autenticazione SUPER_ADMIN
 */
router.post('/mcp/reload-config', authenticate, (req, res) => {
  // Solo SUPER_ADMIN può ricaricare config
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only SUPER_ADMIN can reload configuration'
    });
  }

  try {
    const { reloadConfig } = require('../config/mcpRbacRules');
    reloadConfig();

    res.json({
      success: true,
      message: 'Configuration reloaded successfully',
      timestamp: new Date().toISOString(),
      stats: getConfigStats()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reload configuration',
      message: error.message
    });
  }
});

module.exports = router;
