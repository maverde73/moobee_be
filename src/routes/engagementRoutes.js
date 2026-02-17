/**
 * Engagement Routes
 * @module routes/engagementRoutes
 * @created 2025-09-22
 * @description API routes for engagement management system
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const prisma = require('../config/database');

// Import controllers
const templateController = require('../controllers/engagement/engagementTemplateController');
const builderController = require('../controllers/engagement/engagementBuilderController');
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
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;

      const [totalTemplates, activeCampaigns, avgResult, assignmentCounts] = await Promise.all([
        prisma.engagement_templates.count({
          where: { tenant_id: tenantId }
        }),
        prisma.engagement_campaigns.count({
          where: { tenant_id: tenantId, status: 'ACTIVE' }
        }),
        prisma.engagement_surveys.aggregate({
          _avg: { overall_score: true },
          where: { tenant_id: tenantId }
        }),
        prisma.engagement_campaign_assignments.groupBy({
          by: ['status'],
          where: {
            campaign: { tenant_id: tenantId }
          },
          _count: true
        })
      ]);

      const totalAssignments = assignmentCounts.reduce((sum, g) => sum + g._count, 0);
      const completedAssignments = assignmentCounts.find(g => g.status === 'COMPLETED')?._count || 0;
      const participationRate = totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

      res.json({
        success: true,
        data: {
          totalTemplates,
          activeCampaigns,
          averageScore: avgResult._avg.overall_score ? Number(avgResult._avg.overall_score) : 0,
          participationRate
        }
      });
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
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
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;

      const results = await prisma.$queryRaw`
        SELECT
          r."Role" as role_name,
          COUNT(es.id)::int as response_count,
          ROUND(AVG(es.job_satisfaction)::numeric, 2) as avg_job_satisfaction,
          ROUND(AVG(es.work_life_balance)::numeric, 2) as avg_work_life_balance,
          ROUND(AVG(es.career_development)::numeric, 2) as avg_career_development,
          ROUND(AVG(es.team_collaboration)::numeric, 2) as avg_team_collaboration,
          ROUND(AVG(es.manager_support)::numeric, 2) as avg_manager_support,
          ROUND(AVG(es.overall_score)::numeric, 2) as avg_overall_score
        FROM engagement_surveys es
        JOIN employees e ON es.employee_id = e.id
        JOIN employee_roles er ON e.id = er.employee_id
        JOIN sub_roles sr ON er.sub_role_id = sr.id
        JOIN role_sub_role rsr ON sr.id = rsr.sub_role_id
        JOIN roles r ON rsr.role_id = r.id
        WHERE es.tenant_id = ${tenantId}::uuid
        GROUP BY r."Role"
        ORDER BY avg_overall_score DESC
      `;

      res.json({
        success: true,
        data: results.map(r => ({
          ...r,
          avg_job_satisfaction: r.avg_job_satisfaction ? Number(r.avg_job_satisfaction) : null,
          avg_work_life_balance: r.avg_work_life_balance ? Number(r.avg_work_life_balance) : null,
          avg_career_development: r.avg_career_development ? Number(r.avg_career_development) : null,
          avg_team_collaboration: r.avg_team_collaboration ? Number(r.avg_team_collaboration) : null,
          avg_manager_support: r.avg_manager_support ? Number(r.avg_manager_support) : null,
          avg_overall_score: r.avg_overall_score ? Number(r.avg_overall_score) : null
        }))
      });
    } catch (error) {
      console.error('Error fetching role analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch role analytics'
      });
    }
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
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;

      const results = await prisma.$queryRaw`
        SELECT
          DATE_TRUNC('month', survey_month) as month,
          COUNT(id)::int as response_count,
          ROUND(AVG(job_satisfaction)::numeric, 2) as avg_job_satisfaction,
          ROUND(AVG(work_life_balance)::numeric, 2) as avg_work_life_balance,
          ROUND(AVG(career_development)::numeric, 2) as avg_career_development,
          ROUND(AVG(team_collaboration)::numeric, 2) as avg_team_collaboration,
          ROUND(AVG(manager_support)::numeric, 2) as avg_manager_support,
          ROUND(AVG(overall_score)::numeric, 2) as avg_overall_score
        FROM engagement_surveys
        WHERE tenant_id = ${tenantId}::uuid
          AND survey_month >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', survey_month)
        ORDER BY month ASC
      `;

      res.json({
        success: true,
        data: results.map(r => ({
          month: r.month,
          response_count: r.response_count,
          avg_job_satisfaction: r.avg_job_satisfaction ? Number(r.avg_job_satisfaction) : null,
          avg_work_life_balance: r.avg_work_life_balance ? Number(r.avg_work_life_balance) : null,
          avg_career_development: r.avg_career_development ? Number(r.avg_career_development) : null,
          avg_team_collaboration: r.avg_team_collaboration ? Number(r.avg_team_collaboration) : null,
          avg_manager_support: r.avg_manager_support ? Number(r.avg_manager_support) : null,
          avg_overall_score: r.avg_overall_score ? Number(r.avg_overall_score) : null
        }))
      });
    } catch (error) {
      console.error('Error fetching trend analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trend analytics'
      });
    }
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
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId || req.user.employee_id;
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID not found in token' });
      }

      const assignments = await prisma.engagement_campaign_assignments.findMany({
        where: { employee_id: employeeId },
        include: {
          campaign: {
            include: {
              template: { select: { id: true, title: true, description: true, category: true } }
            }
          }
        },
        orderBy: { assigned_at: 'desc' }
      });

      const pending = assignments
        .filter(a => a.status !== 'COMPLETED')
        .map(a => ({
          assignmentId: a.id,
          campaignId: a.campaign_id,
          campaignName: a.campaign.name,
          templateTitle: a.campaign.template?.title,
          description: a.campaign.description,
          status: a.status,
          startDate: a.campaign.start_date,
          endDate: a.campaign.end_date,
          assignedAt: a.assigned_at
        }));

      const completed = assignments
        .filter(a => a.status === 'COMPLETED')
        .map(a => ({
          assignmentId: a.id,
          campaignId: a.campaign_id,
          campaignName: a.campaign.name,
          templateTitle: a.campaign.template?.title,
          description: a.campaign.description,
          status: a.status,
          completedAt: a.completed_at,
          completionRate: a.completion_rate
        }));

      res.json({
        success: true,
        data: { pending, completed }
      });
    } catch (error) {
      console.error('Error fetching my surveys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch surveys'
      });
    }
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
    // Response submission is handled via POST /assignments/:id/submit
    res.status(301).json({
      success: false,
      error: 'Use POST /api/engagement/assignments/:id/submit instead',
      redirect: '/api/engagement/assignments/:assignmentId/submit'
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
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;

      const actionPlans = await prisma.action_plans.findMany({
        where: { tenant_id: tenantId },
        include: {
          role: { select: { id: true, Role: true } }
        },
        orderBy: { created_at: 'desc' }
      });

      res.json({
        success: true,
        data: actionPlans
      });
    } catch (error) {
      console.error('Error fetching action plans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch action plans'
      });
    }
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
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      const userId = req.user.userId || req.user.id;
      const { name, area, description, actions, target_metrics, role_id, status, start_date, end_date } = req.body;

      if (!name || !area || !description) {
        return res.status(400).json({
          success: false,
          error: 'name, area, and description are required'
        });
      }

      const actionPlan = await prisma.action_plans.create({
        data: {
          tenant_id: tenantId,
          name,
          area,
          description,
          actions: actions || [],
          target_metrics: target_metrics || {},
          role_id: role_id ? parseInt(role_id) : null,
          status: status || 'DRAFT',
          start_date: start_date ? new Date(start_date) : null,
          end_date: end_date ? new Date(end_date) : null,
          created_by: userId
        }
      });

      res.status(201).json({
        success: true,
        data: actionPlan
      });
    } catch (error) {
      console.error('Error creating action plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create action plan'
      });
    }
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

// ========================================
// ENGAGEMENT BUILDER ROUTES
// ========================================

/**
 * @route GET /api/engagement/suggestions/role/:roleId
 * @desc Get engagement suggestions based on role
 * @access Private (HR, Admin)
 */
router.get(
  '/suggestions/role/:roleId',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  builderController.getRoleSuggestions
);

/**
 * @route POST /api/engagement/builder/templates
 * @desc Create engagement template via builder
 * @access Private (HR, Admin)
 */
router.post(
  '/builder/templates',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  builderController.createBuilderTemplate
);

/**
 * @route PUT /api/engagement/builder/templates/:id
 * @desc Update engagement template via builder
 * @access Private (HR, Admin)
 */
router.put(
  '/builder/templates/:id',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  builderController.updateBuilderTemplate
);

/**
 * @route GET /api/engagement/builder/templates/:id
 * @desc Get engagement template builder config
 * @access Private (HR, Admin)
 */
router.get(
  '/builder/templates/:id',
  authenticate,
  authorize(['hr', 'hr_manager', 'HR', 'ADMIN', 'SUPER_ADMIN']),
  builderController.getBuilderTemplate
);

/**
 * @route POST /api/engagement/builder/validate
 * @desc Validate template configuration
 * @access Private (HR, Admin)
 */
router.post(
  '/builder/validate',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  builderController.validateTemplate
);

/**
 * @route POST /api/engagement/builder/preview
 * @desc Preview template as it would appear to respondents
 * @access Private (HR, Admin)
 */
router.post(
  '/builder/preview',
  authenticate,
  authorize(['HR', 'ADMIN', 'SUPER_ADMIN']),
  builderController.previewTemplate
);

module.exports = router;