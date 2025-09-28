/**
 * Assessment Campaign Service
 * Business logic for assessment campaign operations
 */

const prisma = require('../config/database');

// Check if tenant has access to assessment template
const checkTemplateAccess = async (tenantId, assessmentTemplateId) => {
  try {
    const templateAccess = await prisma.tenantAssessmentSelection.findUnique({
      where: {
        tenantId_assessmentTemplateId: {
          tenantId,
          assessmentTemplateId
        }
      },
      include: {
        assessmentTemplate: true
      }
    });

    return templateAccess;
  } catch (error) {
    console.error('Error checking template access:', error);
    throw error;
  }
};

// Create a new assessment campaign
const createCampaign = async (data) => {
  const {
    name,
    tenantId,
    assessmentTemplateId,
    startDate,
    endDate,
    frequency,
    assignments
  } = data;

  try {
    const campaign = await prisma.assessmentCampaign.create({
      data: {
        name,
        tenantId,
        assessmentTemplateId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        frequency: frequency || 'once',
        status: 'draft',
        assessmentCampaignAssignments: {
          create: assignments.map(assignment => ({
            tenantUserId: assignment.tenantUserId,
            assignedAt: new Date(),
            status: 'assigned'
          }))
        }
      },
      include: {
        assessmentTemplate: true,
        assessmentCampaignAssignments: {
          include: {
            tenantUser: true
          }
        }
      }
    });

    return campaign;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
};

// Get campaign by ID
const getCampaignById = async (campaignId, tenantId) => {
  try {
    const campaign = await prisma.assessmentCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      },
      include: {
        assessmentTemplate: true,
        assessmentCampaignAssignments: {
          include: {
            tenantUser: true
          }
        }
      }
    });

    return campaign;
  } catch (error) {
    console.error('Error fetching campaign:', error);
    throw error;
  }
};

// List campaigns with pagination
const listCampaigns = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    search
  } = options;

  const skip = (page - 1) * limit;

  try {
    const where = {
      tenantId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { assessmentTemplate: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    const [campaigns, total] = await Promise.all([
      prisma.assessmentCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assessmentTemplate: true,
          assessmentCampaignAssignments: {
            include: {
              tenantUser: true
            }
          }
        }
      }),
      prisma.assessmentCampaign.count({ where })
    ]);

    return {
      campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error listing campaigns:', error);
    throw error;
  }
};

// Update campaign
const updateCampaign = async (campaignId, tenantId, data) => {
  try {
    const campaign = await prisma.assessmentCampaign.update({
      where: {
        id: campaignId,
        tenantId
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.frequency && { frequency: data.frequency }),
        ...(data.status && { status: data.status })
      },
      include: {
        assessmentTemplate: true,
        assessmentCampaignAssignments: {
          include: {
            tenantUser: true
          }
        }
      }
    });

    return campaign;
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
};

// Delete campaign
const deleteCampaign = async (campaignId, tenantId) => {
  try {
    // First delete all assignments
    await prisma.assessmentCampaignAssignment.deleteMany({
      where: {
        assessmentCampaign: {
          id: campaignId,
          tenantId
        }
      }
    });

    // Then delete the campaign
    const campaign = await prisma.assessmentCampaign.delete({
      where: {
        id: campaignId,
        tenantId
      }
    });

    return campaign;
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
};

// Update campaign status
const updateCampaignStatus = async (campaignId, tenantId, status) => {
  try {
    const campaign = await prisma.assessmentCampaign.update({
      where: {
        id: campaignId,
        tenantId
      },
      data: { status },
      include: {
        assessmentTemplate: true,
        assessmentCampaignAssignments: true
      }
    });

    return campaign;
  } catch (error) {
    console.error('Error updating campaign status:', error);
    throw error;
  }
};

// Get campaign statistics
const getCampaignStats = async (campaignId, tenantId) => {
  try {
    const campaign = await prisma.assessmentCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      },
      include: {
        assessmentCampaignAssignments: true
      }
    });

    if (!campaign) return null;

    const stats = {
      totalAssignments: campaign.assessmentCampaignAssignments.length,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      notStarted: 0
    };

    campaign.assessmentCampaignAssignments.forEach(assignment => {
      switch (assignment.status) {
        case 'assigned':
          stats.assigned++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
        default:
          stats.notStarted++;
      }
    });

    stats.completionRate = stats.totalAssignments > 0
      ? (stats.completed / stats.totalAssignments * 100).toFixed(1)
      : 0;

    return stats;
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    throw error;
  }
};

module.exports = {
  checkTemplateAccess,
  createCampaign,
  getCampaignById,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  getCampaignStats
};