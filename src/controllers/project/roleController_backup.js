// Original roleController.js - Backup created 27/09/2025 11:45
// This file contains the original implementation before refactoring

const prisma = require('../../config/database');
const { projectRoleMessages } = require('../../utils/messages');

const roleController = {
  // Create a new project role
  async createProjectRole(req, res) {
    try {
      const {
        projectId,
        title,
        description,
        requiredCount,
        experienceLevel,
        skills,
        startDate,
        endDate,
        status
      } = req.body;

      // Validate required fields
      if (!projectId || !title) {
        return res.status(400).json({
          success: false,
          message: projectRoleMessages.validation.requiredFields
        });
      }

      // Create the role with skills in a transaction
      const role = await prisma.$transaction(async (tx) => {
        // Create the role
        const newRole = await tx.projectRole.create({
          data: {
            projectId: parseInt(projectId),
            title,
            description,
            requiredCount: parseInt(requiredCount) || 1,
            experienceLevel,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            status: status || 'open'
          }
        });

        // Add skills if provided
        if (skills && skills.length > 0) {
          const skillData = skills.map(skill => ({
            projectRoleId: newRole.id,
            skillId: skill.skillId,
            proficiencyLevel: skill.proficiencyLevel || 'intermediate',
            isRequired: skill.isRequired !== undefined ? skill.isRequired : true
          }));

          await tx.projectRoleSkill.createMany({
            data: skillData
          });
        }

        // Fetch the complete role with relations
        return await tx.projectRole.findUnique({
          where: { id: newRole.id },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true
              }
            },
            skills: {
              include: {
                skill: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            matches: {
              select: {
                id: true
              }
            }
          }
        });
      });

      res.status(201).json({
        success: true,
        message: projectRoleMessages.success.created,
        data: {
          ...role,
          skills: role.skills.map(rs => ({
            id: rs.skill.id,
            name: rs.skill.name,
            proficiencyLevel: rs.proficiencyLevel,
            isRequired: rs.isRequired
          })),
          _count: {
            skills: role.skills.length,
            matches: role.matches.length
          }
        }
      });
    } catch (error) {
      console.error('[RoleController] Error creating project role:', error);
      res.status(500).json({
        success: false,
        message: projectRoleMessages.error.createFailed
      });
    }
  },

  // Update a project role
  async updateProjectRole(req, res) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        requiredCount,
        experienceLevel,
        skills,
        startDate,
        endDate,
        status
      } = req.body;

      // Update the role with skills in a transaction
      const role = await prisma.$transaction(async (tx) => {
        // Build update data
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (requiredCount !== undefined) updateData.requiredCount = parseInt(requiredCount);
        if (experienceLevel !== undefined) updateData.experienceLevel = experienceLevel;
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (status !== undefined) updateData.status = status;

        // Update the role
        const updatedRole = await tx.projectRole.update({
          where: { id: parseInt(id) },
          data: updateData
        });

        // Update skills if provided
        if (skills !== undefined) {
          // Remove existing skills
          await tx.projectRoleSkill.deleteMany({
            where: { projectRoleId: updatedRole.id }
          });

          // Add new skills
          if (skills.length > 0) {
            const skillData = skills.map(skill => ({
              projectRoleId: updatedRole.id,
              skillId: skill.skillId,
              proficiencyLevel: skill.proficiencyLevel || 'intermediate',
              isRequired: skill.isRequired !== undefined ? skill.isRequired : true
            }));

            await tx.projectRoleSkill.createMany({
              data: skillData
            });
          }
        }

        // Fetch the complete role with relations
        return await tx.projectRole.findUnique({
          where: { id: updatedRole.id },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true
              }
            },
            skills: {
              include: {
                skill: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            matches: {
              select: {
                id: true
              }
            }
          }
        });
      });

      res.json({
        success: true,
        message: projectRoleMessages.success.updated,
        data: {
          ...role,
          skills: role.skills.map(rs => ({
            id: rs.skill.id,
            name: rs.skill.name,
            proficiencyLevel: rs.proficiencyLevel,
            isRequired: rs.isRequired
          })),
          _count: {
            skills: role.skills.length,
            matches: role.matches.length
          }
        }
      });
    } catch (error) {
      console.error('[RoleController] Error updating project role:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: projectRoleMessages.error.notFound
        });
      }
      
      res.status(500).json({
        success: false,
        message: projectRoleMessages.error.updateFailed
      });
    }
  },

  // Get all project roles
  async getProjectRoles(req, res) {
    try {
      const { projectId, status, page = 1, limit = 10 } = req.query;

      // Build filter
      const where = {};
      if (projectId) where.projectId = parseInt(projectId);
      if (status) where.status = status;

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get roles with relations
      const [roles, total] = await prisma.$transaction([
        prisma.projectRole.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true
              }
            },
            skills: {
              include: {
                skill: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            matches: {
              select: {
                id: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        prisma.projectRole.count({ where })
      ]);

      res.json({
        success: true,
        message: projectRoleMessages.success.fetched,
        data: {
          roles: roles.map(role => ({
            ...role,
            skills: role.skills.map(rs => ({
              id: rs.skill.id,
              name: rs.skill.name,
              proficiencyLevel: rs.proficiencyLevel,
              isRequired: rs.isRequired
            })),
            _count: {
              skills: role.skills.length,
              matches: role.matches.length
            }
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('[RoleController] Error getting project roles:', error);
      res.status(500).json({
        success: false,
        message: projectRoleMessages.error.fetchFailed
      });
    }
  },

  // Get a single project role by ID
  async getProjectRoleById(req, res) {
    try {
      const { id } = req.params;

      const role = await prisma.projectRole.findUnique({
        where: { id: parseInt(id) },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              description: true,
              startDate: true,
              endDate: true
            }
          },
          skills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          matches: {
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
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
        data: {
          ...role,
          skills: role.skills.map(rs => ({
            id: rs.skill.id,
            name: rs.skill.name,
            proficiencyLevel: rs.proficiencyLevel,
            isRequired: rs.isRequired
          })),
          _count: {
            skills: role.skills.length,
            matches: role.matches.length
          }
        }
      });
    } catch (error) {
      console.error('[RoleController] Error getting project role:', error);
      res.status(500).json({
        success: false,
        message: projectRoleMessages.error.fetchFailed
      });
    }
  },

  // Delete a project role
  async deleteProjectRole(req, res) {
    try {
      const { id } = req.params;

      // Check if role has matches before deleting
      const roleWithMatches = await prisma.projectRole.findUnique({
        where: { id: parseInt(id) },
        include: {
          matches: {
            select: { id: true }
          }
        }
      });

      if (!roleWithMatches) {
        return res.status(404).json({
          success: false,
          message: projectRoleMessages.error.notFound
        });
      }

      if (roleWithMatches.matches.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete role with existing matches'
        });
      }

      // Delete the role (skills will be cascade deleted)
      await prisma.projectRole.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: projectRoleMessages.success.deleted
      });
    } catch (error) {
      console.error('[RoleController] Error deleting project role:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: projectRoleMessages.error.notFound
        });
      }
      
      res.status(500).json({
        success: false,
        message: projectRoleMessages.error.deleteFailed
      });
    }
  },

  // Get available skills for project roles
  async getAvailableSkills(req, res) {
    try {
      const { search } = req.query;

      const where = search ? {
        name: {
          contains: search,
          mode: 'insensitive'
        }
      } : {};

      const skills = await prisma.skill.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true
        },
        orderBy: {
          name: 'asc'
        },
        take: 50
      });

      res.json({
        success: true,
        message: 'Skills fetched successfully',
        data: skills
      });
    } catch (error) {
      console.error('[RoleController] Error getting available skills:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available skills'
      });
    }
  }
};

module.exports = roleController;