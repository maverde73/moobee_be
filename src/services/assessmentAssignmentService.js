/**
 * Assessment Assignment Service
 * Business logic for assessment campaign assignments
 */

const prisma = require('../config/database');

// Add assignments to campaign
const addAssignments = async (campaignId, tenantId, assignments) => {
  try {
    // Verify campaign exists and belongs to tenant
    const campaign = await prisma.assessmentCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      }
    });

    if (!campaign) {
      return {
        error: 'Campaign not found',
        status: 404
      };
    }

    // Check for existing assignments
    const existingAssignments = await prisma.assessmentCampaignAssignment.findMany({
      where: {
        assessmentCampaignId: campaignId,
        tenantUserId: {
          in: assignments.map(a => a.tenantUserId)
        }
      }
    });

    // Filter out already assigned users
    const newAssignments = assignments.filter(
      a => !existingAssignments.some(e => e.tenantUserId === a.tenantUserId)
    );

    if (newAssignments.length === 0) {
      return {
        error: 'All users are already assigned to this campaign',
        status: 409
      };
    }

    // Create new assignments
    const created = await prisma.assessmentCampaignAssignment.createMany({
      data: newAssignments.map(assignment => ({
        assessmentCampaignId: campaignId,
        tenantUserId: assignment.tenantUserId,
        assignedAt: new Date(),
        status: 'assigned'
      }))
    });

    // Fetch created assignments with user details
    const createdAssignments = await prisma.assessmentCampaignAssignment.findMany({
      where: {
        assessmentCampaignId: campaignId,
        tenantUserId: {
          in: newAssignments.map(a => a.tenantUserId)
        }
      },
      include: {
        tenantUser: true
      }
    });

    return {
      data: createdAssignments
    };
  } catch (error) {
    console.error('Error adding assignments:', error);
    throw error;
  }
};

// Remove assignment
const removeAssignment = async (campaignId, assignmentId, tenantId) => {
  try {
    // Verify assignment exists and belongs to tenant's campaign
    const assignment = await prisma.assessmentCampaignAssignment.findFirst({
      where: {
        id: assignmentId,
        assessmentCampaign: {
          id: campaignId,
          tenantId
        }
      }
    });

    if (!assignment) {
      return {
        error: 'Assignment not found',
        status: 404
      };
    }

    // Check if assignment can be deleted (not completed)
    if (assignment.status === 'completed') {
      return {
        error: 'Cannot remove completed assignment',
        status: 400
      };
    }

    await prisma.assessmentCampaignAssignment.delete({
      where: { id: assignmentId }
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing assignment:', error);
    throw error;
  }
};

// Update assignment status
const updateAssignmentStatus = async (campaignId, assignmentId, tenantId, status) => {
  try {
    const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return {
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        status: 400
      };
    }

    // Verify assignment exists
    const assignment = await prisma.assessmentCampaignAssignment.findFirst({
      where: {
        id: assignmentId,
        assessmentCampaign: {
          id: campaignId,
          tenantId
        }
      }
    });

    if (!assignment) {
      return {
        error: 'Assignment not found',
        status: 404
      };
    }

    // Update status
    const updated = await prisma.assessmentCampaignAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        ...(status === 'in_progress' && { startedAt: new Date() }),
        ...(status === 'completed' && { completedAt: new Date() })
      },
      include: {
        tenantUser: true
      }
    });

    return { data: updated };
  } catch (error) {
    console.error('Error updating assignment status:', error);
    throw error;
  }
};

// Get campaign assignments
const getCampaignAssignments = async (campaignId, tenantId, options) => {
  const { status, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  try {
    // Verify campaign exists
    const campaign = await prisma.assessmentCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      }
    });

    if (!campaign) {
      return {
        error: 'Campaign not found',
        status: 404
      };
    }

    const where = {
      assessmentCampaignId: campaignId,
      ...(status && { status })
    };

    const [assignments, total] = await Promise.all([
      prisma.assessmentCampaignAssignment.findMany({
        where,
        skip,
        take: limit,
        include: {
          tenantUser: true
        },
        orderBy: { assignedAt: 'desc' }
      }),
      prisma.assessmentCampaignAssignment.count({ where })
    ]);

    return {
      assignments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching assignments:', error);
    throw error;
  }
};

// Bulk update assignments
const bulkUpdateAssignments = async (campaignId, tenantId, assignmentIds, action, data) => {
  try {
    // Verify campaign
    const campaign = await prisma.assessmentCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      }
    });

    if (!campaign) {
      return {
        error: 'Campaign not found',
        status: 404
      };
    }

    let updateData = {};

    switch (action) {
      case 'status':
        updateData.status = data.status;
        if (data.status === 'in_progress') {
          updateData.startedAt = new Date();
        } else if (data.status === 'completed') {
          updateData.completedAt = new Date();
        }
        break;

      case 'reassign':
        updateData.tenantUserId = data.tenantUserId;
        updateData.assignedAt = new Date();
        break;

      case 'extend':
        // Extend deadline logic here
        break;

      default:
        return {
          error: 'Invalid bulk action',
          status: 400
        };
    }

    const result = await prisma.assessmentCampaignAssignment.updateMany({
      where: {
        id: { in: assignmentIds },
        assessmentCampaignId: campaignId
      },
      data: updateData
    });

    return {
      data: result,
      count: result.count
    };
  } catch (error) {
    console.error('Error bulk updating assignments:', error);
    throw error;
  }
};

// Get user's assignments
const getUserAssignments = async (userId, tenantId, options) => {
  const { status, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  try {
    const where = {
      tenantUserId: userId,
      assessmentCampaign: {
        tenantId
      },
      ...(status && { status })
    };

    const [assignments, total] = await Promise.all([
      prisma.assessmentCampaignAssignment.findMany({
        where,
        skip,
        take: limit,
        include: {
          assessmentCampaign: {
            include: {
              assessmentTemplate: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' }
      }),
      prisma.assessmentCampaignAssignment.count({ where })
    ]);

    return {
      assignments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching user assignments:', error);
    throw error;
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