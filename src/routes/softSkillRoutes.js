const express = require('express');
const router = express.Router();
const SoftSkillController = require('../controllers/softSkillController');
const authMiddleware = require('../middlewares/authMiddleware');

const controller = new SoftSkillController();

// Bind all controller methods to maintain correct 'this' context
Object.getOwnPropertyNames(Object.getPrototypeOf(controller)).forEach(method => {
  if (method !== 'constructor' && typeof controller[method] === 'function') {
    controller[method] = controller[method].bind(controller);
  }
});

// =============== PUBLIC ROUTES ===============
// These might be accessible without authentication for viewing

// Get all soft skills
router.get('/skills',
  controller.getAllSoftSkills
);

// Get single soft skill
router.get('/skills/:id',
  controller.getSoftSkillById
);

// Get skills for a specific role
router.get('/roles/:roleId/skills',
  controller.getSkillsForRole
);

// Get roles that require a specific skill
router.get('/skills/:skillId/roles',
  controller.getRolesForSkill
);

// =============== AUTHENTICATED ROUTES ===============

// Create new soft skill (admin only)
router.post('/skills',
  authMiddleware,
  controller.createSoftSkill
);

// Update soft skill (admin only)
router.put('/skills/:id',
  authMiddleware,
  controller.updateSoftSkill
);

// Map role to skill (admin only)
router.post('/roles/:roleId/skills/:skillId',
  authMiddleware,
  controller.mapRoleToSkill
);

// =============== SCORING & ASSESSMENT ===============

// Calculate soft skill scores for an assessment
router.post('/calculate-scores',
  authMiddleware,
  controller.calculateScores
);

// =============== EMPLOYEE PROFILES ===============

// Get employee skill profile
router.get('/employees/:employeeId/profile',
  authMiddleware,
  controller.getEmployeeProfile
);

// Generate skill report for employee
router.get('/employees/:employeeId/report',
  authMiddleware,
  controller.generateSkillReport
);

// =============== TEAM ANALYSIS ===============

// Analyze team skills
router.post('/team-analysis',
  authMiddleware,
  controller.getTeamAnalysis
);

// =============== TENANT PROFILES ===============

// Get tenant skill profiles
router.get('/tenant-profiles',
  authMiddleware,
  controller.getTenantProfiles
);

// Create tenant skill profile
router.post('/tenant-profiles',
  authMiddleware,
  controller.createTenantProfile
);

// Apply profile to employee
router.post('/employees/:employeeId/apply-profile/:profileId',
  authMiddleware,
  controller.applyProfileToEmployee
);

module.exports = router;