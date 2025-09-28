/**
 * Assessment Campaign Assignment Controller
 * Handles assignment-specific operations for assessment campaigns
 * Extracted from main controller to comply with Giurelli's Standards
 */

const prisma = require('../../config/database');
const campaignValidators = require('./validators/assessmentCampaignValidators');
const assignmentService = require('../../services/assessmentAssignmentService');

// Add assignments to a campaign
const addAssignments = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id: campaignId } = req.params;
    const { assignments } = req.body;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    // Validate assignments
    const assignmentValidation = campaignValidators.validateAssignments(assignments);
    if (!assignmentValidation.valid) {
      return res.status(400).json({
        success: false,
        error: assignmentValidation.error
      });
    }

    const result = await assignmentService.addAssignments(
      campaignId,
      tenantId,
      assignments
    );

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: `${result.data.length} assignments added successfully`
    });
  } catch (error) {
    console.error('Error adding assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add assignments',
      details: error.message
    });
  }
};

// Remove assignment from campaign
const removeAssignment = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id: campaignId, assignmentId } = req.params;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    const result = await assignmentService.removeAssignment(
      campaignId,
      assignmentId,
      tenantId
    );

    if (result.error) {
      return res.status(result.status || 404).json({
        success: false,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    console.error('Error removing assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove assignment',
      details: error.message
    });
  }
};

// Update assignment status
const updateAssignmentStatus = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id: campaignId, assignmentId } = req.params;
    const { status } = req.body;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    const result = await assignmentService.updateAssignmentStatus(
      campaignId,
      assignmentId,
      tenantId,
      status
    );

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update assignment status',
      details: error.message
    });
  }
};

// Get assignments for a campaign
const getCampaignAssignments = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id: campaignId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    const result = await assignmentService.getCampaignAssignments(
      campaignId,
      tenantId,
      {
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    );

    if (result.error) {
      return res.status(result.status || 404).json({
        success: false,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.assignments,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignments',
      details: error.message
    });
  }
};

// Bulk update assignments
const bulkUpdateAssignments = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id: campaignId } = req.params;
    const { assignmentIds, action, data } = req.body;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    if (!assignmentIds || !Array.isArray(assignmentIds) || !action) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bulk update request'
      });
    }

    const result = await assignmentService.bulkUpdateAssignments(
      campaignId,
      tenantId,
      assignmentIds,
      action,
      data
    );

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: `${result.count} assignments updated successfully`
    });
  } catch (error) {
    console.error('Error bulk updating assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update assignments',
      details: error.message
    });
  }
};

// Get user's assignments
const getUserAssignments = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const userId = req.tenantUser?.id || req.user?.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    const result = await assignmentService.getUserAssignments(
      userId,
      tenantId,
      {
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    );

    res.status(200).json({
      success: true,
      data: result.assignments,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching user assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user assignments',
      details: error.message
    });
  }
};

module.exports = {
  addAssignments,
  removeAssignment,
  updateAssignmentStatus,
  getCampaignAssignments,
  bulkUpdateAssignments,
  getUserAssignments
};