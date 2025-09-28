/**
 * Application Roles Constants
 * @module constants/roles
 * @created 2025-09-28
 *
 * Defines application roles for permission management.
 * These roles determine what users can do in the application.
 * Stored in: tenant_users.role field
 */

const APPLICATION_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',  // Global system administrator
  ADMIN: 'ADMIN',               // Tenant administrator
  HR_MANAGER: 'HR_MANAGER',     // HR senior manager
  HR: 'HR',                     // HR operator
  SALES: 'SALES',               // Sales/Commercial manager
  MANAGER: 'MANAGER',           // Team manager/lead
  EMPLOYEE: 'EMPLOYEE',         // Standard employee
  VIEWER: 'VIEWER'              // Read-only access
};

// Numerical hierarchy for permission comparison
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 7,
  ADMIN: 6,
  HR_MANAGER: 5,
  SALES: 5,       // Same level as HR_MANAGER but sales focus
  HR: 4,
  MANAGER: 4,      // Same level as HR but different permissions
  EMPLOYEE: 2,
  VIEWER: 1
};

// Role groups for common permission patterns
const ROLE_GROUPS = {
  // Can manage system configurations
  SYSTEM_ADMINS: ['SUPER_ADMIN'],

  // Can manage tenant configurations
  TENANT_ADMINS: ['SUPER_ADMIN', 'ADMIN'],

  // Can manage HR functions
  HR_ROLES: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR'],

  // Can manage projects and resources
  PROJECT_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'SALES', 'MANAGER'],

  // Can search employees by skills/roles
  CAN_SEARCH_EMPLOYEES: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR', 'SALES'],

  // Can create and manage projects
  CAN_CREATE_PROJECTS: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'SALES'],

  // Can delete critical resources
  CAN_DELETE: ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'],

  // All authenticated users
  ALL_AUTHENTICATED: Object.keys(APPLICATION_ROLES)
};

/**
 * Check if a user role has access to required roles
 * @param {string} userRole - The user's current role
 * @param {string[]} requiredRoles - Array of allowed roles
 * @returns {boolean} - True if user has access
 */
const canAccess = (userRole, requiredRoles) => {
  if (!userRole || !requiredRoles) return false;

  // Normalize to uppercase for consistency
  const normalizedUserRole = userRole.toUpperCase();
  const normalizedRequired = requiredRoles.map(r => r.toUpperCase());

  return normalizedRequired.includes(normalizedUserRole);
};

/**
 * Check if a role is hierarchically higher or equal to another
 * @param {string} userRole - The user's role
 * @param {string} targetRole - The role to compare against
 * @returns {boolean} - True if userRole >= targetRole in hierarchy
 */
const isHigherOrEqual = (userRole, targetRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return userLevel >= targetLevel;
};

/**
 * Get all roles that are hierarchically below a given role
 * @param {string} role - The reference role
 * @returns {string[]} - Array of subordinate roles
 */
const getSubordinateRoles = (role) => {
  const roleLevel = ROLE_HIERARCHY[role] || 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([_, level]) => level < roleLevel)
    .map(([roleName]) => roleName);
};

/**
 * Normalize role string to standard format
 * @param {string} role - Raw role string
 * @returns {string} - Normalized role or EMPLOYEE as default
 */
const normalizeRole = (role) => {
  if (!role) return APPLICATION_ROLES.EMPLOYEE;

  const upperRole = role.toUpperCase();

  // Handle common variations
  const mappings = {
    'SUPER_ADMIN': APPLICATION_ROLES.SUPER_ADMIN,
    'SUPERADMIN': APPLICATION_ROLES.SUPER_ADMIN,
    'ADMIN': APPLICATION_ROLES.ADMIN,
    'ADMINISTRATOR': APPLICATION_ROLES.ADMIN,
    'HR_MANAGER': APPLICATION_ROLES.HR_MANAGER,
    'HRMANAGER': APPLICATION_ROLES.HR_MANAGER,
    'HR': APPLICATION_ROLES.HR,
    'HUMAN_RESOURCES': APPLICATION_ROLES.HR,
    'SALES': APPLICATION_ROLES.SALES,
    'COMMERCIAL': APPLICATION_ROLES.SALES,
    'SALES_MANAGER': APPLICATION_ROLES.SALES,
    'MANAGER': APPLICATION_ROLES.MANAGER,
    'TEAM_LEAD': APPLICATION_ROLES.MANAGER,
    'EMPLOYEE': APPLICATION_ROLES.EMPLOYEE,
    'USER': APPLICATION_ROLES.EMPLOYEE,
    'VIEWER': APPLICATION_ROLES.VIEWER,
    'READONLY': APPLICATION_ROLES.VIEWER
  };

  return mappings[upperRole] || APPLICATION_ROLES.EMPLOYEE;
};

module.exports = {
  APPLICATION_ROLES,
  ROLE_HIERARCHY,
  ROLE_GROUPS,
  canAccess,
  isHigherOrEqual,
  getSubordinateRoles,
  normalizeRole
};