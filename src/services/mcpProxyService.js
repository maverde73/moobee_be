/**
 * MCP Proxy Service
 *
 * Gestisce la trasformazione delle query MCP con:
 * - Tenant isolation filtering
 * - Role-based access control (RBAC)
 * - Employee-specific data filtering
 */

const {
  canAccessTable,
  hasTenantId,
  getDataFilters,
  getFilteringStrategy,
  isTenantFilteringEnabled
} = require('../config/mcpRbacRules');

/**
 * Inietta filtri tenant nella query in base al ruolo utente
 *
 * @param {Object} query - Query JSON object
 * @param {Object} userContext - Context utente (userId, tenantId, role, employeeId)
 * @returns {Object} - Query filtrata
 * @throws {Error} - Se l'utente non ha permessi per la tabella
 */
function injectTenantFilters(query, userContext) {
  const { userId, tenantId, role, employeeId } = userContext;
  const table = query.table || query.from;

  if (!table) {
    throw new Error('Query must specify "table" or "from" field');
  }

  // 1. Verifica RBAC - l'utente può accedere a questa tabella?
  if (!canAccessTable(role, table)) {
    throw new Error(`Role '${role}' cannot access table '${table}'`);
  }

  // 2. Se tenant filtering è disabilitato per questo ruolo, ritorna query non modificata
  // (es. SUPER_ADMIN ha accesso cross-tenant)
  if (!isTenantFilteringEnabled(role)) {
    return query;
  }

  // 3. Se la tabella non ha tenant_id, ritorna query non modificata
  // (tabelle shared come skills, roles, etc.)
  if (!hasTenantId(table)) {
    return query;
  }

  // 4. Applica strategia di filtering in base al ruolo
  const strategy = getFilteringStrategy(role);
  const existingWhere = query.where || {};

  if (strategy === 'employee_only' && role === 'EMPLOYEE') {
    // Strategia EMPLOYEE: Vede solo i propri dati
    return applyEmployeeFilters(query, userContext);
  } else if (strategy === 'tenant_only') {
    // Strategia HR_MANAGER/PM: Vedono tutto il tenant
    query.where = {
      ...existingWhere,
      tenant_id: tenantId
    };
  }

  return query;
}

/**
 * Applica filtri specifici per ruolo EMPLOYEE
 *
 * @param {Object} query - Query JSON object
 * @param {Object} userContext - Context utente
 * @returns {Object} - Query filtrata
 */
function applyEmployeeFilters(query, userContext) {
  const { employeeId, tenantId } = userContext;
  const table = query.table || query.from;
  const existingWhere = query.where || {};

  // Ottieni filtri specifici dalla configurazione
  const dataFilters = getDataFilters('EMPLOYEE', table);

  if (dataFilters) {
    // Applica filtri dalla configurazione JSON
    const filterWhere = { ...dataFilters.where };

    // Sostituisci placeholder con valori reali
    Object.keys(filterWhere).forEach(key => {
      const value = filterWhere[key];
      if (typeof value === 'string') {
        filterWhere[key] = value
          .replace('{{employee_id}}', employeeId)
          .replace('{{tenant_id}}', tenantId);
      } else if (value === '{{employee_id}}') {
        filterWhere[key] = employeeId;
      } else if (value === '{{tenant_id}}') {
        filterWhere[key] = tenantId;
      }
    });

    query.where = {
      ...existingWhere,
      ...filterWhere
    };

    // Aggiungi whereRaw se presente
    if (dataFilters.whereRaw) {
      query.whereRaw = dataFilters.whereRaw
        .replace(/{{employee_id}}/g, employeeId)
        .replace(/{{tenant_id}}/g, tenantId);
    }
  } else {
    // Fallback: Filtri di default se non specificati in config
    applyDefaultEmployeeFilters(query, userContext);
  }

  return query;
}

/**
 * Applica filtri di default per EMPLOYEE (fallback)
 *
 * @param {Object} query - Query JSON object
 * @param {Object} userContext - Context utente
 */
function applyDefaultEmployeeFilters(query, userContext) {
  const { employeeId, tenantId } = userContext;
  const table = query.table || query.from;
  const existingWhere = query.where || {};

  if (table === 'employees') {
    // Solo il proprio record employee
    query.where = {
      ...existingWhere,
      id: employeeId,
      tenant_id: tenantId
    };
  } else if (table.startsWith('employee_')) {
    // employee_skills, employee_education, etc. - solo propri dati
    query.where = {
      ...existingWhere,
      employee_id: employeeId,
      tenant_id: tenantId
    };
  } else if (table === 'projects') {
    // Solo progetti dove è assegnato
    query.where = {
      ...existingWhere,
      tenant_id: tenantId
    };
    query.whereRaw = `id IN (
      SELECT project_id
      FROM project_assignments
      WHERE employee_id = ${employeeId}
    )`;
  } else if (table === 'project_assignments') {
    // Vede assegnazioni di colleghi nei progetti dove è assegnato
    query.whereRaw = `project_id IN (
      SELECT project_id
      FROM project_assignments
      WHERE employee_id = ${employeeId}
    )`;
  } else {
    // Default: filtro tenant_id
    query.where = {
      ...existingWhere,
      tenant_id: tenantId
    };
  }
}

/**
 * Trasforma request MCP per iniettare filtri
 *
 * @param {Object} requestBody - Request body MCP (JSON-RPC)
 * @param {Object} userContext - Context utente
 * @returns {Object} - Request body modificato
 */
function transformMCPRequest(requestBody, userContext) {
  // Solo per execute_query tool
  if (
    requestBody.method === 'tools/call' &&
    requestBody.params?.name === 'execute_query'
  ) {
    const jsonQuery = requestBody.params.arguments.json_query;

    try {
      const queryObj = JSON.parse(jsonQuery);

      // Inietta filtri
      const filteredQuery = injectTenantFilters(queryObj, userContext);

      // Aggiorna request body
      requestBody.params.arguments.json_query = JSON.stringify(filteredQuery);
    } catch (error) {
      // Se parsing fallisce, lancia errore
      throw new Error(`Invalid JSON query: ${error.message}`);
    }
  }

  // Altri metodi MCP (get_table_details, resources/list, etc.) passano inalterati
  return requestBody;
}

/**
 * Valida user context prima della trasformazione
 *
 * @param {Object} userContext - Context utente
 * @throws {Error} - Se user context è invalido
 */
function validateUserContext(userContext) {
  const required = ['userId', 'tenantId', 'role'];

  required.forEach(field => {
    if (!userContext[field]) {
      throw new Error(`Missing required field in user context: ${field}`);
    }
  });

  // Employee DEVE avere employeeId
  if (userContext.role === 'EMPLOYEE' && !userContext.employeeId) {
    throw new Error('Employee role requires employeeId in user context');
  }
}

/**
 * Log trasformazione query (per audit)
 *
 * @param {Object} originalQuery - Query originale
 * @param {Object} filteredQuery - Query filtrata
 * @param {Object} userContext - Context utente
 */
function logQueryTransformation(originalQuery, filteredQuery, userContext) {
  console.log('🔍 MCP Query Transformation:', {
    user: {
      userId: userContext.userId,
      role: userContext.role,
      tenantId: userContext.tenantId
    },
    table: originalQuery.table || originalQuery.from,
    filters_added: {
      where: filteredQuery.where !== originalQuery.where,
      whereRaw: !!filteredQuery.whereRaw
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  injectTenantFilters,
  transformMCPRequest,
  validateUserContext,
  logQueryTransformation
};
