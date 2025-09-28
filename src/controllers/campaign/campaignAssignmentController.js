// Campaign Assignment Controller
// Created: 2025-09-26 16:16
// Purpose: Controller for optimized campaign assignment queries using the view

const campaignAssignmentService = require('../../services/campaignAssignmentService');

/**
 * Get all assignments for a campaign with employee details
 */
const getCampaignmentAssignments = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { type } = req.query;

    if (!type || !['engagement', 'assessment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Campaign type must be specified as "engagement" or "assessment"'
      });
    }

    const assignments = await campaignAssignmentService.getCampaignAssignmentDetails(
      campaignId,
      type
    );

    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Error fetching campaign assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign assignments',
      error: error.message
    });
  }
};

/**
 * Get assignments for multiple campaigns
 */
const getMultipleCampaignAssignments = async (req, res) => {
  try {
    const { campaignIds } = req.body;
    const tenantId = req.user?.tenantId || req.tenantUser?.tenantId;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant ID not found'
      });
    }

    if (!Array.isArray(campaignIds)) {
      return res.status(400).json({
        success: false,
        message: 'campaignIds must be an array'
      });
    }

    const assignments = await campaignAssignmentService.getMultipleCampaignAssignments(
      campaignIds,
      tenantId
    );

    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Error fetching multiple campaign assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign assignments',
      error: error.message
    });
  }
};

/**
 * Get campaign statistics
 */
const getCampaignStatistics = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { type } = req.query;

    if (!type || !['engagement', 'assessment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Campaign type must be specified as "engagement" or "assessment"'
      });
    }

    const statistics = await campaignAssignmentService.getCampaignStatistics(
      campaignId,
      type
    );

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching campaign statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign statistics',
      error: error.message
    });
  }
};

/**
 * Get assignments grouped by status
 */
const getAssignmentsByStatus = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { type } = req.query;

    if (!type || !['engagement', 'assessment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Campaign type must be specified as "engagement" or "assessment"'
      });
    }

    const groupedAssignments = await campaignAssignmentService.getAssignmentsByStatus(
      campaignId,
      type
    );

    res.json({
      success: true,
      data: groupedAssignments
    });
  } catch (error) {
    console.error('Error fetching assignments by status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments by status',
      error: error.message
    });
  }
};

module.exports = {
  getCampaignmentAssignments,
  getMultipleCampaignAssignments,
  getCampaignStatistics,
  getAssignmentsByStatus
};