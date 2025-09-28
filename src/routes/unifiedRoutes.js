/**
 * Unified Routes
 * @module routes/unifiedRoutes
 * @created 2025-09-25
 * @description API routes for unified calendar and campaign management
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const unifiedController = require('../controllers/unified/unifiedCampaignController');
const logger = require('../utils/logger');

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route GET /api/unified/calendar
 * @description Get unified calendar data with both engagement and assessment campaigns
 * @access Private
 */
router.get('/calendar', unifiedController.getUnifiedCalendar);

/**
 * @route GET /api/unified/stats
 * @description Get campaign statistics for dashboard
 * @access Private
 */
router.get('/stats', unifiedController.getCampaignStats);

/**
 * @route POST /api/unified/check-conflicts
 * @description Check for scheduling conflicts across all campaign types
 * @access Private
 */
router.post('/check-conflicts', unifiedController.checkConflicts);

/**
 * @route PATCH /api/unified/reschedule
 * @description Reschedule a campaign (drag & drop from calendar)
 * @access Private
 */
router.patch('/reschedule', unifiedController.rescheduleCampaign);

// Log route registration
logger.info('Unified routes registered');

module.exports = router;