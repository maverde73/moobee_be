/**
 * Role Controller - Refactored with Modular Structure
 * @module controllers/project/roleController
 * @updated 2025-09-27 19:36
 *
 * Main controller for project role management
 * Compliant with Giurelli Standards: < 500 lines, modular structure
 */

// Import helpers and utilities
const { buildRoleData, enrichRoleWithSubRole, logActivity, triggerMatching, debugRoleIds, debugCreatedRole } = require('./helpers/roleHelpers');
const { validateRoleInput, validateProjectId, validateRoleId, validatePagination, validateSearchParams, sanitizeInput } = require('./validators/roleValidators');
const { createRole, updateRole, getRoleById, getRolesWithPagination, deleteRole, roleExists, getRoleStatistics, duplicateRole, batchUpdateStatus, buildRoleWhereClause } = require('./queries/roleQueries');
const { formatRoleResponse, formatRoleListResponse, formatErrorResponse, formatSuccessResponse, formatStatisticsResponse } = require('./formatters/roleFormatters');

class RoleController {
  /**
   * Create a new project role
   * POST /api/project-roles
   */
  async createProjectRole(req, res) {
    try {
      console.log('=== Creating project role ===');
      console.log('URL params:', req.params);
      console.log('Request body project_id:', req.body.project_id);
      debugRoleIds(req.body);

      // Get project ID from params or body
      const projectId = req.params.projectId || req.body.project_id;
      console.log('Extracted projectId:', projectId);

      // Validate input
      const validation = validateRoleInput(req.body, false);
      if (!validation.isValid) {
        console.log('Validation failed:', validation.errors);
        return res.status(400).json(formatErrorResponse(validation.errors));
      }

      // Validate project ID
      const projectValidation = validateProjectId(projectId);
      if (!projectValidation.isValid) {
        console.log('Project ID validation failed:', projectValidation.error);
        return res.status(400).json(formatErrorResponse(projectValidation.error));
      }

      console.log('Project ID validated:', projectValidation.id);

      // Sanitize and build role data
      const sanitizedData = sanitizeInput(req.body);
      const roleData = buildRoleData(sanitizedData, projectValidation.id, false);
      console.log('Role data to create:', JSON.stringify(roleData, null, 2));

      // Create role
      const role = await createRole(roleData);

      // Enrich with sub_role data if present
      const enrichedRole = await enrichRoleWithSubRole(role);
      debugCreatedRole(enrichedRole);

      // Log activity
      await logActivity({
        project_id: projectValidation.id,
        activity_type: 'ROLE_CREATED',
        description: `Created role: ${role.title}`,
        user_id: req.user?.id || 'system',
        metadata: { role_id: role.id }
      });

      // Trigger matching if skills are present
      if (roleData.hard_skills?.length || roleData.soft_skills?.length) {
        await triggerMatching(role.id);
      }

      res.status(201).json(formatSuccessResponse(
        formatRoleResponse(enrichedRole),
        'Role created successfully'
      ));

    } catch (error) {
      console.error('Error creating project role:', error);
      res.status(500).json(formatErrorResponse('Failed to create role'));
    }
  }

  /**
   * Update a project role
   * PUT /api/project-roles/:id
   */
  async updateProjectRole(req, res) {
    try {
      const { roleId } = req.params;
      console.log('=== Updating project role ===');
      console.log('Role ID:', roleId);
      debugRoleIds(req.body);

      // Validate role ID
      const roleValidation = validateRoleId(roleId);
      if (!roleValidation.isValid) {
        return res.status(400).json(formatErrorResponse(roleValidation.error));
      }

      // Check if role exists
      const exists = await roleExists(roleValidation.id);
      if (!exists) {
        return res.status(404).json(formatErrorResponse('Role not found', 404));
      }

      // Validate input
      const validation = validateRoleInput(req.body, true);
      if (!validation.isValid) {
        return res.status(400).json(formatErrorResponse(validation.errors));
      }

      // Sanitize and build role data
      const sanitizedData = sanitizeInput(req.body);
      const roleData = buildRoleData(sanitizedData, null, true);

      // Update role
      const updatedRole = await updateRole(roleValidation.id, roleData);

      // Enrich with sub_role data
      const enrichedRole = await enrichRoleWithSubRole(updatedRole);

      // Log activity
      await logActivity({
        project_id: updatedRole.project_id,
        activity_type: 'ROLE_UPDATED',
        description: `Updated role: ${updatedRole.title}`,
        user_id: req.user?.id || 'system',
        metadata: { role_id: updatedRole.id }
      });

      // Trigger re-matching if skills changed
      if (req.body.hard_skills || req.body.soft_skills || req.body.required_skills) {
        await triggerMatching(updatedRole.id);
      }

      res.json(formatSuccessResponse(
        formatRoleResponse(enrichedRole),
        'Role updated successfully'
      ));

    } catch (error) {
      console.error('Error updating project role:', error);
      res.status(500).json(formatErrorResponse('Failed to update role'));
    }
  }

  /**
   * Get all project roles with pagination and filters
   * GET /api/projects/:projectId/roles
   */
  async getProjectRoles(req, res) {
    try {
      // Validate and parse pagination
      const pagination = validatePagination(req.query);

      // Validate and parse search/filter params
      const searchParams = validateSearchParams(req.query);

      // Get projectId from params (required for this route)
      const { projectId } = req.params;
      console.log('Getting roles for project ID:', projectId);

      if (projectId) {
        const projectValidation = validateProjectId(projectId);
        if (projectValidation.isValid) {
          searchParams.projectId = projectValidation.id;
        } else {
          return res.status(400).json(formatErrorResponse('Invalid project ID'));
        }
      }

      // Build where clause
      const where = buildRoleWhereClause(searchParams);

      // Get roles with pagination
      const { roles, total } = await getRolesWithPagination({
        where,
        skip: pagination.skip,
        limit: pagination.limit,
        orderBy: { created_at: 'desc' }
      });

      // Format and return response
      res.json(formatRoleListResponse(
        roles,
        total,
        pagination.page,
        pagination.limit
      ));

    } catch (error) {
      console.error('Error fetching project roles:', error);
      res.status(500).json(formatErrorResponse('Failed to fetch roles'));
    }
  }

  /**
   * Get a single project role
   * GET /api/project-roles/:id
   */
  async getProjectRole(req, res) {
    try {
      const { id } = req.params;

      // Validate role ID
      const roleValidation = validateRoleId(id);
      if (!roleValidation.isValid) {
        return res.status(400).json(formatErrorResponse(roleValidation.error));
      }

      // Get role with full details
      const role = await getRoleById(roleValidation.id, true);

      if (!role) {
        return res.status(404).json(formatErrorResponse('Role not found', 404));
      }

      // Enrich with sub_role data
      const enrichedRole = await enrichRoleWithSubRole(role);

      res.json(formatSuccessResponse(
        formatRoleResponse(enrichedRole)
      ));

    } catch (error) {
      console.error('Error fetching project role:', error);
      res.status(500).json(formatErrorResponse('Failed to fetch role'));
    }
  }

  /**
   * Delete a project role
   * DELETE /api/project-roles/:id
   */
  async deleteProjectRole(req, res) {
    try {
      const { roleId } = req.params;
      console.log('=== Deleting project role ===');
      console.log('Role ID from params:', roleId);
      console.log('Role ID type:', typeof roleId);

      // Validate role ID
      const roleValidation = validateRoleId(roleId);
      console.log('Validation result:', roleValidation);
      if (!roleValidation.isValid) {
        console.log('Validation failed:', roleValidation.error);
        return res.status(400).json(formatErrorResponse(roleValidation.error));
      }

      // Check if role exists
      const role = await getRoleById(roleValidation.id, false);
      if (!role) {
        return res.status(404).json(formatErrorResponse('Role not found', 404));
      }

      // Delete role
      await deleteRole(roleValidation.id);

      // Log activity
      await logActivity({
        project_id: role.project_id,
        activity_type: 'ROLE_DELETED',
        description: `Deleted role: ${role.title}`,
        user_id: req.user?.id || 'system',
        metadata: { role_id: role.id }
      });

      res.json(formatSuccessResponse(
        { id: roleValidation.id },
        'Role deleted successfully'
      ));

    } catch (error) {
      console.error('Error deleting project role:', error);
      res.status(500).json(formatErrorResponse('Failed to delete role'));
    }
  }

  /**
   * Duplicate a project role
   * POST /api/project-roles/:id/duplicate
   */
  async duplicateProjectRole(req, res) {
    try {
      const { id } = req.params;

      // Validate role ID
      const roleValidation = validateRoleId(id);
      if (!roleValidation.isValid) {
        return res.status(400).json(formatErrorResponse(roleValidation.error));
      }

      // Check if role exists
      const exists = await roleExists(roleValidation.id);
      if (!exists) {
        return res.status(404).json(formatErrorResponse('Role not found', 404));
      }

      // Duplicate with overrides
      const overrides = {
        title: req.body.title || undefined,
        status: 'DRAFT'
      };

      const duplicatedRole = await duplicateRole(roleValidation.id, overrides);

      // Enrich with sub_role data
      const enrichedRole = await enrichRoleWithSubRole(duplicatedRole);

      // Log activity
      await logActivity({
        project_id: duplicatedRole.project_id,
        activity_type: 'ROLE_DUPLICATED',
        description: `Duplicated role: ${duplicatedRole.title}`,
        user_id: req.user?.id || 'system',
        metadata: {
          original_role_id: roleValidation.id,
          new_role_id: duplicatedRole.id
        }
      });

      res.status(201).json(formatSuccessResponse(
        formatRoleResponse(enrichedRole),
        'Role duplicated successfully'
      ));

    } catch (error) {
      console.error('Error duplicating project role:', error);
      res.status(500).json(formatErrorResponse('Failed to duplicate role'));
    }
  }

  /**
   * Update role status
   * PATCH /api/project-roles/:id/status
   */
  async updateRoleStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate role ID
      const roleValidation = validateRoleId(id);
      if (!roleValidation.isValid) {
        return res.status(400).json(formatErrorResponse(roleValidation.error));
      }

      // Validate status
      const validStatuses = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FILLED', 'CLOSED', 'CANCELLED'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json(formatErrorResponse(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        ));
      }

      // Update status
      const updatedRole = await updateRole(roleValidation.id, { status });

      // Log activity
      await logActivity({
        project_id: updatedRole.project_id,
        activity_type: 'ROLE_STATUS_CHANGED',
        description: `Changed role status to: ${status}`,
        user_id: req.user?.id || 'system',
        metadata: { role_id: updatedRole.id, new_status: status }
      });

      res.json(formatSuccessResponse(
        formatRoleResponse(updatedRole),
        'Role status updated successfully'
      ));

    } catch (error) {
      console.error('Error updating role status:', error);
      res.status(500).json(formatErrorResponse('Failed to update role status'));
    }
  }

  /**
   * Get role statistics for a project
   * GET /api/project-roles/statistics
   */
  async getRoleStatistics(req, res) {
    try {
      const { projectId } = req.query;

      // Validate project ID
      const projectValidation = validateProjectId(projectId);
      if (!projectValidation.isValid) {
        return res.status(400).json(formatErrorResponse(projectValidation.error));
      }

      // Get statistics
      const stats = await getRoleStatistics(projectValidation.id);

      res.json(formatStatisticsResponse(stats));

    } catch (error) {
      console.error('Error fetching role statistics:', error);
      res.status(500).json(formatErrorResponse('Failed to fetch statistics'));
    }
  }

  /**
   * Batch update role statuses
   * POST /api/project-roles/batch-update-status
   */
  async batchUpdateRoleStatus(req, res) {
    try {
      const { roleIds, status } = req.body;

      // Validate input
      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json(formatErrorResponse('Role IDs must be a non-empty array'));
      }

      // Validate status
      const validStatuses = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FILLED', 'CLOSED', 'CANCELLED'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json(formatErrorResponse(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        ));
      }

      // Update statuses
      const count = await batchUpdateStatus(roleIds, status);

      // Log activity
      await logActivity({
        project_id: null,
        activity_type: 'ROLES_BATCH_UPDATE',
        description: `Updated ${count} roles to status: ${status}`,
        user_id: req.user?.id || 'system',
        metadata: { role_ids: roleIds, new_status: status }
      });

      res.json(formatSuccessResponse(
        { updated: count },
        `Successfully updated ${count} roles`
      ));

    } catch (error) {
      console.error('Error batch updating role statuses:', error);
      res.status(500).json(formatErrorResponse('Failed to batch update roles'));
    }
  }
}

module.exports = new RoleController();