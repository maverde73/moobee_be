/**
 * Assessment Campaign Routes
 * Created: September 25, 2025
 *
 * Routes for managing assessment campaigns and assignments
 */

const express = require('express');
const router = express.Router();
const assessmentCampaignController = require('../controllers/assessment/assessmentCampaignController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validationMiddleware');
const { body, param, query } = require('express-validator');

// All routes require authentication
router.use(authenticate);

/**
 * Validation schemas
 */
const createCampaignValidation = [
  body('templateId').notEmpty().isInt().withMessage('Valid template ID is required'),
  body('employeeIds').isArray({ min: 1 }).withMessage('At least one employee must be selected'),
  body('startDate').isISO8601().toDate().withMessage('Valid start date is required'),
  body('deadline').isISO8601().toDate().withMessage('Valid deadline is required'),
  body('name').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('frequency').optional().isIn(['once', 'recurring']),
  body('mandatory').optional().isBoolean(),
  body('allowRetakes').optional().isBoolean(),
  body('maxAttempts').optional().isInt({ min: 1, max: 10 })
];

const checkConflictsValidation = [
  body('employeeIds').isArray({ min: 1 }).withMessage('Employee IDs are required'),
  body('startDate').isISO8601().toDate().withMessage('Valid start date is required'),
  body('deadline').isISO8601().toDate().withMessage('Valid deadline is required'),
  body('assessmentType').optional().isString(),
  body('excludeCampaignId').optional().isUUID()
];

const updateStatusValidation = [
  param('id').isUUID().withMessage('Valid campaign ID is required'),
  body('status').isIn(['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).withMessage('Invalid status')
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'])
];

/**
 * Routes
 */

// Check conflicts before creating campaign
router.post('/check-conflicts',
  checkConflictsValidation,
  validateRequest,
  assessmentCampaignController.checkConflicts
);

// Create new campaign
router.post('/',
  createCampaignValidation,
  validateRequest,
  assessmentCampaignController.createCampaign
);

// Get all campaigns
router.get('/',
  paginationValidation,
  validateRequest,
  assessmentCampaignController.getCampaigns
);

// Get single campaign
router.get('/:id',
  param('id').isUUID(),
  validateRequest,
  assessmentCampaignController.getCampaignById
);

// Get campaign statistics
router.get('/:id/stats',
  param('id').isUUID(),
  validateRequest,
  assessmentCampaignController.getCampaignStats
);

// Update campaign status
router.patch('/:id/status',
  updateStatusValidation,
  validateRequest,
  assessmentCampaignController.updateCampaignStatus
);

// Delete campaign (only if not started)
router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  assessmentCampaignController.deleteCampaign
);

module.exports = router;