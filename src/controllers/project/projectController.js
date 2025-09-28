/**
 * Project Controller
 * @module controllers/project
 * @created 2025-09-26 23:40
 */

const prisma = require('../../config/database');

/**
 * Project Controller Class
 */
class ProjectController {
  /**
   * Get all projects with filters
   * GET /api/projects
   */
  async getProjects(req, res) {
    try {
      const {
        status,
        priority,
        type,
        pm_id,
        page = 1,
        limit = 20,
        search,
        start_date,
        end_date,
        is_archived
      } = req.query;

      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Build where clause
      const where = {
        tenant_id: tenantId,
        is_active: true,
        is_archived: false
      };

      if (status && status !== 'all') {
        where.status = status.toUpperCase();
      }

      if (priority && priority !== 'all') {
        where.priority = priority.toUpperCase();
      }

      if (type && type !== 'all') {
        where.type = type.toUpperCase();
      }

      if (is_archived === 'true') {
        where.is_archived = true;
        delete where.is_active;
      }

      if (pm_id) {
        where.pm_id = parseInt(pm_id);
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { client_name: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (start_date) {
        where.start_date = { gte: new Date(start_date) };
      }

      if (end_date) {
        where.end_date = { lte: new Date(end_date) };
      }

      // Execute queries
      const [projects, total] = await Promise.all([
        prisma.projects.findMany({
          where,
          include: {
            project_roles: {
              where: { status: 'OPEN' },
              select: {
                id: true,
                title: true,
                seniority: true,
                quantity: true,
                priority: true
              }
            },
            project_milestones: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
              select: {
                id: true,
                name: true,
                due_date: true,
                completion_percentage: true
              }
            },
            _count: {
              select: {
                project_roles: true,
                project_milestones: true
              }
            }
          },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit),
          orderBy: [
            { priority: 'desc' },
            { start_date: 'asc' }
          ]
        }),
        prisma.projects.count({ where })
      ]);

      res.json({
        success: true,
        data: projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch projects',
        message: error.message
      });
    }
  }

  /**
   * Get single project by ID
   * GET /api/projects/:id
   */
  async getProjectById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      const project = await prisma.projects.findFirst({
        where: {
          id: parseInt(id),
          tenant_id: tenantId
        },
        include: {
          project_roles: true,
          project_milestones: {
            orderBy: { due_date: 'asc' }
          },
          project_activity_logs: {
            orderBy: { created_at: 'desc' },
            take: 10
          }
        }
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });

    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch project'
      });
    }
  }

  /**
   * Create new project
   * POST /api/projects
   */
  async createProject(req, res) {
    try {
      const tenantId = req.user.tenant_id || req.user.tenantId;
      const userId = req.user.id;

      // Generate unique project code
      const code = await this.generateProjectCode(req.body.project_name || req.body.name);

      const projectData = {
        project_name: req.body.name || req.body.project_name,
        project_code: code,
        description: req.body.description,
        client_name: req.body.client_name,
        budget: req.body.budget ? parseFloat(req.body.budget) : null,
        status: req.body.status || 'DRAFT',
        priority: req.body.priority || 'MEDIUM',
        type: req.body.type || 'FORMAL',
        objectives: req.body.objectives || {},
        deliverables: req.body.deliverables || [],
        constraints: req.body.constraints || {},
        risks: req.body.risks || [],
        notes: req.body.notes,
        team_size: req.body.team_size ? parseInt(req.body.team_size) : null,
        tags: req.body.tags || [],
        context_preferences: req.body.context_preferences || {},
        tenant_id: tenantId,
        created_by: String(userId),
        pm_id: req.body.pm_id ? parseInt(req.body.pm_id) : null
      };

      // Convert dates if provided
      if (req.body.start_date) {
        projectData.start_date = new Date(req.body.start_date);
      }
      if (req.body.end_date) {
        projectData.end_date = new Date(req.body.end_date);
      }

      const project = await prisma.projects.create({
        data: projectData
      });

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: project.id,
          activity_type: 'PROJECT_CREATED',
          description: `Project ${project.project_name} created`,
          user_id: String(userId),
          metadata: {
            created_by: userId,
            initial_status: project.status
          }
        }
      });

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });

    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create project',
        message: error.message
      });
    }
  }

  /**
   * Update project
   * PUT /api/projects/:id
   */
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;
      const updates = req.body;

      // Check project exists
      const existing = await prisma.projects.findFirst({
        where: { id: parseInt(id), tenant_id: tenantId }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Update project
      const updated = await prisma.projects.update({
        where: { id: parseInt(id) },
        data: {
          ...updates,
          updated_at: new Date()
        }
      });

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: parseInt(id),
          activity_type: 'PROJECT_UPDATED',
          description: 'Project details updated',
          user_id: String(req.user.id),
          metadata: { changes: updates }
        }
      });

      res.json({
        success: true,
        data: updated
      });

    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update project'
      });
    }
  }

  /**
   * Update project status
   * PATCH /api/projects/:id/status
   */
  async updateProjectStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Get current project
      const project = await prisma.projects.findFirst({
        where: { id, tenant_id: tenantId }
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Validate status transition
      if (!this.isValidStatusTransition(project.status, status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status transition from ${project.status} to ${status}`
        });
      }

      // Update status
      const updated = await prisma.projects.update({
        where: { id },
        data: {
          status,
          updated_at: new Date()
        }
      });

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: id,
          activity_type: `STATUS_CHANGED_TO_${status}`,
          description: `Project status changed from ${project.status} to ${status}`,
          user_id: String(req.user.id),
          metadata: {
            old_status: project.status,
            new_status: status,
            notes
          }
        }
      });

      res.json({
        success: true,
        data: updated,
        message: `Project status updated to ${status}`
      });

    } catch (error) {
      console.error('Error updating project status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update project status'
      });
    }
  }

  /**
   * Delete project
   * DELETE /api/projects/:id
   */
  async deleteProject(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Check if project exists
      const project = await prisma.projects.findFirst({
        where: { id, tenant_id: tenantId }
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Soft delete (mark as inactive)
      await prisma.projects.update({
        where: { id },
        data: {
          is_active: false,
          status: 'CANCELLED',
          updated_at: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete project'
      });
    }
  }

  /**
   * Get project statistics
   * GET /api/projects/stats
   */
  async getProjectStats(req, res) {
    try {
      const tenantId = req.user.tenant_id || req.user.tenantId;

      const [
        totalProjects,
        activeProjects,
        openRoles,
        criticalVacancies,
        completionRate
      ] = await Promise.all([
        // Total projects
        prisma.projects.count({
          where: { tenant_id: tenantId, is_active: true }
        }),
        // Active projects
        prisma.projects.count({
          where: {
            tenant_id: tenantId,
            is_active: true,
            status: 'ACTIVE'
          }
        }),
        // Open roles
        prisma.project_roles.count({
          where: {
            projects: { tenant_id: tenantId },
            status: 'OPEN'
          }
        }),
        // Critical vacancies
        prisma.project_roles.count({
          where: {
            projects: { tenant_id: tenantId },
            status: 'OPEN',
            priority: 'CRITICAL'
          }
        }),
        // Average completion rate
        prisma.project_milestones.aggregate({
          where: {
            projects: { tenant_id: tenantId }
          },
          _avg: {
            completion_percentage: true
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          total: totalProjects,
          active: activeProjects,
          openRoles,
          criticalVacancies,
          averageCompletion: completionRate._avg.completion_percentage || 0
        }
      });

    } catch (error) {
      console.error('Error fetching project stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics'
      });
    }
  }

  /**
   * Generate unique project code
   */
  async generateProjectCode(name) {
    const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    let code = `${prefix}-${year}-${random}`;

    // Check uniqueness
    const exists = await prisma.projects.findFirst({
      where: { project_code: code }
    });
    if (exists) {
      // Regenerate if exists
      return this.generateProjectCode(name);
    }

    return code;
  }

  /**
   * Validate status transitions
   */
  isValidStatusTransition(from, to) {
    const transitions = {
      'DRAFT': ['PLANNING', 'CANCELLED'],
      'PLANNING': ['ACTIVE', 'DRAFT', 'CANCELLED'],
      'ACTIVE': ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
      'ON_HOLD': ['ACTIVE', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    return transitions[from]?.includes(to) || false;
  }
}

module.exports = new ProjectController();