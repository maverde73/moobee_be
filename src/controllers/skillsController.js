/**
 * Skills Controller
 * @module controllers/skillsController
 * @created 2025-10-01 22:50
 * @description Controller per gestire API skills (globali + custom)
 */

const skillsService = require('../services/skillsService');
const logger = require('../utils/logger');

class SkillsController {
  /**
   * GET /api/skills
   * Carica tutte le skills (globali + custom del tenant) con Grading
   */
  async getSkills(req, res) {
    try {
      const {
        tenantId,
        subRoleId,
        search,
        category,
        limit = 1000,
        page = 1,
        employeeRoleIds
      } = req.query;

      // Validazione parametri obbligatori
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId is required'
        });
      }

      if (!subRoleId) {
        return res.status(400).json({
          success: false,
          error: 'subRoleId is required (for loading Grading)'
        });
      }

      // Parse employeeRoleIds se presente (viene passato come JSON string dal frontend)
      let parsedEmployeeRoleIds = null;
      if (employeeRoleIds) {
        try {
          parsedEmployeeRoleIds = JSON.parse(employeeRoleIds);
        } catch (err) {
          logger.warn('Invalid employeeRoleIds format:', employeeRoleIds);
        }
      }

      // Carica skills con grading (max tra i ruoli se employeeRoleIds fornito)
      const skills = await skillsService.getSkills(
        tenantId,
        subRoleId,
        { search, category, limit, page, employeeRoleIds: parsedEmployeeRoleIds }
      );

      logger.info(`Loaded ${skills.length} skills for tenant ${tenantId}, sub-role ${subRoleId}` +
        (parsedEmployeeRoleIds ? ` (max grading from ${parsedEmployeeRoleIds.length} roles)` : ''));

      res.json({
        success: true,
        data: skills,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: skills.length
        }
      });
    } catch (error) {
      logger.error('Error fetching skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch skills',
        details: error.message
      });
    }
  }

  /**
   * POST /api/skills/custom
   * Crea una skill custom per il tenant
   */
  async createCustomSkill(req, res) {
    try {
      const { name, synonyms = [] } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.email || req.user?.id;

      // Validazione
      if (!name || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Skill name must be at least 2 characters'
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID not found in user context'
        });
      }

      // Crea skill custom
      const skill = await skillsService.createCustomSkill(
        tenantId,
        userId,
        { name: name.trim(), synonyms }
      );

      logger.info(`Custom skill created: ${name} by ${userId} for tenant ${tenantId}`);

      res.status(201).json({
        success: true,
        data: skill,
        message: 'Custom skill created successfully'
      });
    } catch (error) {
      logger.error('Error creating custom skill:', error);

      // Gestione errori specifici
      if (error.message.includes('esiste già')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create custom skill',
        details: error.message
      });
    }
  }

  /**
   * DELETE /api/skills/custom/:id
   * Elimina (soft delete) una skill custom
   */
  async deleteCustomSkill(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant ID not found in user context'
        });
      }

      const result = await skillsService.deleteCustomSkill(id, tenantId);

      logger.info(`Custom skill deleted: ${id} by tenant ${tenantId}`);

      res.json(result);
    } catch (error) {
      logger.error('Error deleting custom skill:', error);

      if (error.message.includes('Not authorized')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete custom skill',
        details: error.message
      });
    }
  }

  /**
   * GET /api/skills/:skillId/grading/:subRoleId
   * Ottieni il Grading per una skill + sub-role specifico
   */
  async getSkillGrading(req, res) {
    try {
      const { skillId, subRoleId } = req.params;

      const grading = await skillsService.getSkillGrading(skillId, subRoleId);

      res.json({
        success: true,
        data: {
          skillId: parseInt(skillId),
          subRoleId: parseInt(subRoleId),
          grading: grading,
          gradingStars: skillsService.gradingToStars(grading)
        }
      });
    } catch (error) {
      logger.error('Error fetching skill grading:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch skill grading',
        details: error.message
      });
    }
  }
}

module.exports = new SkillsController();
