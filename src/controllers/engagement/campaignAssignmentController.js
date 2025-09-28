/**
 * Campaign Assignment Controller
 * @module controllers/engagement/campaignAssignmentController
 * @created 2025-09-24
 * @description Gestione assegnazioni dipendenti alle campagne
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

/**
 * Get assignments for a campaign
 * @route GET /api/engagement/campaigns/:campaignId/assignments
 */
const getCampaignAssignments = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Verify campaign belongs to tenant
    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id: campaignId,
        tenant_id: tenantId
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const assignments = await prisma.engagement_campaign_assignments.findMany({
      where: {
        campaign_id: campaignId
      },
      include: {
        campaign: {
          select: {
            name: true,
            start_date: true,
            end_date: true
          }
        }
      },
      orderBy: {
        assigned_at: 'desc'
      }
    });

    // Get employee details from tenant_users
    const employeeIds = assignments.map(a => a.employee_id);
    const employees = await prisma.tenant_users.findMany({
      where: {
        id: { in: employeeIds },
        tenant_id: tenantId
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true
      }
    });

    // Merge employee data with assignments
    const enrichedAssignments = assignments.map(assignment => {
      const employee = employees.find(e => e.id === assignment.employee_id);
      return {
        ...assignment,
        employee: employee || { id: assignment.employee_id, email: 'Unknown' }
      };
    });

    res.json({
      success: true,
      data: enrichedAssignments
    });
  } catch (error) {
    logger.error('Error fetching campaign assignments', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignments'
    });
  }
};

/**
 * Get employee's active assignments
 * @route GET /api/engagement/employees/:employeeId/assignments
 */
const getEmployeeAssignments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const { status } = req.query;

    const where = {
      employee_id: employeeId,
      campaign: {
        tenant_id: tenantId
      }
    };

    if (status) {
      where.status = status;
    }

    const assignments = await prisma.engagement_campaign_assignments.findMany({
      where,
      include: {
        campaign: {
          include: {
            template: {
              select: {
                title: true,
                type: true,
                description: true
              }
            }
          }
        }
      },
      orderBy: {
        assigned_at: 'desc'
      }
    });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    logger.error('Error fetching employee assignments', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignments'
    });
  }
};

/**
 * Add employees to existing campaign
 * @route POST /api/engagement/campaigns/:campaignId/assignments
 */
const addAssignments = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { employeeIds } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Employee IDs are required'
      });
    }

    // Get campaign
    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id: campaignId,
        tenant_id: tenantId
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Check campaign status
    if (campaign.status === 'COMPLETED' || campaign.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot add assignments to completed or archived campaign'
      });
    }

    // Check for conflicts
    const conflictCheck = await checkConflictsForEmployees(
      employeeIds,
      campaign.start_date,
      campaign.end_date,
      tenantId,
      campaignId
    );

    if (conflictCheck.hasConflicts) {
      return res.status(400).json({
        success: false,
        error: 'Some employees have conflicting assignments',
        conflicts: conflictCheck.conflicts
      });
    }

    // Get existing assignments
    const existingAssignments = await prisma.engagement_campaign_assignments.findMany({
      where: {
        campaign_id: campaignId,
        employee_id: { in: employeeIds }
      }
    });

    const existingEmployeeIds = existingAssignments.map(a => a.employee_id);
    const newEmployeeIds = employeeIds.filter(id => !existingEmployeeIds.includes(id));

    if (newEmployeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All employees are already assigned to this campaign'
      });
    }

    // Create new assignments
    const result = await prisma.engagement_campaign_assignments.createMany({
      data: newEmployeeIds.map(employeeId => ({
        campaign_id: campaignId,
        employee_id: employeeId,
        assigned_by: String(userId),
        status: 'ASSIGNED'
      }))
    });

    // Update campaign target audience
    const updatedTargetAudience = campaign.target_audience || {};
    updatedTargetAudience.employeeIds = [
      ...(updatedTargetAudience.employeeIds || []),
      ...newEmployeeIds
    ];
    updatedTargetAudience.totalCount = updatedTargetAudience.employeeIds.length;

    await prisma.engagement_campaigns.update({
      where: { id: campaignId },
      data: {
        target_audience: updatedTargetAudience
      }
    });

    logger.info('Added assignments to campaign', {
      campaignId,
      newAssignments: result.count,
      totalAssignments: updatedTargetAudience.totalCount
    });

    res.json({
      success: true,
      message: `Successfully added ${result.count} new assignments`,
      data: {
        newAssignments: result.count,
        totalAssignments: updatedTargetAudience.totalCount
      }
    });
  } catch (error) {
    logger.error('Error adding assignments', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add assignments'
    });
  }
};

/**
 * Remove assignment (only if not started)
 * @route DELETE /api/engagement/campaigns/:campaignId/assignments/:assignmentId
 */
const removeAssignment = async (req, res) => {
  try {
    const { campaignId, assignmentId } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Verify campaign belongs to tenant
    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id: campaignId,
        tenant_id: tenantId
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get assignment
    const assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        id: assignmentId,
        campaign_id: campaignId
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check if assignment can be removed
    if (assignment.status === 'IN_PROGRESS' || assignment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove assignment that is in progress or completed'
      });
    }

    // Check for responses
    const responses = await prisma.engagement_responses.findFirst({
      where: {
        campaign_id: campaignId,
        user_id: assignment.employee_id
      }
    });

    if (responses) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove assignment with existing responses'
      });
    }

    // Delete assignment
    await prisma.engagement_campaign_assignments.delete({
      where: { id: assignmentId }
    });

    // Update campaign target audience
    const updatedTargetAudience = campaign.target_audience || {};
    updatedTargetAudience.employeeIds = (updatedTargetAudience.employeeIds || [])
      .filter(id => id !== assignment.employee_id);
    updatedTargetAudience.totalCount = updatedTargetAudience.employeeIds.length;

    await prisma.engagement_campaigns.update({
      where: { id: campaignId },
      data: {
        target_audience: updatedTargetAudience
      }
    });

    logger.info('Removed assignment', {
      campaignId,
      assignmentId,
      employeeId: assignment.employee_id
    });

    res.json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    logger.error('Error removing assignment', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove assignment'
    });
  }
};

/**
 * Update assignment status
 * @route PATCH /api/engagement/assignments/:assignmentId/status
 */
const updateAssignmentStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const validStatuses = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Get assignment with campaign
    const assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        id: assignmentId,
        campaign: {
          tenant_id: tenantId
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    const updateData = { status };

    // Set timestamps based on status
    if (status === 'IN_PROGRESS' && !assignment.started_at) {
      updateData.started_at = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completed_at = new Date();

      // Calculate completion rate
      const responses = await prisma.engagement_responses.count({
        where: {
          campaign_id: assignment.campaign_id,
          user_id: assignment.employee_id
        }
      });

      const questions = await prisma.engagement_questions.count({
        where: {
          template: {
            campaigns: {
              some: {
                id: assignment.campaign_id
              }
            }
          }
        }
      });

      updateData.completion_rate = questions > 0 ? (responses / questions) * 100 : 0;
    }

    // Update assignment
    const updated = await prisma.engagement_campaign_assignments.update({
      where: { id: assignmentId },
      data: updateData
    });

    // Update campaign status if needed
    if (status === 'IN_PROGRESS') {
      await prisma.engagement_campaigns.update({
        where: {
          id: assignment.campaign_id,
          status: 'ACTIVE'
        },
        data: {
          status: 'IN_PROGRESS',
          has_responses: true
        }
      });
    }

    logger.info('Updated assignment status', {
      assignmentId,
      status,
      campaignId: assignment.campaign_id
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Error updating assignment status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status'
    });
  }
};

/**
 * Helper function to check conflicts for employees
 */
async function checkConflictsForEmployees(employeeIds, startDate, endDate, tenantId, excludeCampaignId = null) {
  const conflicts = [];
  let hasConflicts = false;

  for (const employeeId of employeeIds) {
    const where = {
      employee_id: employeeId,
      status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
      campaign: {
        tenant_id: tenantId,
        OR: [
          {
            start_date: { lte: endDate },
            end_date: { gte: startDate }
          }
        ]
      }
    };

    if (excludeCampaignId) {
      where.campaign_id = { not: excludeCampaignId };
    }

    const existingAssignments = await prisma.engagement_campaign_assignments.findMany({
      where,
      include: {
        campaign: {
          select: {
            name: true,
            start_date: true,
            end_date: true
          }
        }
      }
    });

    if (existingAssignments.length > 0) {
      hasConflicts = true;
      conflicts.push({
        employeeId,
        conflictingCampaigns: existingAssignments.map(a => ({
          campaignName: a.campaign.name,
          startDate: a.campaign.start_date,
          endDate: a.campaign.end_date,
          status: a.status
        }))
      });
    }
  }

  return { hasConflicts, conflicts };
}

module.exports = {
  getCampaignAssignments,
  getEmployeeAssignments,
  addAssignments,
  removeAssignment,
  updateAssignmentStatus
};