// Refactored roleController.js - 27/09/2025 11:45
// Compliant with Giurelli Standards: max 50 lines per function, max 500 lines per file

const prisma = require('../../config/database');
const { projectRoleMessages } = require('../../utils/messages');

// Constants
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MIN_SKILL_COUNT = 0;
const MAX_SKILL_COUNT = 20;

// Helper Functions

/**
 * Validates project role input data
 * @param {Object} data - Role data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateRoleInput(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.projectId !== undefined) {
    if (!data.projectId) {
      errors.push('Project ID is required');
    }
  }

  if (!isUpdate || data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    } else if (data.title.length > 200) {
      errors.push('Title must be less than 200 characters');
    }
  }

  if (data.requiredCount !== undefined) {
    const count = parseInt(data.requiredCount);
    if (isNaN(count) || count < 1) {
      errors.push('Required count must be a positive number');
    }
  }

  if (data.skills && !Array.isArray(data.skills)) {
    errors.push('Skills must be an array');
  } else if (data.skills) {
    if (data.skills.length > MAX_SKILL_COUNT) {
      errors.push(`Maximum ${MAX_SKILL_COUNT} skills allowed`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds role data object for database operations
 * @param {Object} data - Input data
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Formatted role data
 */
function buildRoleData(data, isUpdate = false) {
  const roleData = {};

  if (!isUpdate || data.projectId !== undefined) {
    roleData.projectId = parseInt(data.projectId);
  }

  if (!isUpdate || data.title !== undefined) {
    roleData.title = data.title.trim();
  }

  if (data.description !== undefined) {
    roleData.description = data.description ? data.description.trim() : null;
  }

  if (data.requiredCount !== undefined) {
    roleData.requiredCount = parseInt(data.requiredCount) || 1;
  }

  if (data.experienceLevel !== undefined) {
    roleData.experienceLevel = data.experienceLevel;
  }

  if (data.startDate !== undefined) {
    roleData.startDate = data.startDate ? new Date(data.startDate) : null;
  }

  if (data.endDate !== undefined) {
    roleData.endDate = data.endDate ? new Date(data.endDate) : null;
  }

  if (data.status !== undefined) {
    roleData.status = data.status || 'open';
  }

  return roleData;
}

/**
 * Creates skill connections for a role
 * @param {number} roleId - Role ID
 * @param {Array} skills - Array of skill data
 * @param {Object} transaction - Prisma transaction object
 * @returns {Promise} Result of skill creation
 */
async function createRoleSkills(roleId, skills, transaction) {
  if (!skills || skills.length === 0) return;

  const skillData = skills.map(skill => ({
    projectRoleId: roleId,
    skillId: skill.skillId,
    proficiencyLevel: skill.proficiencyLevel || 'intermediate',
    isRequired: skill.isRequired !== undefined ? skill.isRequired : true
  }));

  return transaction.projectRoleSkill.createMany({
    data: skillData,
    skipDuplicates: true
  });
}

/**
 * Updates skills for a role
 * @param {number} roleId - Role ID
 * @param {Array} skills - Array of skill data
 * @param {Object} transaction - Prisma transaction object
 */
async function updateRoleSkills(roleId, skills, transaction) {
  // Remove existing skills
  await transaction.projectRoleSkill.deleteMany({
    where: { projectRoleId: roleId }
  });

  // Add new skills
  await createRoleSkills(roleId, skills, transaction);
}

/**
 * Formats role response with relations
 * @param {Object} role - Role data from database
 * @returns {Object} Formatted role response
 */
function formatRoleResponse(role) {
  if (!role) return null;

  return {
    ...role,
    skills: role.skills?.map(rs => ({
      id: rs.skill.id,
      name: rs.skill.name,
      proficiencyLevel: rs.proficiencyLevel,
      isRequired: rs.isRequired
    })) || [],
    _count: {
      skills: role.skills?.length || 0,
      matches: role.matches?.length || 0
    }
  };
}

/**
 * Standard error response handler
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} operation - Operation name for logging
 */
function handleError(res, error, operation) {
  console.error(`[RoleController] Error in ${operation}:`, error);

  if (error.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A role with this title already exists for this project'
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: projectRoleMessages.error.notFound || 'Role not found'
    });
  }

  res.status(500).json({
    success: false,
    message: projectRoleMessages.error.createFailed || 'Operation failed'
  });
}

/**
 * Gets role include options for Prisma queries
 * @returns {Object} Include configuration for Prisma
 */
function getRoleInclude() {
  return {
    project: {
      select: { id: true, name: true, status: true }
    },
    skills: {
      include: {
        skill: { select: { id: true, name: true } }
      }
    },
    matches: { select: { id: true } }
  };
}

/**
 * Validates role ID parameter
 * @param {string} id - ID to validate
 * @returns {Object} Validation result
 */
function validateRoleId(id) {
  const roleId = parseInt(id);
  if (isNaN(roleId)) {
    return { isValid: false, error: 'Invalid role ID' };
  }
  return { isValid: true, value: roleId };
}

// Controller object
const roleController = {
  /**
   * Creates a new project role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON response with created role
   */
  async createProjectRole(req, res) {
    try {
      // Validate input
      const validation = validateRoleInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Build role data
      const roleData = buildRoleData(req.body);

      // Execute transaction
      const role = await prisma.$transaction(async (tx) => {
        // Create the role
        const newRole = await tx.projectRole.create({
          data: roleData
        });

        // Add skills if provided
        await createRoleSkills(newRole.id, req.body.skills, tx);

        // Fetch complete role
        return await tx.projectRole.findUnique({
          where: { id: newRole.id },
          include: getRoleInclude()
        });
      });

      res.status(201).json({
        success: true,
        message: projectRoleMessages.success.created,
        data: formatRoleResponse(role)
      });
    } catch (error) {
      handleError(res, error, 'createProjectRole');
    }
  },

  /**
   * Updates an existing project role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON response with updated role
   */
  async updateProjectRole(req, res) {
    try {
      // Validate role ID
      const idValidation = validateRoleId(req.params.id);
      if (!idValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: idValidation.error
        });
      }

      // Validate input
      const validation = validateRoleInput(req.body, true);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        });
      }

      // Build update data
      const updateData = buildRoleData(req.body, true);

      // Execute transaction
      const role = await prisma.$transaction(async (tx) => {
        // Update the role
        const updatedRole = await tx.projectRole.update({
          where: { id: idValidation.value },
          data: updateData
        });

        // Update skills if provided
        if (req.body.skills !== undefined) {
          await updateRoleSkills(updatedRole.id, req.body.skills, tx);
        }

        // Fetch complete role
        return await tx.projectRole.findUnique({
          where: { id: updatedRole.id },
          include: getRoleInclude()
        });
      });

      res.json({
        success: true,
        message: projectRoleMessages.success.updated,
        data: formatRoleResponse(role)
      });
    } catch (error) {
      handleError(res, error, 'updateProjectRole');
    }
  },

  /**
   * Gets all project roles with pagination and filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON response with roles list
   */
  async getProjectRoles(req, res) {
    try {
      const page = parseInt(req.query.page) || DEFAULT_PAGE;
      const limit = Math.min(
        parseInt(req.query.limit) || DEFAULT_LIMIT,
        MAX_LIMIT
      );
      const { projectId, status } = req.query;

      // Build filter
      const where = {};
      if (projectId) where.projectId = parseInt(projectId);
      if (status) where.status = status;

      // Execute queries
      const [roles, total] = await prisma.$transaction([
        prisma.projectRole.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: getRoleInclude(),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.projectRole.count({ where })
      ]);

      res.json({
        success: true,
        message: projectRoleMessages.success.fetched,
        data: {
          roles: roles.map(formatRoleResponse),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      handleError(res, error, 'getProjectRoles');
    }
  },

  /**
   * Gets a single project role by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON response with role details
   */
  async getProjectRoleById(req, res) {
    try {
      // Validate role ID
      const idValidation = validateRoleId(req.params.id);
      if (!idValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: idValidation.error
        });
      }

      const role = await prisma.projectRole.findUnique({
        where: { id: idValidation.value },
        include: getRoleInclude()
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: projectRoleMessages.error.notFound
        });
      }

      res.json({
        success: true,
        message: projectRoleMessages.success.fetched,
        data: formatRoleResponse(role)
      });
    } catch (error) {
      handleError(res, error, 'getProjectRoleById');
    }
  },

  /**
   * Deletes a project role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON response confirming deletion
   */
  async deleteProjectRole(req, res) {
    try {
      // Validate role ID
      const idValidation = validateRoleId(req.params.id);
      if (!idValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: idValidation.error
        });
      }

      // Check if role has matches
      const roleWithMatches = await prisma.projectRole.findUnique({
        where: { id: idValidation.value },
        select: {
          id: true,
          matches: { select: { id: true } }
        }
      });

      if (!roleWithMatches) {
        return res.status(404).json({
          success: false,
          message: projectRoleMessages.error.notFound
        });
      }

      if (roleWithMatches.matches?.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete role with existing matches'
        });
      }

      // Delete role (skills will be cascade deleted)
      await prisma.projectRole.delete({
        where: { id: idValidation.value }
      });

      res.json({
        success: true,
        message: projectRoleMessages.success.deleted
      });
    } catch (error) {
      handleError(res, error, 'deleteProjectRole');
    }
  },

  /**
   * Gets available skills for project roles
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} JSON response with skills list
   */
  async getAvailableSkills(req, res) {
    try {
      const { search, limit = 50 } = req.query;

      // Build where clause
      const where = search ? {
        name: {
          contains: search,
          mode: 'insensitive'
        }
      } : {};

      const skills = await prisma.skill.findMany({
        where,
        take: Math.min(parseInt(limit) || 50, MAX_LIMIT),
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          category: true
        }
      });

      res.json({
        success: true,
        message: 'Skills fetched successfully',
        data: skills
      });
    } catch (error) {
      handleError(res, error, 'getAvailableSkills');
    }
  }
};

module.exports = roleController;