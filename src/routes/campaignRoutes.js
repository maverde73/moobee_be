/**
 * Campaign Routes
 * @module routes/campaignRoutes
 * @created 2025-09-24
 * @description Routes for campaign management
 */

const router = require('express').Router();
const {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaignStatus,
  deleteCampaign,
  sendNotifications,
  getCampaignStats
} = require('../controllers/engagement/engagementCampaignController');

const {
  getCampaignAssignments,
  getEmployeeAssignments,
  addAssignments,
  removeAssignment,
  updateAssignmentStatus
} = require('../controllers/engagement/campaignAssignmentController');

const { authenticate } = require('../middlewares/authMiddleware');

// Apply authentication to all routes
router.use(authenticate);

// ========================================
// Campaign Management Routes
// ========================================

// Check conflicts (custom endpoint) - MUST be before :id routes
router.post('/campaigns/check-conflicts', async (req, res) => {
  const { employeeIds, startDate, endDate } = req.body;
  const tenantId = req.user.tenantId || req.user.tenant_id;

  try {
    // Import the function
    const { checkEmployeeConflicts } = require('../controllers/engagement/engagementCampaignController');

    // Validate input
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Employee IDs array is required'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start and end dates are required'
      });
    }

    const result = await checkEmployeeConflicts(
      employeeIds,
      new Date(startDate),
      new Date(endDate),
      tenantId
    );

    res.json(result);
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check conflicts',
      details: error.message
    });
  }
});

// Get all campaigns
router.get('/campaigns', getCampaigns);

// Get single campaign
router.get('/campaigns/:id', getCampaignById);

// Create new campaign
router.post('/campaigns', createCampaign);

// Update campaign status
router.patch('/campaigns/:id/status', updateCampaignStatus);

// Delete campaign
router.delete('/campaigns/:id', deleteCampaign);

// Send notifications
router.post('/campaigns/:id/notify', sendNotifications);

// Get campaign statistics
router.get('/campaigns/:id/stats', getCampaignStats);

// ========================================
// Assignment Management Routes
// ========================================

// Get assignments for a campaign
router.get('/campaigns/:campaignId/assignments', getCampaignAssignments);

// Add assignments to campaign
router.post('/campaigns/:campaignId/assignments', addAssignments);

// Remove assignment
router.delete('/campaigns/:campaignId/assignments/:assignmentId', removeAssignment);

// Get employee's assignments
router.get('/employees/:employeeId/assignments', getEmployeeAssignments);

// Update assignment status
router.patch('/assignments/:assignmentId/status', updateAssignmentStatus);

module.exports = router;