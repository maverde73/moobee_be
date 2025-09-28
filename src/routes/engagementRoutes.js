/**
 * Engagement Routes
 * @module routes/engagementRoutes
 * @created 2025-09-22
 * @description API routes for engagement management system
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Import controllers
const templateController = require('../controllers/engagement/engagementTemplateController');
const aiController = require('../controllers/engagement/engagementAIController');
const aiProvidersController = require('../controllers/engagement/aiProvidersController');
const campaignController = require('../controllers/engagement/engagementCampaignController');
// TODO: Create these controllers
// const analyticsController = require('../controllers/engagement/engagementAnalyticsController');

// ========================================
// TEMPLATE ROUTES
// ========================================

/**
 * @route GET /api/engagement/templates
 * @desc Get all engagement templates with filters
 * @access Private (HR, Admin)
 */
router.get(
  '/templates',
  authenticate,
  authorize(['hr', 'hr_manager', 'manager', 'admin', 'super_admin', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  templateController.getTemplates
);

/**
 * @route GET /api/engagement/templates/:id
 * @desc Get single template by ID
 * @access Private (HR, Admin)
 */
router.get(
  '/templates/:id',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  (req, res, next) => {
    console.log('=== ROUTE HIT: /templates/:id ===');
    console.log('Template ID in route:', req.params.id);
    console.log('User in route:', req.user);
    next();
  },
  templateController.getTemplateById
);

/**
 * @route POST /api/engagement/templates
 * @desc Create new engagement template
 * @access Private (HR, Admin)
 */
router.post(
  '/templates',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  templateController.createTemplate
);

/**
 * @route PUT /api/engagement/templates/:id
 * @desc Update engagement template
 * @access Private (HR, Admin)
 */
router.put(
  '/templates/:id',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  templateController.updateTemplate
);

/**
 * @route DELETE /api/engagement/templates/:id
 * @desc Delete engagement template
 * @access Private (Admin only)
 */
router.delete(
  '/templates/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  templateController.deleteTemplate
);

/**
 * @route POST /api/engagement/templates/:id/duplicate
 * @desc Duplicate engagement template
 * @access Private (HR, Admin)
 */
router.post(
  '/templates/:id/duplicate',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  templateController.duplicateTemplate
);

/**
 * @route PATCH /api/engagement/templates/:id/status
 * @desc Change template status (DRAFT, PUBLISHED, ARCHIVED)
 * @access Private (HR, Admin)
 */
router.patch(
  '/templates/:id/status',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  templateController.changeStatus
);

// ========================================
// AI ROUTES
// ========================================

/**
 * @route POST /api/engagement/ai/generate-questions
 * @desc Generate engagement questions with AI
 * @access Private (HR, Admin)
 */
router.post(
  '/ai/generate-questions',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  aiController.generateQuestions
);

/**
 * @route POST /api/engagement/ai/suggestions
 * @desc Get AI suggestions for improving engagement
 * @access Private (HR, Admin)
 */
router.post(
  '/ai/suggestions',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  aiController.getAISuggestions
);

/**
 * @route GET /api/engagement/ai/test-connection
 * @desc Test AI service connection
 * @access Private (Admin)
 */
router.get(
  '/ai/test-connection',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  aiController.testConnection
);

/**
 * @route GET /api/engagement/ai/providers
 * @desc Get all available AI providers and their models
 * @access Private (HR, Admin)
 */
router.get(
  '/ai/providers',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  aiProvidersController.getProviders
);

/**
 * @route GET /api/engagement/ai/providers/:provider
 * @desc Get models for a specific AI provider
 * @access Private (HR, Admin)
 */
router.get(
  '/ai/providers/:provider',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  aiProvidersController.getProviderModels
);

// ========================================
// CAMPAIGN ROUTES
// ========================================

/**
 * @route GET /api/engagement/campaigns
 * @desc Get all campaigns
 * @access Private (HR, Admin)
 */
router.get(
  '/campaigns',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  campaignController.getCampaigns
);

/**
 * @route GET /api/engagement/campaigns/:id
 * @desc Get single campaign by ID
 * @access Private (HR, Admin)
 */
router.get(
  '/campaigns/:id',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  campaignController.getCampaignById
);

/**
 * @route GET /api/engagement/campaigns/:id/stats
 * @desc Get campaign statistics
 * @access Private (HR, Admin)
 */
router.get(
  '/campaigns/:id/stats',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  campaignController.getCampaignStats
);

/**
 * @route POST /api/engagement/campaigns
 * @desc Create new campaign
 * @access Private (HR, Admin)
 */
router.post(
  '/campaigns',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  campaignController.createCampaign
);

/**
 * @route PATCH /api/engagement/campaigns/:id/status
 * @desc Update campaign status
 * @access Private (HR, Admin)
 */
router.patch(
  '/campaigns/:id/status',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  campaignController.updateCampaignStatus
);

/**
 * @route DELETE /api/engagement/campaigns/:id
 * @desc Delete campaign
 * @access Private (Admin only)
 */
router.delete(
  '/campaigns/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  campaignController.deleteCampaign
);

/**
 * @route POST /api/engagement/campaigns/:id/notify
 * @desc Send notifications for campaign
 * @access Private (HR, Admin)
 */
router.post(
  '/campaigns/:id/notify',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  campaignController.sendNotifications
);

// ========================================
// ANALYTICS ROUTES (To be implemented)
// ========================================

/**
 * @route GET /api/engagement/analytics/overview
 * @desc Get engagement analytics overview
 * @access Private (HR, Admin)
 */
router.get(
  '/analytics/overview',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER']),
  (req, res) => {
    try {
      // Return mock data for now
      res.json({
        success: true,
        data: {
          totalTemplates: 0,
          activeCampaigns: 0,
          averageScore: 0,
          participationRate: 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics'
      });
    }
  }
);

/**
 * @route GET /api/engagement/analytics/by-role
 * @desc Get engagement scores by role
 * @access Private (HR, Admin)
 */
router.get(
  '/analytics/by-role',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  (req, res) => {
    // Placeholder
    res.json({
      success: true,
      data: [],
      message: 'Role analytics to be implemented'
    });
  }
);

/**
 * @route GET /api/engagement/analytics/trends
 * @desc Get engagement trends over time
 * @access Private (HR, Admin)
 */
router.get(
  '/analytics/trends',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  (req, res) => {
    // Placeholder
    res.json({
      success: true,
      data: [],
      message: 'Trend analytics to be implemented'
    });
  }
);

// ========================================
// RESPONSE ROUTES (For employees)
// ========================================

/**
 * @route GET /api/engagement/my-surveys
 * @desc Get employee's pending/completed surveys
 * @access Private (All authenticated users)
 */
router.get(
  '/my-surveys',
  authenticate,
  (req, res) => {
    // Placeholder
    res.json({
      success: true,
      data: {
        pending: [],
        completed: []
      },
      message: 'Employee survey endpoint to be implemented'
    });
  }
);

/**
 * @route POST /api/engagement/responses
 * @desc Submit engagement survey response
 * @access Private (All authenticated users)
 */
router.post(
  '/responses',
  authenticate,
  (req, res) => {
    // Placeholder
    res.json({
      success: true,
      message: 'Response submission to be implemented'
    });
  }
);

// ========================================
// ACTION PLAN ROUTES
// ========================================

/**
 * @route GET /api/engagement/action-plans
 * @desc Get action plans
 * @access Private (HR, Admin, Manager)
 */
router.get(
  '/action-plans',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER']),
  (req, res) => {
    // Placeholder
    res.json({
      success: true,
      data: [],
      message: 'Action plans to be implemented'
    });
  }
);

/**
 * @route POST /api/engagement/action-plans
 * @desc Create action plan
 * @access Private (HR, Admin, Manager)
 */
router.post(
  '/action-plans',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER']),
  (req, res) => {
    // Placeholder
    res.json({
      success: true,
      message: 'Action plan creation to be implemented'
    });
  }
);

// ========================================
// EMPLOYEE ASSIGNMENT ROUTES
// ========================================

const employeeAssignmentController = require('../controllers/engagement/employeeEngagementAssignmentController');

/**
 * @route GET /api/engagement/my-assignments
 * @desc Get current employee's engagement assignments
 * @access Private (Employee, HR, Admin)
 */
router.get(
  '/my-assignments',
  authenticate,
  employeeAssignmentController.getMyEngagementAssignments
);

/**
 * @route GET /api/engagement/assignments/:id
 * @desc Get single assignment details
 * @access Private (Employee, HR, Admin)
 */
router.get(
  '/assignments/:id',
  authenticate,
  employeeAssignmentController.getMyEngagementAssignments
);

/**
 * @route PATCH /api/engagement/assignments/:id/start
 * @desc Start an engagement (mark as IN_PROGRESS)
 * @access Private (Employee)
 */
router.patch(
  '/assignments/:id/start',
  authenticate,
  employeeAssignmentController.startEngagement
);

/**
 * @route POST /api/engagement/assignments/:id/submit
 * @desc Submit engagement responses
 * @access Private (Employee)
 */
router.post(
  '/assignments/:id/submit',
  authenticate,
  employeeAssignmentController.submitEngagementResponse
);

// ============= ENGAGEMENT RESULTS ROUTES =============
const engagementResultsController = require('../controllers/engagement/engagementResultsController');
const engagementWeightedResultsController = require('../controllers/engagement/engagementWeightedResultsController');

/**
 * @route GET /api/engagement/my-results
 * @desc Get my engagement results for dashboard
 * @access Private (Employee)
 */
router.get('/my-results',
  authenticate,
  engagementResultsController.getMyEngagementResults
);

/**
 * @route GET /api/engagement/campaigns/:campaignId/results
 * @desc Get specific campaign results
 * @access Private (Employee)
 */
router.get('/campaigns/:campaignId/results',
  authenticate,
  engagementResultsController.getEngagementResultsByCampaign
);

// ============= WEIGHTED ENGAGEMENT RESULTS ROUTES =============

/**
 * @route POST /api/engagement/assignments/:id/submit-weighted
 * @desc Submit engagement with weighted scoring
 * @access Private (Employee)
 */
router.post('/assignments/:id/submit-weighted',
  authenticate,
  engagementWeightedResultsController.submitWeightedEngagement
);

/**
 * @route GET /api/engagement/weighted-results
 * @desc Get weighted engagement results
 * @access Private (Employee)
 */
router.get('/weighted-results',
  authenticate,
  engagementWeightedResultsController.getWeightedEngagementResults
);

/**
 * @route GET /api/engagement/trends
 * @desc Get engagement trends analysis
 * @access Private (Employee)
 */
router.get('/trends',
  authenticate,
  engagementWeightedResultsController.getEngagementTrends
);

module.exports = router;