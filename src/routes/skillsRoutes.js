/**
 * Skills Routes
 * @module routes/skillsRoutes
 * @created 2025-10-01 23:00
 * @description Routes per gestire API skills (globali + custom)
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const skillsController = require('../controllers/skillsController');

/**
 * GET /api/skills
 * Carica tutte le skills (globali + custom del tenant) con Grading
 * Query params: tenantId, subRoleId, search, category, limit, page
 */
router.get('/', authenticate, skillsController.getSkills);

/**
 * POST /api/skills/custom
 * Crea una skill custom per il tenant
 * Body: { name, synonyms }
 * Richiede ruolo HR o ADMIN
 */
router.post('/custom', authenticate, authorize(['HR', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']), skillsController.createCustomSkill);

/**
 * DELETE /api/skills/custom/:id
 * Elimina (soft delete) una skill custom
 * Solo il tenant proprietario può eliminare
 * Richiede ruolo HR o ADMIN
 */
router.delete('/custom/:id', authenticate, authorize(['HR', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']), skillsController.deleteCustomSkill);

/**
 * GET /api/skills/:skillId/grading/:subRoleId
 * Ottieni il Grading per una skill + sub-role specifico
 */
router.get('/:skillId/grading/:subRoleId', authenticate, skillsController.getSkillGrading);

module.exports = router;
