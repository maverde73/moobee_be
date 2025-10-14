/**
 * MCP Auth Middleware
 *
 * Middleware Express che:
 * 1. Estrae user context da req.user (popolato da authenticateToken)
 * 2. Trasforma request MCP con tenant filtering
 * 3. Gestisce errori RBAC
 */

const {
  transformMCPRequest,
  validateUserContext,
  logQueryTransformation
} = require('../services/mcpProxyService');
const prisma = require('../config/database');

/**
 * Ottieni employee_id per un user_id
 *
 * @param {number} userId - ID utente
 * @returns {Promise<number|null>} - ID employee o null
 */
async function getEmployeeIdForUser(userId) {
  try {
    // Query tenant_users per trovare employee_id
    const tenantUser = await prisma.tenant_users.findFirst({
      where: { user_id: userId },
      select: { employee_id: true }
    });

    return tenantUser?.employee_id || null;
  } catch (error) {
    console.error('Error fetching employee_id:', error);
    return null;
  }
}

/**
 * Middleware principale MCP Auth
 */
async function mcpAuthMiddleware(req, res, next) {
  try {
    // 1. User context già disponibile da authenticateToken middleware
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User context not found. Ensure authenticateToken middleware runs first.'
      });
    }

    const { userId, tenantId, role } = req.user;

    // 2. Per ruolo EMPLOYEE, recupera employee_id
    let employeeId = null;
    if (role === 'EMPLOYEE') {
      employeeId = await getEmployeeIdForUser(userId);

      if (!employeeId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Employee ID not found for user. Cannot apply employee filters.'
        });
      }
    }

    // 3. Costruisci user context completo
    const userContext = {
      userId,
      tenantId,
      role,
      employeeId
    };

    // 4. Valida user context
    try {
      validateUserContext(userContext);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid User Context',
        message: error.message
      });
    }

    // 5. Salva query originale per logging
    const originalBody = JSON.parse(JSON.stringify(req.body));

    // 6. Trasforma request body con filtri tenant
    try {
      req.body = transformMCPRequest(req.body, userContext);
    } catch (error) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    // 7. Log trasformazione (solo per execute_query)
    if (
      req.body.method === 'tools/call' &&
      req.body.params?.name === 'execute_query'
    ) {
      const originalQuery = JSON.parse(originalBody.params.arguments.json_query);
      const filteredQuery = JSON.parse(req.body.params.arguments.json_query);
      logQueryTransformation(originalQuery, filteredQuery, userContext);
    }

    // 8. Salva userContext in req per uso successivo
    req.mcpContext = userContext;

    next();
  } catch (error) {
    console.error('MCP Auth Middleware Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process MCP authentication'
    });
  }
}

/**
 * Middleware opzionale per audit logging
 */
async function mcpAuditMiddleware(req, res, next) {
  const startTime = Date.now();

  // Intercetta response per loggare risultati
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    const responseTime = Date.now() - startTime;

    // Log audit
    console.log('📊 MCP Audit Log:', {
      user: req.mcpContext ? {
        userId: req.mcpContext.userId,
        role: req.mcpContext.role,
        tenantId: req.mcpContext.tenantId
      } : 'unknown',
      method: req.body?.method,
      tool: req.body?.params?.name,
      response_time_ms: responseTime,
      status: res.statusCode,
      timestamp: new Date().toISOString()
    });

    // Chiama original json()
    return originalJson(data);
  };

  next();
}

module.exports = {
  mcpAuthMiddleware,
  mcpAuditMiddleware,
  getEmployeeIdForUser
};
