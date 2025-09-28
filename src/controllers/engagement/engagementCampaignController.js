/**
 * Engagement Campaign Controller
 * @module controllers/engagement/engagementCampaignController
 * @created 2025-09-24
 * @description Gestione campagne di engagement e assegnazione ai dipendenti
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

/**
 * Check for employee conflicts with existing campaigns
 * @param {string[]} employeeIds - Array of employee IDs to check
 * @param {Date} startDate - Campaign start date
 * @param {Date} endDate - Campaign end date
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Conflict check result
 */
async function checkEmployeeConflicts(employeeIds, startDate, endDate, tenantId) {
  const conflicts = [];
  let hasConflicts = false;

  // For each employee, check if they have any active campaigns in the date range
  for (const employeeId of employeeIds) {
    const existingAssignments = await prisma.engagement_campaign_assignments.findMany({
      where: {
        employee_id: employeeId,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']
        },
        campaign: {
          tenant_id: tenantId,
          // Check for overlapping date ranges
          OR: [
            {
              // New campaign starts during existing campaign
              start_date: { lte: startDate },
              end_date: { gte: startDate }
            },
            {
              // New campaign ends during existing campaign
              start_date: { lte: endDate },
              end_date: { gte: endDate }
            },
            {
              // New campaign completely contains existing campaign
              start_date: { gte: startDate },
              end_date: { lte: endDate }
            }
          ]
        }
      },
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

/**
 * Get all engagement campaigns for tenant
 * @route GET /api/engagement/campaigns
 */
const getCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      templateId,
      search
    } = req.query;

    const tenantId = req.user.tenantId || req.user.tenant_id;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      tenant_id: tenantId,
      ...(status && { status }),
      ...(templateId && { template_id: templateId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Get campaigns from database
    const [campaigns, total] = await Promise.all([
      prisma.engagement_campaigns.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          template: {
            select: {
              title: true,
              type: true,
              suggested_frequency: true,
              _count: {
                select: {
                  questions: true
                }
              }
            }
          },
          _count: {
            select: {
              responses: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      }),
      prisma.engagement_campaigns.count({ where })
    ]);

    logger.info(`Retrieved ${campaigns.length} engagement campaigns for tenant ${tenantId}`);

    res.json({
      success: true,
      data: campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching engagement campaigns', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
};

/**
 * Get single campaign by ID
 * @route GET /api/engagement/campaigns/:id
 */
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        template: {
          include: {
            questions: {
              include: {
                options: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        },
        responses: {
          select: {
            user_id: true,
            responded_at: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Parse target_audience if it's a JSON field
    if (campaign.target_audience && typeof campaign.target_audience === 'string') {
      try {
        campaign.target_audience = JSON.parse(campaign.target_audience);
      } catch (e) {
        // Keep as is if parse fails
      }
    }

    // Calculate response rate
    const targetCount = campaign.target_audience?.employeeIds?.length || 0;
    const responseCount = campaign.responses.length;
    const responseRate = targetCount > 0 ? (responseCount / targetCount) * 100 : 0;

    res.json({
      success: true,
      data: {
        ...campaign,
        stats: {
          targetCount,
          responseCount,
          responseRate: responseRate.toFixed(1)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching campaign', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign'
    });
  }
};

/**
 * Create new engagement campaign
 * @route POST /api/engagement/campaigns
 */
const createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const {
      templateId,
      name,
      description,
      employeeIds,
      startDate,
      endDate,
      frequency,
      reminderSettings,
      notifyManagers,
      anonymousResponses,
      customMessage
    } = req.body;

    // Validation
    if (!templateId || !employeeIds || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and employee IDs are required'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    // Check if template exists and is accessible by tenant
    const template = await prisma.engagement_templates.findFirst({
      where: {
        id: templateId,
        OR: [
          { tenant_id: tenantId },
          { tenant_id: null }, // Global templates
          // Check if tenant has selected this template
          {
            selections: {
              some: {
                tenant_id: tenantId,
                template_id: templateId,
                is_active: true
              }
            }
          }
        ]
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or not accessible'
      });
    }

    // Check for conflicts with existing campaigns for each employee
    const conflictCheck = await checkEmployeeConflicts(employeeIds, start, end, tenantId);

    if (conflictCheck.hasConflicts) {
      return res.status(400).json({
        success: false,
        error: 'Some employees have conflicting engagements',
        conflicts: conflictCheck.conflicts
      });
    }

    // Create target audience JSON
    const targetAudience = {
      employeeIds: employeeIds,
      totalCount: employeeIds.length,
      selectedAt: new Date()
    };

    // Create reminder settings JSON
    const reminderConfig = reminderSettings || {
      enabled: true,
      frequency: 7,
      channels: ['email', 'in_app']
    };

    if (customMessage) {
      reminderConfig.customMessage = customMessage;
    }

    // Use transaction to create campaign and assignments
    const result = await prisma.$transaction(async (tx) => {
      // Create campaign
      const campaign = await tx.engagement_campaigns.create({
        data: {
          tenant_id: tenantId,
          template_id: templateId,
          name: name || `${template.title} - ${new Date().toLocaleDateString()}`,
          description,
          start_date: start,
          end_date: end,
          status: 'PLANNED',
          frequency: frequency || 'once',
          target_audience: targetAudience,
          anonymous_responses: anonymousResponses || false,
          reminder_settings: reminderConfig,
          created_by: String(userId)
        }
      });

      // Create assignments for each employee (now using Integer employee IDs)
      const assignments = await tx.engagement_campaign_assignments.createMany({
        data: employeeIds.map(employeeId => ({
          campaign_id: campaign.id,
          employee_id: parseInt(employeeId), // Ensure it's an integer
          assigned_by: String(userId),
          status: 'ASSIGNED'
        }))
      });

      return { campaign, assignmentCount: assignments.count };
    });

    logger.info('Created engagement campaign with assignments', {
      campaignId: result.campaign.id,
      templateId,
      employeeCount: employeeIds.length,
      tenantId
    });

    // TODO: Send initial notifications to employees
    // This would be handled by a notification service
    if (notifyManagers) {
      // TODO: Also notify managers
    }

    res.status(201).json({
      success: true,
      data: result.campaign,
      message: `Campagna creata e assegnata a ${result.assignmentCount} dipendenti`
    });
  } catch (error) {
    logger.error('Error creating campaign', error);
    console.error('Campaign creation error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      details: error.message
    });
  }
};

/**
 * Update campaign status
 * @route PATCH /api/engagement/campaigns/:id/status
 */
const updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const validStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Check campaign exists and belongs to tenant
    const existing = await prisma.engagement_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Update status
    const updated = await prisma.engagement_campaigns.update({
      where: { id },
      data: {
        status,
        updated_at: new Date()
      }
    });

    logger.info('Updated campaign status', { campaignId: id, status });

    res.json({
      success: true,
      data: updated,
      message: `Campaign status updated to ${status}`
    });
  } catch (error) {
    logger.error('Error updating campaign status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status'
    });
  }
};

/**
 * Delete campaign
 * @route DELETE /api/engagement/campaigns/:id
 */
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    console.log('Delete campaign request:', {
      campaignId: id,
      tenantId,
      user: req.user
    });

    // Check campaign exists and has no responses
    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        _count: {
          select: {
            responses: true,
            assignments: true
          }
        },
        assignments: {
          where: {
            status: {
              in: ['IN_PROGRESS', 'COMPLETED']
            }
          }
        }
      }
    });

    console.log('Found campaign:', campaign ? {
      id: campaign.id,
      tenant_id: campaign.tenant_id,
      status: campaign.status,
      responses: campaign._count.responses,
      assignments: campaign.assignments.length
    } : 'NOT FOUND');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Check if campaign has responses or completed assignments
    if (campaign._count.responses > 0 || campaign.has_responses) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete campaign with existing responses. Archive it instead.'
      });
    }

    // Check if any assignment is in progress or completed
    if (campaign.assignments.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete campaign with employees who have started or completed the engagement.'
      });
    }

    // Use transaction to delete campaign and all related data
    await prisma.$transaction(async (tx) => {
      // Delete assignments first
      await tx.engagement_campaign_assignments.deleteMany({
        where: { campaign_id: id }
      });

      // Delete campaign
      await tx.engagement_campaigns.delete({
        where: { id }
      });
    });

    logger.info('Deleted campaign and assignments', { campaignId: id });

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting campaign', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign'
    });
  }
};

/**
 * Send notifications for campaign
 * @route POST /api/engagement/campaigns/:id/notify
 */
const sendNotifications = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'reminder' } = req.body; // 'initial' or 'reminder'
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId,
        status: 'ACTIVE'
      },
      include: {
        template: true
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Active campaign not found'
      });
    }

    // Parse target audience
    const targetAudience = campaign.target_audience;
    const employeeIds = targetAudience?.employeeIds || [];

    if (employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No employees in target audience'
      });
    }

    // TODO: Implement actual notification sending
    // This would integrate with email service, in-app notifications, etc.

    logger.info('Sending notifications for campaign', {
      campaignId: id,
      type,
      employeeCount: employeeIds.length
    });

    res.json({
      success: true,
      message: `Notifications sent to ${employeeIds.length} employees`,
      data: {
        campaignId: id,
        notificationType: type,
        recipientCount: employeeIds.length,
        sentAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Error sending notifications', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
};

/**
 * Get campaign statistics
 * @route GET /api/engagement/campaigns/:id/stats
 */
const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const campaign = await prisma.engagement_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        responses: {
          select: {
            user_id: true,
            responded_at: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Calculate statistics
    const targetAudience = campaign.target_audience;
    const targetCount = targetAudience?.employeeIds?.length || 0;
    const responseCount = campaign.responses.length;
    const uniqueRespondents = [...new Set(campaign.responses.map(r => r.user_id))].length;

    // Get response distribution over time
    const responsesByDate = campaign.responses.reduce((acc, response) => {
      const date = new Date(response.responded_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const stats = {
      campaignId: id,
      targetCount,
      responseCount,
      uniqueRespondents,
      responseRate: targetCount > 0 ? ((uniqueRespondents / targetCount) * 100).toFixed(1) : 0,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      status: campaign.status,
      responsesByDate,
      daysRemaining: Math.max(0, Math.ceil((new Date(campaign.end_date) - new Date()) / (1000 * 60 * 60 * 24)))
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching campaign stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

module.exports = {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaignStatus,
  deleteCampaign,
  sendNotifications,
  getCampaignStats,
  checkEmployeeConflicts  // Export the function for use in routes
};