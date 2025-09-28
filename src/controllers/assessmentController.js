/**
 * Assessment Controller - Main controller delegating to modular components
 * Refactored to comply with Giurelli Standards (<500 lines per file)
 * @module controllers/assessmentController
 */

const templateController = require('./assessment/templateController');
const questionController = require('./assessment/questionController');
const validationService = require('./assessment/validationService');
const helperService = require('./assessment/helperService');

/**
 * Assessment Controller - Facade for assessment operations
 * Delegates to specialized modules for actual implementation
 */
class AssessmentController {
  constructor() {
    // Bind all methods to maintain context
    this.getAllTemplates = this.getAllTemplates.bind(this);
    this.getTemplateById = this.getTemplateById.bind(this);
    this.createTemplate = this.createTemplate.bind(this);
    this.updateTemplate = this.updateTemplate.bind(this);
    this.deleteTemplate = this.deleteTemplate.bind(this);
    this.duplicateTemplate = this.duplicateTemplate.bind(this);
    this.addQuestion = this.addQuestion.bind(this);
    this.updateQuestion = this.updateQuestion.bind(this);
    this.deleteQuestion = this.deleteQuestion.bind(this);
    this.reorderQuestions = this.reorderQuestions.bind(this);
    this.getStatistics = this.getStatistics.bind(this);
    this.selectTemplateForTenant = this.selectTemplateForTenant.bind(this);
    this.getTenantSelections = this.getTenantSelections.bind(this);
  }

  /**
   * Template operations - delegated to templateController
   */
  async getAllTemplates(req, res) {
    return templateController.getAllTemplates(req, res);
  }

  async getTemplateById(req, res) {
    return templateController.getTemplateById(req, res);
  }

  async createTemplate(req, res) {
    // Validate before delegating
    const validation = validationService.validateTemplateCreate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    return templateController.createTemplate(req, res);
  }

  async updateTemplate(req, res) {
    // Validate before delegating
    const validation = validationService.validateTemplateUpdate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    return templateController.updateTemplate(req, res);
  }

  async deleteTemplate(req, res) {
    return templateController.deleteTemplate(req, res);
  }

  async duplicateTemplate(req, res) {
    return templateController.duplicateTemplate(req, res);
  }

  /**
   * Question operations - delegated to questionController
   */
  async addQuestion(req, res) {
    // Validate before delegating
    const validation = validationService.validateQuestion(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    return questionController.addQuestion(req, res);
  }

  async updateQuestion(req, res) {
    // Validate before delegating
    const validation = validationService.validateQuestion(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    return questionController.updateQuestion(req, res);
  }

  async deleteQuestion(req, res) {
    return questionController.deleteQuestion(req, res);
  }

  async reorderQuestions(req, res) {
    // Validate before delegating
    const validation = validationService.validateReorder(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    return questionController.reorderQuestions(req, res);
  }

  /**
   * Bulk operations for questions
   */
  async bulkUpdateQuestions(req, res) {
    return questionController.bulkUpdateQuestions(req, res);
  }

  /**
   * Helper operations - delegated to helperService
   */
  async getStatistics(req, res) {
    try {
      const stats = await helperService.getStatistics();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Tenant operations
   */
  async selectTemplateForTenant(req, res) {
    try {
      const validation = validationService.validateTenantSelection(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }

      const { templateId, tenantId } = req.body;
      const result = await helperService.selectTemplateForTenant(templateId, tenantId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTenantSelections(req, res) {
    try {
      const { tenantId } = req.params;
      const selections = await helperService.getTenantSelections(tenantId);
      res.json({ success: true, data: selections });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Legacy method mappings for backward compatibility
   */
  async createAssessmentTemplate(req, res) {
    return this.createTemplate(req, res);
  }

  async getAssessmentTemplates(req, res) {
    return this.getAllTemplates(req, res);
  }

  async getAssessmentTemplate(req, res) {
    return this.getTemplateById(req, res);
  }

  async getAssessmentTemplateById(req, res) {
    return this.getTemplateById(req, res);
  }

  async updateAssessmentTemplate(req, res) {
    return this.updateTemplate(req, res);
  }

  async deleteAssessmentTemplate(req, res) {
    return this.deleteTemplate(req, res);
  }

  async duplicateAssessmentTemplate(req, res) {
    return this.duplicateTemplate(req, res);
  }

  async addQuestionToTemplate(req, res) {
    return this.addQuestion(req, res);
  }

  async updateQuestionInTemplate(req, res) {
    return this.updateQuestion(req, res);
  }

  async deleteQuestionFromTemplate(req, res) {
    return this.deleteQuestion(req, res);
  }

  async reorderTemplateQuestions(req, res) {
    return this.reorderQuestions(req, res);
  }

  async getAssessmentStatistics(req, res) {
    return this.getStatistics(req, res);
  }

  async selectTemplate(req, res) {
    return this.selectTemplateForTenant(req, res);
  }

  async publishAssessmentTemplate(req, res) {
    try {
      const { id } = req.params;
      const result = await templateController.updateTemplate(
        { params: { id }, body: { isActive: true } },
        res
      );
      return result;
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async unpublishAssessmentTemplate(req, res) {
    try {
      const { id } = req.params;
      const result = await templateController.updateTemplate(
        { params: { id }, body: { isActive: false } },
        res
      );
      return result;
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Utility methods exposed for other controllers
   */
  getHelperService() {
    return helperService;
  }

  getValidationService() {
    return validationService;
  }
}

// Export singleton instance for backward compatibility
module.exports = new AssessmentController();