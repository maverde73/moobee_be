const express = require('express');
const router = express.Router();
const subRolesController = require('../controllers/subRolesController');
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * Sub-Roles Routes
 * All routes require authentication
 */

// Search sub-roles with lazy loading
// GET /api/sub-roles/search?q=web&limit=50&parent_role_id=44
router.get('/search', authenticate, subRolesController.searchSubRoles);

// Get single sub-role by ID
// GET /api/sub-roles/:id
router.get('/:id', authenticate, subRolesController.getSubRoleById);

// Get all sub-roles (optional - for dropdown pre-population)
// GET /api/sub-roles?parent_role_id=44
router.get('/', authenticate, subRolesController.getAllSubRoles);

// Create custom sub-role with AI classification
// POST /api/sub-roles/custom
// Body: { customSubRoleName: string }
router.post('/custom', authenticate, subRolesController.createCustomSubRole);

// Delete custom sub-role (only if created by same tenant)
// DELETE /api/sub-roles/custom/:id
router.delete('/custom/:id', authenticate, subRolesController.deleteCustomSubRole);

module.exports = router;
