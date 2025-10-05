const subRolesService = require('../services/subRolesService');

/**
 * SubRolesController
 * Handles HTTP requests for sub-roles endpoints
 */
class SubRolesController {
  /**
   * Search sub-roles with lazy loading support
   * GET /api/sub-roles/search?q=term&limit=50&parent_role_id=44
   */
  async searchSubRoles(req, res) {
    try {
      const { q, limit = 50, parent_role_id } = req.query;

      // Validation
      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search term is required'
        });
      }

      if (q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search term must be at least 2 characters'
        });
      }

      if (q.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Search term too long (max 100 characters)'
        });
      }

      // Build search pattern for SQL LIKE
      const searchPattern = `%${q.toLowerCase().trim()}%`;

      // Get tenant ID from authenticated user
      const tenantId = req.user?.tenantId || req.user?.tenant_id || null;

      // Parse options
      const options = {
        limit: Math.min(parseInt(limit) || 50, 100), // Max 100 results
        parentRoleId: parent_role_id ? parseInt(parent_role_id) : null,
        tenantId
      };

      // Search sub-roles
      const results = await subRolesService.searchSubRoles(searchPattern, options);

      res.json({
        success: true,
        sub_roles: results,
        total: results.length,
        query: {
          search_term: q,
          parent_role_id: options.parentRoleId,
          limit: options.limit
        }
      });
    } catch (error) {
      console.error('Error in searchSubRoles controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get a single sub-role by ID
   * GET /api/sub-roles/:id
   */
  async getSubRoleById(req, res) {
    try {
      const { id } = req.params;

      // Validation
      const subRoleId = parseInt(id);
      if (isNaN(subRoleId) || subRoleId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid sub-role ID'
        });
      }

      // Get sub-role
      const subRole = await subRolesService.getSubRoleById(subRoleId);

      if (!subRole) {
        return res.status(404).json({
          success: false,
          error: 'Sub-role not found'
        });
      }

      res.json({
        success: true,
        sub_role: subRole
      });
    } catch (error) {
      console.error('Error in getSubRoleById controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get all sub-roles (optional endpoint for dropdown pre-population)
   * GET /api/sub-roles?parent_role_id=44
   */
  async getAllSubRoles(req, res) {
    try {
      const { parent_role_id } = req.query;

      // Get tenant ID from authenticated user
      const tenantId = req.user?.tenantId || req.user?.tenant_id || null;

      const options = {
        parentRoleId: parent_role_id ? parseInt(parent_role_id) : null
      };

      const results = await subRolesService.getAllSubRoles(options.parentRoleId, tenantId);

      res.json({
        success: true,
        sub_roles: results,
        total: results.length,
        query: {
          parent_role_id: options.parentRoleId
        }
      });
    } catch (error) {
      console.error('Error in getAllSubRoles controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Create custom sub-role with AI classification
   * POST /api/sub-roles/custom
   * Body: { customSubRoleName: string }
   */
  async createCustomSubRole(req, res) {
    try {
      const { customSubRoleName } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.email || req.user?.id;

      // Validation
      if (!customSubRoleName || customSubRoleName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Custom sub-role name must be at least 2 characters'
        });
      }

      if (customSubRoleName.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Custom sub-role name too long (max 100 characters)'
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID is required'
        });
      }

      // Create custom sub-role with AI classification
      const result = await subRolesService.createCustomSubRole({
        customSubRoleName: customSubRoleName.trim(),
        tenantId,
        userId
      });

      res.json(result);
    } catch (error) {
      console.error('Error in createCustomSubRole:', error);

      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create custom sub-role'
      });
    }
  }

  /**
   * Delete custom sub-role
   * DELETE /api/sub-roles/custom/:id
   */
  async deleteCustomSubRole(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;

      // Validation
      const subRoleId = parseInt(id);
      if (isNaN(subRoleId) || subRoleId <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid sub-role ID'
        });
      }

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Tenant ID required'
        });
      }

      // Delete custom sub-role
      await subRolesService.deleteCustomSubRole(subRoleId, tenantId);

      res.json({
        success: true,
        message: 'Custom sub-role deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteCustomSubRole:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Unauthorized') || error.message.includes('Cannot delete')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete custom sub-role'
      });
    }
  }
}

module.exports = new SubRolesController();
