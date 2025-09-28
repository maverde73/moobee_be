// Campaign Assignment Routes
// Created: 2025-09-26 16:15
// Purpose: Optimized routes for campaign assignment queries using the view

const router = require('express').Router();
const { authenticateTenantUser } = require('../middlewares/unifiedAuth');
const { campaignAssignmentsLimiter } = require('../middlewares/rateLimiter');
const campaignAssignmentController = require('../controllers/campaign/campaignAssignmentController');

// All routes require authentication
router.use(authenticateTenantUser);

// Apply rate limiting to all routes
router.use(campaignAssignmentsLimiter);

// Get assignments for a single campaign
// GET /api/campaign-assignments/:campaignId?type=engagement|assessment
router.get('/:campaignId', campaignAssignmentController.getCampaignmentAssignments);

// Get assignments for multiple campaigns
// POST /api/campaign-assignments/multiple
router.post('/multiple', campaignAssignmentController.getMultipleCampaignAssignments);

// Get campaign statistics
// GET /api/campaign-assignments/:campaignId/statistics?type=engagement|assessment
router.get('/:campaignId/statistics', campaignAssignmentController.getCampaignStatistics);

// Get assignments grouped by status
// GET /api/campaign-assignments/:campaignId/by-status?type=engagement|assessment
router.get('/:campaignId/by-status', campaignAssignmentController.getAssignmentsByStatus);

module.exports = router;