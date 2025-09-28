/**
 * Project Role Controller
 * @module controllers/project/role
 * @created 2025-09-27 17:30
 *
 * Gestisce i ruoli dei progetti con integrazione skills
 */

const prisma = require('../../config/database');

class RoleController {
  /**
   * Get all roles for a project
   * GET /api/projects/:projectId/roles
   */
  async getProjectRoles(req, res) {
    try {
      const { projectId } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Verify project belongs to tenant
      const project = await prisma.projects.findFirst({
        where: {
          id: parseInt(projectId),
          tenant_id: tenantId
        }
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Get all roles with related data
      const roles = await prisma.project_roles.findMany({
        where: {
          project_id: parseInt(projectId)
        },
        include: {
          sub_role: true,
          project_matching_results: {
            where: { is_shortlisted: true },
            include: {
              employees: true
            },
            orderBy: { match_score: 'desc' },
            take: 5
          }
        },
        orderBy: [
          { is_critical: 'desc' },
          { is_urgent: 'desc' },
          { priority: 'desc' }
        ]
      });

      // Enrich with sub_role data if exists
      const enrichedRoles = await Promise.all(roles.map(async (role) => {
        if (role.sub_role_id) {
          try {
            // Get sub_role details
            const subRole = await prisma.sub_roles.findUnique({
              where: { id: role.sub_role_id }
            });

            // Get associated skills
            const skills = await prisma.skills_sub_roles_value.findMany({
              where: { id_sub_role: role.sub_role_id },
              include: {
                skills: true
              },
              orderBy: { Value: 'desc' },
              take: 10
            });

            return {
              ...role,
              sub_role: subRole,
              suggested_skills: skills.map(s => ({
                id: s.id_skill,
                name: s.skills.Skill,
                value: s.Value,
                grading: s.Grading
              }))
            };
          } catch (error) {
            console.error('Error fetching sub_role data:', error);
            return role;
          }
        }
        return role;
      }));

      res.json({
        success: true,
        data: enrichedRoles,
        count: enrichedRoles.length
      });

    } catch (error) {
      console.error('Error fetching project roles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch project roles'
      });
    }
  }

  /**
   * Create a new role for a project
   * POST /api/projects/:projectId/roles
   */
  async createProjectRole(req, res) {
    try {
      const { projectId } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;


      // Verify project
      const project = await prisma.projects.findFirst({
        where: {
          id: parseInt(projectId),
          tenant_id: tenantId
        }
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Debug log for role_id and sub_role_id
      console.log('=== DEBUG ROLE IDs ===');
      console.log('Received role_id:', req.body.role_id);
      console.log('role_id type:', typeof req.body.role_id);
      console.log('Received sub_role_id:', req.body.sub_role_id);
      console.log('sub_role_id type:', typeof req.body.sub_role_id);
      console.log('Full request body:', JSON.stringify(req.body, null, 2));

      // Prepare role data
      const roleData = {
        project_id: parseInt(projectId),
        title: req.body.title,
        role_code: req.body.role_code || `ROLE_${Date.now()}`,
        seniority: req.body.seniority || 'MIDDLE',
        quantity: req.body.quantity || 1,
        priority: req.body.priority || 'NORMAL',
        status: req.body.status || 'OPEN',

        // Skills - handle both nested and direct formats
        required_skills: req.body.required_skills || [],
        hard_skills: req.body.required_skills?.hard_skills || req.body.hard_skills || [],
        soft_skills: req.body.required_skills?.soft_skills || req.body.soft_skills || [],

        // Certifications - ensure they're simple arrays of strings
        certifications: Array.isArray(req.body.certifications) ? req.body.certifications : [],
        required_certifications: Array.isArray(req.body.required_certifications) ? req.body.required_certifications : [],
        preferred_certifications: Array.isArray(req.body.preferred_certifications) ? req.body.preferred_certifications : [],

        // Experience
        min_experience_years: req.body.min_experience_years || 0,
        preferred_experience_years: req.body.preferred_experience_years,

        // Languages
        required_languages: req.body.required_languages || [],
        preferred_languages: req.body.preferred_languages || [],

        // Work details
        allocation_percentage: req.body.allocation_percentage || 100,
        availability_required: req.body.availability_required,
        work_mode: req.body.work_mode,
        location: req.body.location,

        // Flags
        is_billable: req.body.is_billable !== false,
        is_urgent: req.body.is_urgent || false,
        is_critical: req.body.is_critical || false,

        // Additional data
        budget_range: req.body.budget_range,
        constraints: req.body.constraints,
        opportunities: req.body.opportunities,
        preferences: req.body.preferences,
        competencies: req.body.competencies,
        // role_id and sub_role_id are now integer fields
        role_id: req.body.role_id ? parseInt(req.body.role_id) : null,
        sub_role_id: req.body.sub_role_id ? parseInt(req.body.sub_role_id) : null
      };


      // Create the role
      const role = await prisma.project_roles.create({
        data: roleData,
        include: {
          sub_role: true
        }
      });

      // Debug log after creation
      console.log('=== ROLE CREATED ===');
      console.log('Created role_id:', role.role_id);
      console.log('Created sub_role_id:', role.sub_role_id);
      console.log('Created sub_role details:', role.sub_role);

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: parseInt(projectId),
          activity_type: 'ROLE_CREATED',
          description: `Role ${role.title} created`,
          user_id: String(req.user.id),
          metadata: { role_id: role.id, title: role.title }
        }
      });

      // If skills are provided, trigger initial matching
      if (role.hard_skills && Object.keys(role.hard_skills).length > 0) {
        // Async matching (fire and forget)
        this.triggerMatching(role.id).catch(console.error);
      }

      res.status(201).json({
        success: true,
        data: role
      });

    } catch (error) {
      console.error('Error creating project role:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create project role'
      });
    }
  }

  /**
   * Update a project role
   * PUT /api/project-roles/:roleId
   */
  async updateProjectRole(req, res) {
    try {
      const { roleId } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;


      // Verify role exists and user has access
      const existingRole = await prisma.project_roles.findFirst({
        where: { id: roleId },
        include: {
          projects: true
        }
      });

      if (!existingRole) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      if (existingRole.projects.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Prepare update data with same logic as create
      const updateData = {
        title: req.body.title,
        seniority: req.body.seniority,
        quantity: req.body.quantity,
        priority: req.body.priority,
        status: req.body.status,

        // Skills - handle both formats
        required_skills: req.body.required_skills || [],
        hard_skills: req.body.required_skills?.hard_skills || req.body.hard_skills || [],
        soft_skills: req.body.required_skills?.soft_skills || req.body.soft_skills || [],

        // Certifications - ensure they're simple arrays of strings
        certifications: Array.isArray(req.body.certifications) ? req.body.certifications : [],
        required_certifications: Array.isArray(req.body.required_certifications) ? req.body.required_certifications : [],
        preferred_certifications: Array.isArray(req.body.preferred_certifications) ? req.body.preferred_certifications : [],

        // Experience
        min_experience_years: req.body.min_experience_years,
        preferred_experience_years: req.body.preferred_experience_years,

        // Languages JSONB
        required_languages: req.body.required_languages || [],
        preferred_languages: req.body.preferred_languages || [],

        // Work details
        allocation_percentage: req.body.allocation_percentage,
        work_mode: req.body.work_mode,
        location: req.body.location,

        // Flags
        is_billable: req.body.is_billable,
        is_urgent: req.body.is_urgent,
        is_critical: req.body.is_critical,

        // Additional
        budget_range: req.body.budget_range,
        constraints: req.body.constraints,
        opportunities: req.body.opportunities,
        preferences: req.body.preferences,
        competencies: req.body.competencies,

        // role_id and sub_role_id are now integer fields
        role_id: req.body.role_id ? parseInt(req.body.role_id) : null,
        sub_role_id: req.body.sub_role_id ? parseInt(req.body.sub_role_id) : null
      };


      // Update the role
      const updated = await prisma.project_roles.update({
        where: { id: roleId },
        data: updateData,
        include: {
          sub_role: true
        }
      });

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: existingRole.project_id,
          activity_type: 'ROLE_UPDATED',
          description: `Role ${updated.title} updated`,
          user_id: String(req.user.id),
          metadata: { role_id: updated.id, changes: req.body }
        }
      });

      res.json({
        success: true,
        data: updated
      });

    } catch (error) {
      console.error('Error updating project role:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update project role'
      });
    }
  }

  /**
   * Delete a project role
   * DELETE /api/project-roles/:roleId
   */
  async deleteProjectRole(req, res) {
    try {
      const { roleId } = req.params;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Verify role and access
      const role = await prisma.project_roles.findFirst({
        where: { id: roleId },
        include: {
          projects: true
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      if (role.projects.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Delete the role (cascades to related records)
      await prisma.project_roles.delete({
        where: { id: roleId }
      });

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: role.project_id,
          activity_type: 'ROLE_DELETED',
          description: `Role ${role.title} deleted`,
          user_id: String(req.user.id),
          metadata: { role_id: roleId, title: role.title }
        }
      });

      res.json({
        success: true,
        message: 'Role deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting project role:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete project role'
      });
    }
  }

  /**
   * Search available skills
   * GET /api/skills/search
   */
  async searchSkills(req, res) {
    try {
      const { query, type = 'all', limit = 20 } = req.query;

      let results = [];

      if (type === 'all' || type === 'hard') {
        // Search hard skills
        const hardSkills = await prisma.skills.findMany({
          where: {
            OR: [
              { Skill: { contains: query } },
              { NameKnown_Skill: { contains: query } }
            ]
          },
          take: parseInt(limit)
        });

        results = results.concat(hardSkills.map(s => ({
          id: s.id,
          name: s.Skill || s.NameKnown_Skill,
          type: 'hard',
          synonyms: s.Synonyms_Skill
        })));
      }

      if (type === 'all' || type === 'soft') {
        // Search soft skills
        const softSkills = await prisma.soft_skills.findMany({
          where: {
            OR: [
              { name: { contains: query } },
              { nameEn: { contains: query } },
              { code: { contains: query } }
            ],
            isActive: true
          },
          take: parseInt(limit)
        });

        results = results.concat(softSkills.map(s => ({
          id: s.id,
          name: s.name,
          type: 'soft',
          description: s.description,
          category: s.category
        })));
      }

      res.json({
        success: true,
        data: results,
        count: results.length
      });

    } catch (error) {
      console.error('Error searching skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search skills'
      });
    }
  }

  /**
   * Get available roles from roles table
   * GET /api/projects/roles-list
   */
  async getRolesList(req, res) {
    try {
      console.log('getRolesList method called');
      const { search } = req.query;

      let where = {};

      // Add search filter if provided
      if (search) {
        where.OR = [
          { Role: { contains: search } },
          { NameKnown_Role: { contains: search } }
        ];
      }

      console.log('Attempting to query roles table with where:', where);
      const roles = await prisma.roles.findMany({
        where,
        orderBy: { Role: 'asc' },
        take: 100
      });

      res.json({
        success: true,
        data: roles.map(r => ({
          id: r.id,
          name: r.Role || r.NameKnown_Role,
          synonyms: r.Synonyms_Role
        }))
      });

    } catch (error) {
      console.error('Error fetching roles list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch roles list'
      });
    }
  }

  /**
   * Get available sub-roles for a specific role
   * GET /api/projects/sub-roles
   */
  async getSubRoles(req, res) {
    try {
      const { roleId, search } = req.query;
      console.log('=== getSubRoles DEBUG ===');
      console.log('Query params:', { roleId, search });
      console.log('getSubRoles called with roleId:', roleId, 'search:', search);

      let where = {};

      // If roleId provided, get sub-roles for that role
      if (roleId) {
        console.log('Fetching sub-roles for roleId:', roleId);
        const roleMappings = await prisma.role_sub_role.findMany({
          where: { id_role: parseInt(roleId) },
          select: { id_sub_role: true }
        });
        console.log('Found mappings:', roleMappings.length);

        const subRoleIds = roleMappings
          .map(m => m.id_sub_role)
          .filter(id => id !== null && id !== undefined);

        console.log('Sub-role IDs found:', subRoleIds);

        if (subRoleIds.length === 0) {
          console.log('No sub-roles found for this role');
          return res.json({
            success: true,
            data: []
          });
        }

        where.id = {
          in: subRoleIds
        };
      }

      // Add search filter
      if (search) {
        where.OR = [
          { Sub_Role: { contains: search } },
          { NameKnown_Sub_Role: { contains: search } }
        ];
      }

      const subRoles = await prisma.sub_roles.findMany({
        where,
        orderBy: { Sub_Role: 'asc' },
        take: 50
      });

      res.json({
        success: true,
        data: subRoles.map(sr => ({
          id: sr.id,
          name: sr.Sub_Role || sr.NameKnown_Sub_Role,
          synonyms: sr.Synonyms_Sub_Role
        }))
      });

    } catch (error) {
      console.error('Error fetching sub-roles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sub-roles'
      });
    }
  }

  /**
   * Get soft skills for a specific role
   * GET /api/projects/role-soft-skills/:roleId
   */
  async getRoleSoftSkills(req, res) {
    try {
      const { roleId } = req.params;

      // Get soft skills associated with this role
      const roleSoftSkills = await prisma.role_soft_skills.findMany({
        where: { roleId: parseInt(roleId) },
        include: {
          soft_skills: true
        },
        orderBy: { priority: 'asc' }
      });

      // Format the response
      const softSkills = roleSoftSkills.map(rss => ({
        id: rss.softSkillId,
        name: rss.soft_skills?.name || 'Unknown',
        nameEn: rss.soft_skills?.nameEn,
        priority: rss.priority,
        weight: rss.weight || 1,
        isRequired: rss.isRequired,
        minScore: rss.minScore,
        targetScore: rss.targetScore,
        description: rss.description || rss.soft_skills?.description,
        category: rss.soft_skills?.category
      }));

      res.json({
        success: true,
        data: softSkills,
        count: softSkills.length
      });

    } catch (error) {
      console.error('Error fetching role soft skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch role soft skills'
      });
    }
  }

  /**
   * Get skills for a specific sub-role
   * GET /api/projects/sub-role-skills/:subRoleId
   */
  async getSubRoleSkills(req, res) {
    try {
      const { subRoleId } = req.params;
      console.log('=== getSubRoleSkills DEBUG ===');
      console.log('Received subRoleId:', subRoleId);
      console.log('Parsed subRoleId:', parseInt(subRoleId));

      // Get skills associated with this sub-role (limit to top skills by Grading)
      const skillsSubRoles = await prisma.skills_sub_roles_value.findMany({
        where: { id_sub_role: parseInt(subRoleId) },
        include: {
          skills: true
        },
        orderBy: { Grading: 'desc' },  // Ordinato per Grading dal più grande al più piccolo
       // take: 100   Limita alle prime 100 competenze più rilevanti
      });

      console.log('Found skills_sub_roles records:', skillsSubRoles.length);

      // Log first 3 records for debugging
      if (skillsSubRoles.length > 0) {
        console.log('First 3 records:', skillsSubRoles.slice(0, 3).map(r => ({
          id_sub_role: r.id_sub_role,
          id_skill: r.id_skill,
          skill_name: r.skills?.Skill,
          grading: r.Grading
        })));
      }

      // Format the response
      const skills = skillsSubRoles.map(ssr => ({
        id: ssr.id_skill,
        name: ssr.skills?.Skill || ssr.skills?.NameKnown_Skill || 'Unknown',
        weight: ssr.Value || 0,
        grading: ssr.Grading !== null && ssr.Grading !== undefined ? parseFloat(ssr.Grading) : 0,  // Ensure grading is a number
        synonyms: ssr.skills?.Synonyms_Skill
      }));

      console.log('Returning skills count:', skills.length);
      if (skills.length > 0) {
        console.log('First 3 formatted skills:', skills.slice(0, 3).map(s => ({
          name: s.name,
          grading: s.grading,
          weight: s.weight
        })));
      }
      console.log('=== END DEBUG ===');

      res.json({
        success: true,
        data: skills,
        count: skills.length
      });

    } catch (error) {
      console.error('Error fetching sub-role skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sub-role skills'
      });
    }
  }

  /**
   * Associate skills with a role
   * POST /api/project-roles/:roleId/skills
   */
  async associateSkills(req, res) {
    try {
      const { roleId } = req.params;
      const { hard_skills, soft_skills, competencies } = req.body;

      const updated = await prisma.project_roles.update({
        where: { id: roleId },
        data: {
          hard_skills: hard_skills || undefined,
          soft_skills: soft_skills || undefined,
          competencies: competencies || undefined
        }
      });

      // Trigger re-matching if skills changed
      if (hard_skills || soft_skills) {
        this.triggerMatching(roleId).catch(console.error);
      }

      res.json({
        success: true,
        data: updated
      });

    } catch (error) {
      console.error('Error associating skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to associate skills'
      });
    }
  }

  /**
   * Trigger matching for a role (async)
   */
  async triggerMatching(roleId) {
    try {
      // This would call the matching service
      // For now, just log
      console.log(`Matching triggered for role ${roleId}`);

      // In production, this would:
      // 1. Queue a job for matching
      // 2. Calculate scores for all employees
      // 3. Save results to project_matching_results

    } catch (error) {
      console.error('Error triggering matching:', error);
    }
  }
}

module.exports = new RoleController();