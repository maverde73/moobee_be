/**
 * Role Skills Controller
 * @module controllers/project/roleSkills
 * @created 2025-09-27 19:26
 *
 * Gestisce le operazioni relative a skills, sub-roles e soft skills
 */

const prisma = require('../../config/database');

class RoleSkillsController {
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

        where.id = { in: subRoleIds };
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

      // Get skills associated with this sub-role
      const skillsSubRoles = await prisma.skills_sub_roles_value.findMany({
        where: { id_sub_role: parseInt(subRoleId) },
        include: {
          skills: true
        },
        orderBy: { Grading: 'desc' }
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
        grading: ssr.Grading !== null && ssr.Grading !== undefined ? parseFloat(ssr.Grading) : 0,
        synonyms: ssr.skills?.Synonyms_Skill
      }));

      console.log('Returning skills count:', skills.length);
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
        console.log(`Matching triggered for role ${roleId}`);
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
}

module.exports = new RoleSkillsController();