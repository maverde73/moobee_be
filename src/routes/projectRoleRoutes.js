/**
 * Project Role Routes
 * @module routes/projectRole
 * @created 2025-09-27 17:40
 */

const router = require('express').Router();
const roleController = require('../controllers/project/roleController');
const roleSkillsController = require('../controllers/project/roleSkillsController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Protect all routes
router.use(authenticate);

// Project role routes
router.get('/projects/:projectId/roles', roleController.getProjectRoles);
router.post('/projects/:projectId/roles', authorize(['hr', 'hr_manager', 'manager', 'admin']), roleController.createProjectRole);

// Individual role routes
router.put('/project-roles/:roleId', authorize(['hr', 'hr_manager', 'manager', 'admin']), roleController.updateProjectRole);
router.delete('/project-roles/:roleId', authorize(['hr', 'hr_manager', 'manager', 'admin']), roleController.deleteProjectRole);

// Skills routes
router.get('/skills/search', roleSkillsController.searchSkills);
router.get('/sub-roles', roleSkillsController.getSubRoles);
router.post('/project-roles/:roleId/skills', authorize(['hr', 'hr_manager', 'manager', 'admin']), roleSkillsController.associateSkills);

module.exports = router;