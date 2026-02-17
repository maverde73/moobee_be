/**
 * Project Management Routes
 * @module routes/projectRoutes
 * @created 2025-09-26 23:50
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { generalLimiter } = require('../middlewares/rateLimiter');
const prisma = require('../config/database');
const projectController = require('../controllers/project/projectController');
const matchingController = require('../controllers/project/matchingController');
const roleController = require('../controllers/project/roleController');
const roleSkillsController = require('../controllers/project/roleSkillsController');
const assignmentController = require('../controllers/project/assignmentController');

// ========================================
// PROJECT ROUTES
// ========================================

/**
 * @route GET /api/projects
 * @desc Get all projects with filters
 * @access Private (All authenticated users)
 */
router.get(
  '/',
  authenticate,
  projectController.getProjects.bind(projectController)
);

/**
 * @route GET /api/projects/stats
 * @desc Get project statistics
 * @access Private (HR, Manager, Admin)
 */
router.get(
  '/stats',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  projectController.getProjectStats.bind(projectController)
);

/**
 * @route GET /api/projects/roles
 * @desc Get all available roles
 * @access Private
 */
router.get(
  '/roles',
  generalLimiter, // Aggiungi rate limiter
  authenticate,
  roleSkillsController.getRolesList.bind(roleSkillsController)
);

/**
 * @route GET /api/projects/roles-list
 * @desc Get list of roles from roles table
 * @access Private
 */
router.get(
  '/roles-list',
  authenticate,
  roleSkillsController.getRolesList.bind(roleSkillsController)
);

/**
 * @route GET /api/projects/roles/:roleId/sub-roles
 * @desc Get sub-roles for a specific role
 * @access Private
 */
router.get(
  '/roles/:roleId/sub-roles',
  authenticate,
  async (req, res) => {
    req.query.roleId = req.params.roleId;
    return roleSkillsController.getSubRoles(req, res);
  }
);

/**
 * @route GET /api/projects/sub-roles
 * @desc Get available sub-roles
 * @access Private
 */
router.get(
  '/sub-roles',
  authenticate,
  roleSkillsController.getSubRoles.bind(roleSkillsController)
);

/**
 * @route GET /api/projects/sub-role-skills/:subRoleId
 * @desc Get skills for a specific sub-role
 * @access Private
 */
router.get(
  '/sub-role-skills/:subRoleId',
  authenticate,
  roleSkillsController.getSubRoleSkills.bind(roleSkillsController)
);

/**
 * @route GET /api/projects/role-soft-skills/:roleId
 * @desc Get soft skills for a specific role
 * @access Private
 */
router.get(
  '/role-soft-skills/:roleId',
  generalLimiter, // Aggiungi rate limiter
  authenticate,
  roleSkillsController.getRoleSoftSkills.bind(roleSkillsController)
);

/**
 * @route GET /api/projects/skills/search
 * @desc Search available skills
 * @access Private
 */
router.get(
  '/skills/search',
  authenticate,
  roleSkillsController.searchSkills.bind(roleSkillsController)
);

/**
 * @route GET /api/projects/:id
 * @desc Get single project by ID
 * @access Private (All authenticated users)
 */
router.get(
  '/:id',
  generalLimiter,
  authenticate,
  projectController.getProjectById.bind(projectController)
);

/**
 * @route POST /api/projects
 * @desc Create new project
 * @access Private (Manager, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  projectController.createProject.bind(projectController)
);

/**
 * @route PUT /api/projects/:id
 * @desc Update project
 * @access Private (Manager, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  projectController.updateProject.bind(projectController)
);

/**
 * @route PATCH /api/projects/:id/status
 * @desc Update project status
 * @access Private (Manager, Admin)
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  projectController.updateProjectStatus.bind(projectController)
);

/**
 * @route DELETE /api/projects/:id
 * @desc Delete project (soft delete)
 * @access Private (HR Manager, Manager, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['HR_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  projectController.deleteProject.bind(projectController)
);

// ========================================
// PROJECT ROLE ROUTES
// ========================================

/**
 * @route GET /api/projects/:projectId/roles
 * @desc Get all roles for a project
 * @access Private
 */
router.get(
  '/:projectId/roles',
  authenticate,
  roleController.getProjectRoles.bind(roleController)
);

/**
 * @route GET /api/projects/roles/:id
 * @desc Get single role by ID
 * @access Private
 */
router.post(
  '/:projectId/roles',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  roleController.createProjectRole.bind(roleController)
);

/**
 * @route PUT /api/projects/roles/:roleId
 * @desc Update project role
 * @access Private (Manager, Admin)
 */
router.put(
  '/roles/:roleId',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  roleController.updateProjectRole.bind(roleController)
);

/**
 * @route DELETE /api/projects/roles/:roleId
 * @desc Delete project role
 * @access Private (Manager, Admin)
 */
router.delete(
  '/roles/:roleId',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  roleController.deleteProjectRole.bind(roleController)
);

// ========================================
// MATCHING ROUTES
// ========================================

/**
 * @route POST /api/projects/roles/:roleId/match
 * @desc Run matching algorithm for a role
 * @access Private (HR, Manager, Admin)
 */
router.post(
  '/roles/:roleId/match',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  matchingController.runMatching.bind(matchingController)
);

/**
 * @route PATCH /api/projects/matching/:resultId/shortlist
 * @desc Update shortlist status
 * @access Private (HR, Manager)
 */
router.patch(
  '/matching/:resultId/shortlist',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'MANAGER', 'ADMIN']),
  matchingController.updateShortlist.bind(matchingController)
);

// ========================================
// ASSIGNMENT ROUTES
// ========================================

/**
 * @route GET /api/projects/assignments
 * @desc Get all assignments
 * @access Private
 */
router.get(
  '/:projectId/assignments',
  authenticate,
  assignmentController.getProjectAssignments.bind(assignmentController)
);

/**
 * @route POST /api/projects/roles/:roleId/assign
 * @desc Assign employee to role
 * @access Private (HR, Manager)
 */
router.post(
  '/roles/:roleId/assign',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'MANAGER', 'ADMIN']),
  assignmentController.assignResource.bind(assignmentController)
);

/**
 * @route PATCH /api/projects/assignments/:id
 * @desc Update assignment
 * @access Private (HR, Manager)
 */
router.patch(
  '/assignments/:id',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'MANAGER', 'ADMIN']),
  assignmentController.updateAssignment.bind(assignmentController)
);

/**
 * @route DELETE /api/projects/assignments/:id
 * @desc Remove assignment
 * @access Private (Manager, Admin)
 */
router.delete(
  '/assignments/:id',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN']),
  assignmentController.removeAssignment.bind(assignmentController)
);

// ========================================
// SKILLS ROUTES
// ========================================

// Skills routes have been moved before /:id route to prevent route matching issues

/**
 * @route POST /api/projects/roles/:roleId/skills
 * @desc Associate skills with a role
 * @access Private (Manager, Admin)
 */
router.post(
  '/roles/:roleId/skills',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  roleSkillsController.associateSkills.bind(roleSkillsController)
);

// ========================================
// MILESTONE ROUTES
// ========================================

/**
 * @route GET /api/projects/:projectId/milestones
 * @desc Get project milestones
 * @access Private
 */
router.get(
  '/:projectId/milestones',
  authenticate,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const milestones = await prisma.project_milestones.findMany({
        where: { project_id: projectId },
        orderBy: { due_date: 'asc' }
      });
      res.json({ success: true, data: milestones });
    } catch (error) {
      console.error('Error fetching milestones:', error);
      res.status(500).json({ success: false, message: 'Error fetching milestones' });
    }
  }
);

/**
 * @route POST /api/projects/:projectId/milestones
 * @desc Create project milestone
 * @access Private (Manager, Admin)
 */
router.post(
  '/:projectId/milestones',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { name, description, due_date, status, deliverables, dependencies } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'name is required' });
      }

      const milestone = await prisma.project_milestones.create({
        data: {
          project_id: projectId,
          name,
          description: description || null,
          due_date: due_date ? new Date(due_date) : null,
          status: status || 'PENDING',
          deliverables: deliverables || null,
          dependencies: dependencies || [],
          completion_percentage: 0
        }
      });

      res.status(201).json({ success: true, data: milestone });
    } catch (error) {
      console.error('Error creating milestone:', error);
      res.status(500).json({ success: false, message: 'Error creating milestone' });
    }
  }
);

/**
 * @route PUT /api/projects/:projectId/milestones/:milestoneId
 * @desc Update project milestone
 * @access Private (Manager, Admin)
 */
router.put(
  '/:projectId/milestones/:milestoneId',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  async (req, res) => {
    try {
      const { milestoneId } = req.params;
      const { name, description, due_date, completed_date, status, deliverables, dependencies, completion_percentage } = req.body;

      const data = { updated_at: new Date() };
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (due_date !== undefined) data.due_date = due_date ? new Date(due_date) : null;
      if (completed_date !== undefined) data.completed_date = completed_date ? new Date(completed_date) : null;
      if (status !== undefined) data.status = status;
      if (deliverables !== undefined) data.deliverables = deliverables;
      if (dependencies !== undefined) data.dependencies = dependencies;
      if (completion_percentage !== undefined) data.completion_percentage = parseInt(completion_percentage);

      const milestone = await prisma.project_milestones.update({
        where: { id: milestoneId },
        data
      });

      res.json({ success: true, data: milestone });
    } catch (error) {
      console.error('Error updating milestone:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Milestone not found' });
      }
      res.status(500).json({ success: false, message: 'Error updating milestone' });
    }
  }
);

/**
 * @route DELETE /api/projects/:projectId/milestones/:milestoneId
 * @desc Delete project milestone
 * @access Private (Manager, Admin)
 */
router.delete(
  '/:projectId/milestones/:milestoneId',
  authenticate,
  authorize(['MANAGER', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  async (req, res) => {
    try {
      const { milestoneId } = req.params;

      await prisma.project_milestones.delete({
        where: { id: milestoneId }
      });

      res.json({ success: true, message: 'Milestone deleted' });
    } catch (error) {
      console.error('Error deleting milestone:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Milestone not found' });
      }
      res.status(500).json({ success: false, message: 'Error deleting milestone' });
    }
  }
);

module.exports = router;