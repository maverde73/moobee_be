const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * Analytics Routes
 * All routes require authentication and appropriate permissions
 */

// Get analytics overview
router.get(
  '/overview',
  authenticate,
  analyticsController.getOverview.bind(analyticsController)
);

// Get real-time activity
router.get(
  '/activity',
  authenticate,
  analyticsController.getActivity.bind(analyticsController)
);

// Export analytics data
router.get(
  '/export',
  authenticate,
  analyticsController.exportAnalytics.bind(analyticsController)
);

// Get completion statistics
router.get(
  '/completion-stats',
  authenticate,
  analyticsController.getCompletionStats.bind(analyticsController)
);

// Get AI usage statistics
router.get(
  '/ai-usage',
  authenticate,
  analyticsController.getAIUsageStats.bind(analyticsController)
);

// Get tenant-specific analytics
router.get(
  '/tenant/:tenantId',
  authenticate,
  analyticsController.getTenantAnalytics.bind(analyticsController)
);

module.exports = router;