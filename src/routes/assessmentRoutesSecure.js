/**
 * Secure Assessment Routes with Validation
 * Includes input validation, sanitization, and rate limiting
 * @module routes/assessmentRoutesSecure
 */

const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const assessmentAIController = require('../controllers/assessmentAIController');
const { authenticate } = require('../middlewares/authMiddleware');
const { checkSuperAdmin } = require('../middleware/checkRole');
const {
  body,
  param,
  validationResult,
  handleValidationErrors,
  validationSchemas,
  sanitizeRequest
} = require('../middleware/validation');
const {
  apiLimiter,
  createLimiter,
  aiLimiter
} = require('../middleware/rateLimiter');

// Apply general API rate limiting
router.use(apiLimiter);

// Sanitize all requests
router.use(sanitizeRequest);

// Authentication required for all routes
router.use(authenticate);

// Only Super Admin can manage assessment catalog
router.use(checkSuperAdmin);

/**
 * Validation schemas for assessment routes
 */
const assessmentValidations = {
  createTemplate: [
    body('name')
      .notEmpty().withMessage('Name is required')
      .isString().withMessage('Name must be a string')
      .isLength({ min: 2, max: 200 }).withMessage('Name must be 2-200 characters')
      .trim()
      .escape(),
    body('type')
      .notEmpty().withMessage('Type is required')
      .isIn(['big_five', 'disc', 'belbin'])
      .withMessage('Invalid assessment type'),
    body('description')
      .notEmpty().withMessage('Description is required')
      .isString()
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters')
      .trim(),
    body('instructions')
      .optional()
      .isString()
      .isLength({ max: 2000 }).withMessage('Instructions must not exceed 2000 characters')
      .trim(),
    body('questions')
      .isArray({ min: 1, max: 200 }).withMessage('Questions must be an array with 1-200 items'),
    body('questions.*.text')
      .notEmpty().withMessage('Question text is required')
      .isString()
      .isLength({ max: 500 }).withMessage('Question text must not exceed 500 characters'),
    body('questions.*.type')
      .isIn(['multiple_choice', 'likert_scale', 'text', 'ranking'])
      .withMessage('Invalid question type'),
    body('questions.*.orderIndex')
      .isInt({ min: 1 }).withMessage('Order index must be a positive integer'),
    body('suggestedRoles')
      .optional()
      .isArray({ max: 20 }).withMessage('Suggested roles must be an array with max 20 items'),
    handleValidationErrors
  ],

  updateTemplate: [
    param('id').isInt({ min: 1 }).withMessage('Invalid template ID'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 2, max: 200 }).withMessage('Name must be 2-200 characters')
      .trim()
      .escape(),
    body('description')
      .optional()
      .isString()
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters')
      .trim(),
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean'),
    handleValidationErrors
  ],

  templateId: [
    param('id').isInt({ min: 1 }).withMessage('Invalid template ID'),
    handleValidationErrors
  ],

  aiGenerate: [
    body('type')
      .notEmpty().withMessage('Assessment type is required')
      .isIn(['big_five', 'disc', 'belbin'])
      .withMessage('Invalid assessment type'),
    body('count')
      .optional()
      .isInt({ min: 5, max: 50 }).withMessage('Question count must be between 5 and 50'),
    body('language')
      .optional()
      .isIn(['it', 'en']).withMessage('Language must be it or en'),
    body('context')
      .optional()
      .isString()
      .isLength({ max: 500 }).withMessage('Context must not exceed 500 characters'),
    body('questionType')
      .optional()
      .isIn(['multiple_choice', 'likert_scale', 'text', 'ranking'])
      .withMessage('Invalid question type'),
    body('suggestedRoles')
      .optional()
      .isArray({ max: 10 }).withMessage('Max 10 suggested roles allowed'),
    handleValidationErrors
  ],

  evaluateResponses: [
    body('assessmentId')
      .notEmpty().withMessage('Assessment ID is required')
      .isInt({ min: 1 }),
    body('responses')
      .isArray({ min: 1 }).withMessage('Responses must be a non-empty array'),
    body('responses.*.questionId')
      .isInt({ min: 1 }).withMessage('Invalid question ID'),
    body('responses.*.answer')
      .notEmpty().withMessage('Answer is required'),
    handleValidationErrors
  ]
};

// Template Management Routes
router.post('/api/admin/assessment-catalog',
  createLimiter, // Stricter rate limit for creation
  assessmentValidations.createTemplate,
  assessmentController.createAssessmentTemplate
);

router.get('/api/admin/assessment-catalog',
  assessmentController.getAssessmentTemplates
);

router.get('/api/admin/assessment-catalog/:id',
  assessmentValidations.templateId,
  assessmentController.getAssessmentTemplate
);

router.put('/api/admin/assessment-catalog/:id',
  assessmentValidations.updateTemplate,
  assessmentController.updateAssessmentTemplate
);

router.delete('/api/admin/assessment-catalog/:id',
  assessmentValidations.templateId,
  assessmentController.deleteAssessmentTemplate
);

router.post('/api/admin/assessment-catalog/:id/publish',
  assessmentValidations.templateId,
  assessmentController.publishAssessmentTemplate
);

router.post('/api/admin/assessment-catalog/:id/unpublish',
  assessmentValidations.templateId,
  assessmentController.unpublishAssessmentTemplate
);

// AI-powered endpoints with stricter rate limiting
router.post('/api/admin/assessment-catalog/ai/generate-questions',
  aiLimiter, // Very strict rate limit for AI operations
  assessmentValidations.aiGenerate,
  assessmentAIController.generateQuestionsWithAI
);

router.post('/api/admin/assessment-catalog/ai/evaluate-responses',
  aiLimiter,
  assessmentValidations.evaluateResponses,
  assessmentAIController.evaluateResponsesWithAI
);

router.post('/api/admin/assessment-catalog/ai/generate-report',
  aiLimiter,
  body('assessmentId').isInt({ min: 1 }).withMessage('Invalid assessment ID'),
  body('employeeId').isInt({ min: 1 }).withMessage('Invalid employee ID'),
  handleValidationErrors,
  assessmentAIController.generateReportWithAI
);

router.post('/api/admin/assessment-catalog/ai/improve-questions',
  aiLimiter,
  body('questions').isArray({ min: 1, max: 50 }).withMessage('Questions must be array with 1-50 items'),
  handleValidationErrors,
  assessmentAIController.getImprovementSuggestions
);

router.post('/api/admin/assessment-catalog/ai/generate-prompt',
  aiLimiter,
  body('templateType').notEmpty().withMessage('Template type is required'),
  body('context').optional().isString().isLength({ max: 1000 }),
  handleValidationErrors,
  assessmentAIController.generateCustomPrompt
);

// Error handling middleware specific to this router
router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large'
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }

  // Pass to general error handler
  next(error);
});

module.exports = router;