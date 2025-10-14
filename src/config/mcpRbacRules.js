/**
 * MCP RBAC Rules Configuration Loader
 *
 * Carica regole RBAC e definizioni tabelle da file JSON configurabili.
 * Permette hot-reload delle configurazioni senza restart del server.
 */

const fs = require('fs');
const path = require('path');

// Paths ai file di configurazione
const TABLES_CONFIG_PATH = path.join(__dirname, '../../config/mcp-tables.json');
const RBAC_CONFIG_PATH = path.join(__dirname, '../../config/mcp-rbac-rules.json');

// Cache delle configurazioni
let tablesConfig = null;
let rbacConfig = null;
let lastLoadTime = null;

/**
 * Carica configurazione tabelle da JSON
 */
function loadTablesConfig() {
  try {
    const rawData = fs.readFileSync(TABLES_CONFIG_PATH, 'utf8');
    tablesConfig = JSON.parse(rawData);
    console.log('✅ MCP Tables config loaded:', {
      tenant_tables: tablesConfig.tenant_tables.tables.length,
      shared_tables: tablesConfig.shared_tables.tables.length
    });
    return tablesConfig;
  } catch (error) {
    console.error('❌ Error loading tables config:', error.message);
    throw new Error(`Failed to load mcp-tables.json: ${error.message}`);
  }
}

/**
 * Carica configurazione RBAC da JSON
 */
function loadRbacConfig() {
  try {
    const rawData = fs.readFileSync(RBAC_CONFIG_PATH, 'utf8');
    rbacConfig = JSON.parse(rawData);
    console.log('✅ MCP RBAC config loaded:', {
      roles: Object.keys(rbacConfig.roles).join(', ')
    });
    return rbacConfig;
  } catch (error) {
    console.error('❌ Error loading RBAC config:', error.message);
    throw new Error(`Failed to load mcp-rbac-rules.json: ${error.message}`);
  }
}

/**
 * Inizializza configurazioni (chiamare all'avvio del server)
 */
function initializeConfig() {
  loadTablesConfig();
  loadRbacConfig();
  lastLoadTime = Date.now();
}

/**
 * Reload configurazioni (per hot-reload senza restart)
 */
function reloadConfig() {
  console.log('🔄 Reloading MCP configuration...');
  loadTablesConfig();
  loadRbacConfig();
  lastLoadTime = Date.now();
}

/**
 * Verifica se una tabella ha tenant_id
 */
function hasTenantId(tableName) {
  if (!tablesConfig) loadTablesConfig();
  return tablesConfig.tenant_tables.tables.includes(tableName);
}

/**
 * Verifica se una tabella è condivisa (shared)
 */
function isSharedTable(tableName) {
  if (!tablesConfig) loadTablesConfig();
  return tablesConfig.shared_tables.tables.includes(tableName);
}

/**
 * Ottieni lista completa tabelle tenant
 */
function getTenantTables() {
  if (!tablesConfig) loadTablesConfig();
  return tablesConfig.tenant_tables.tables;
}

/**
 * Ottieni lista completa tabelle shared
 */
function getSharedTables() {
  if (!tablesConfig) loadTablesConfig();
  return tablesConfig.shared_tables.tables;
}

/**
 * Ottieni regole per un ruolo specifico
 */
function getRoleRules(role) {
  if (!rbacConfig) loadRbacConfig();
  return rbacConfig.roles[role] || rbacConfig.roles[rbacConfig.default_role];
}

/**
 * Verifica se un ruolo può accedere a una tabella
 */
function canAccessTable(role, tableName) {
  if (!rbacConfig) loadRbacConfig();

  const rules = rbacConfig.roles[role];

  if (!rules) {
    console.warn(`⚠️  Unknown role: ${role}, using default role: ${rbacConfig.default_role}`);
    return canAccessTable(rbacConfig.default_role, tableName);
  }

  // Check forbidden tables first
  if (rules.forbidden_tables.includes(tableName)) {
    return false;
  }

  // Check allowed tables
  if (rules.allowed_tables === '*') {
    return true; // Full access (HR_MANAGER, SUPER_ADMIN)
  }

  // Check if table is in allowed list
  if (rules.allowed_tables.includes(tableName)) {
    return true;
  }

  // Check if "_shared_tables_" is in allowed and table is shared
  if (rules.allowed_tables.includes('_shared_tables_') && isSharedTable(tableName)) {
    return true;
  }

  return false;
}

/**
 * Ottieni filtri dati per un ruolo e tabella specifica (solo EMPLOYEE)
 */
function getDataFilters(role, tableName) {
  if (!rbacConfig) loadRbacConfig();

  const rules = rbacConfig.roles[role];

  if (!rules || !rules.data_filters) {
    return null;
  }

  return rules.data_filters[tableName] || null;
}

/**
 * Verifica se tenant filtering è abilitato per un ruolo
 */
function isTenantFilteringEnabled(role) {
  if (!rbacConfig) loadRbacConfig();

  const rules = rbacConfig.roles[role];
  return rules?.tenant_filtering?.enabled ?? true; // Default: enabled
}

/**
 * Ottieni strategia di filtering per un ruolo
 */
function getFilteringStrategy(role) {
  if (!rbacConfig) loadRbacConfig();

  const rules = rbacConfig.roles[role];
  return rules?.tenant_filtering?.strategy || 'tenant_only';
}

/**
 * Verifica permessi speciali
 */
function hasSpecialPermission(role, permission) {
  if (!rbacConfig) loadRbacConfig();

  const rules = rbacConfig.roles[role];
  return rules?.special_permissions?.[permission] ?? false;
}

/**
 * Ottieni operazioni permesse per un ruolo
 */
function getAllowedOperations(role) {
  if (!rbacConfig) loadRbacConfig();

  const rules = rbacConfig.roles[role];
  return rules?.allowed_operations || ['SELECT'];
}

/**
 * Statistiche configurazione
 */
function getConfigStats() {
  if (!tablesConfig || !rbacConfig) {
    initializeConfig();
  }

  return {
    last_load_time: lastLoadTime ? new Date(lastLoadTime).toISOString() : null,
    tables: {
      tenant_tables: tablesConfig.tenant_tables.tables.length,
      shared_tables: tablesConfig.shared_tables.tables.length,
      total: tablesConfig.tenant_tables.tables.length + tablesConfig.shared_tables.tables.length
    },
    roles: {
      defined: Object.keys(rbacConfig.roles).length,
      names: Object.keys(rbacConfig.roles),
      default_role: rbacConfig.default_role
    },
    config_files: {
      tables: TABLES_CONFIG_PATH,
      rbac: RBAC_CONFIG_PATH
    }
  };
}

// Export tutte le funzioni
module.exports = {
  // Initialization
  initializeConfig,
  reloadConfig,

  // Table checks
  hasTenantId,
  isSharedTable,
  getTenantTables,
  getSharedTables,

  // RBAC checks
  getRoleRules,
  canAccessTable,
  getDataFilters,
  isTenantFilteringEnabled,
  getFilteringStrategy,
  hasSpecialPermission,
  getAllowedOperations,

  // Stats
  getConfigStats,

  // Direct access (use with caution)
  get tablesConfig() { return tablesConfig || loadTablesConfig(); },
  get rbacConfig() { return rbacConfig || loadRbacConfig(); }
};
