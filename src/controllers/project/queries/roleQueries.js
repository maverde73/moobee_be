/**
 * Role Database Queries
 * @module controllers/project/queries/roleQueries
 * @created 2025-09-27 19:32
 *
 * Database query functions for role operations
 */

const prisma = require('../../../config/database');

/**
 * Get standard include options for role queries
 * @param {boolean} includeAll - Whether to include all relations
 * @returns {Object} Prisma include options
 */
function getRoleIncludeOptions(includeAll = false) {
  const base = {
    projects: {
      select: {
        id: true,
        project_name: true,
        project_code: true,
        status: true
      }
    }
  };

  if (includeAll) {
    return {
      ...base,
      sub_role: true,
      project_matching_results: {
        take: 5,
        orderBy: { match_score: 'desc' }
      }
    };
  }

  return {
    ...base,
    sub_role: true
  };
}

/**
 * Build where clause for role queries
 * @param {Object} filters - Filter parameters
 * @returns {Object} Prisma where clause
 */
function buildRoleWhereClause(filters) {
  const where = {};

  if (filters.projectId) {
    where.project_id = parseInt(filters.projectId);
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { role_code: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.seniority) {
    where.seniority = filters.seniority;
  }

  if (filters.work_mode) {
    where.work_mode = filters.work_mode;
  }

  if (filters.is_urgent !== undefined) {
    where.is_urgent = filters.is_urgent;
  }

  if (filters.is_critical !== undefined) {
    where.is_critical = filters.is_critical;
  }

  if (filters.is_billable !== undefined) {
    where.is_billable = filters.is_billable;
  }

  if (filters.sub_role_id) {
    where.sub_role_id = parseInt(filters.sub_role_id);
  }

  if (filters.role_id) {
    where.role_id = parseInt(filters.role_id);
  }

  return where;
}

/**
 * Create a new role in database
 * @param {Object} roleData - Role data
 * @returns {Promise<Object>} Created role
 */
async function createRole(roleData) {
  return await prisma.project_roles.create({
    data: roleData,
    include: getRoleIncludeOptions(true)
  });
}

/**
 * Update a role in database
 * @param {string} roleId - Role ID
 * @param {Object} roleData - Updated role data
 * @returns {Promise<Object>} Updated role
 */
async function updateRole(roleId, roleData) {
  return await prisma.project_roles.update({
    where: { id: roleId },
    data: roleData,
    include: getRoleIncludeOptions(true)
  });
}

/**
 * Get a single role by ID
 * @param {string} roleId - Role ID
 * @param {boolean} includeAll - Include all relations
 * @returns {Promise<Object|null>} Role or null
 */
async function getRoleById(roleId, includeAll = false) {
  return await prisma.project_roles.findUnique({
    where: { id: roleId },
    include: getRoleIncludeOptions(includeAll)
  });
}

/**
 * Get roles with pagination
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Paginated results
 */
async function getRolesWithPagination(params) {
  const { where, skip, limit, orderBy } = params;

  const [roles, total] = await prisma.$transaction([
    prisma.project_roles.findMany({
      where,
      skip,
      take: limit,
      orderBy: orderBy || { created_at: 'desc' },
      include: getRoleIncludeOptions(false)
    }),
    prisma.project_roles.count({ where })
  ]);

  return { roles, total };
}

/**
 * Delete a role
 * @param {string} roleId - Role ID
 * @returns {Promise<Object>} Deleted role
 */
async function deleteRole(roleId) {
  // The schema has CASCADE delete for project_matching_results,
  // so we don't need to manually delete related records.
  // project_assignments doesn't have a direct relation to project_roles.

  // Simply delete the role - CASCADE will handle related records
  return await prisma.project_roles.delete({
    where: { id: roleId }
  });
}

/**
 * Check if a role exists
 * @param {string} roleId - Role ID
 * @returns {Promise<boolean>} True if role exists
 */
async function roleExists(roleId) {
  const count = await prisma.project_roles.count({
    where: { id: roleId }
  });
  return count > 0;
}

/**
 * Get role statistics for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<Object>} Statistics
 */
async function getRoleStatistics(projectId) {
  const stats = await prisma.project_roles.groupBy({
    by: ['status'],
    where: { project_id: projectId },
    _count: {
      id: true
    }
  });

  const totalRoles = await prisma.project_roles.count({
    where: { project_id: projectId }
  });

  const urgentRoles = await prisma.project_roles.count({
    where: {
      project_id: projectId,
      is_urgent: true
    }
  });

  const criticalRoles = await prisma.project_roles.count({
    where: {
      project_id: projectId,
      is_critical: true
    }
  });

  return {
    total: totalRoles,
    byStatus: stats.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {}),
    urgent: urgentRoles,
    critical: criticalRoles
  };
}

/**
 * Duplicate a role
 * @param {string} roleId - Role ID to duplicate
 * @param {Object} overrides - Fields to override
 * @returns {Promise<Object>} New duplicated role
 */
async function duplicateRole(roleId, overrides = {}) {
  const original = await getRoleById(roleId, false);
  if (!original) {
    throw new Error('Role not found');
  }

  // Remove fields that shouldn't be duplicated
  const { id, created_at, updated_at, ...roleData } = original;

  // Apply overrides and defaults
  const newRoleData = {
    ...roleData,
    ...overrides,
    role_code: `ROLE_${Date.now()}`,
    status: 'DRAFT',
    created_at: new Date(),
    updated_at: new Date()
  };

  return await createRole(newRoleData);
}

/**
 * Batch update role statuses
 * @param {Array<string>} roleIds - Array of role IDs
 * @param {string} status - New status
 * @returns {Promise<number>} Count of updated roles
 */
async function batchUpdateStatus(roleIds, status) {
  const result = await prisma.project_roles.updateMany({
    where: {
      id: { in: roleIds }
    },
    data: {
      status,
      updated_at: new Date()
    }
  });

  return result.count;
}

/**
 * Get roles by skills
 * @param {Array<string>} skills - Array of skill names
 * @param {number} projectId - Optional project filter
 * @returns {Promise<Array>} Matching roles
 */
async function getRolesBySkills(skills, projectId = null) {
  const where = {
    OR: [
      {
        hard_skills: {
          hasSome: skills
        }
      },
      {
        soft_skills: {
          hasSome: skills
        }
      }
    ]
  };

  if (projectId) {
    where.project_id = projectId;
  }

  return await prisma.project_roles.findMany({
    where,
    include: getRoleIncludeOptions(false)
  });
}

module.exports = {
  getRoleIncludeOptions,
  buildRoleWhereClause,
  createRole,
  updateRole,
  getRoleById,
  getRolesWithPagination,
  deleteRole,
  roleExists,
  getRoleStatistics,
  duplicateRole,
  batchUpdateStatus,
  getRolesBySkills
};