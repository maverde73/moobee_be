/**
 * Role-Based Assessment Routes
 * Routes per gestione assessment basati su ruolo e soft skills
 * @module routes/roleBasedAssessmentRoutes
 */

const express = require('express');
const router = express.Router();
const {
  getRecommendedTemplatesForRole,
  calculateRoleFit,
  getEmployeeRoleSkillsAssessment,
  getRoleSkillRequirements,
  getSoftSkillsDashboard
} = require('../controllers/roleBasedAssessmentController');

// Middleware di autenticazione
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/assessments/roles/:roleId/templates
 * @desc    Ottieni template assessment raccomandati per ruolo
 * @access  Private
 */
router.get('/roles/:roleId/templates', authenticate, getRecommendedTemplatesForRole);

/**
 * @route   POST /api/assessments/:id/calculate-role-fit
 * @desc    Calcola fit per ruolo dopo completamento assessment
 * @access  Private
 * @body    { employeeId, roleId, responses: {questionId: value} }
 */
router.post('/:id/calculate-role-fit', authenticate, calculateRoleFit);

/**
 * @route   GET /api/employees/:id/role-skills-assessment
 * @desc    Ottieni valutazione skills per ruolo corrente del dipendente
 * @access  Private
 * @query   roleId (opzionale) - Se non specificato usa ruolo corrente
 */
router.get('/employees/:id/role-skills-assessment', authenticate, getEmployeeRoleSkillsAssessment);

/**
 * @route   GET /api/roles/:roleId/skill-requirements
 * @desc    Ottieni requisiti soft skills per ruolo
 * @access  Private
 * @query   includeDescriptions (true/false) - Include descrizioni dettagliate
 */
router.get('/roles/:roleId/skill-requirements', authenticate, getRoleSkillRequirements);

/**
 * @route   GET /api/soft-skills/dashboard/:employeeId
 * @desc    Dashboard completa soft skills per dipendente
 * @access  Private
 * @query   compareWithRole (roleId) - Confronta con requisiti ruolo
 * @query   timeRange (3m/6m/1y) - Range temporale per trends
 */
router.get('/soft-skills/dashboard/:employeeId', authenticate, getSoftSkillsDashboard);

// Route pubblica per testing (rimuovere in produzione)
if (process.env.NODE_ENV === 'development') {
  /**
   * @route   GET /api/assessments/test/role-mapping
   * @desc    Test endpoint per verificare mapping
   * @access  Public (solo development)
   */
  router.get('/test/role-mapping', async (req, res) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const stats = {
        totalRoles: await prisma.roles.count(),
        rolesWithSkills: await prisma.roleSoftSkill.count(),
        totalSoftSkills: await prisma.softSkill.count(),
        questionMappings: await prisma.questionSoftSkillMapping.count(),
        assessmentTemplates: await prisma.assessmentTemplate.count()
      };

      res.json({
        success: true,
        environment: 'development',
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await prisma.$disconnect();
    }
  });
}

module.exports = router;