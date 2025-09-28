/**
 * Assessment Campaign Controller
 * Created: September 25, 2025
 *
 * Handles all operations for assessment campaign management
 * including creation, assignment, tracking, and reporting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');
const { checkAssessmentConflicts, validateAssessmentDates } = require('../../services/assessmentConflictService');

/**
 * Create a new assessment campaign
 * @route POST /api/assessment/campaigns
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
      deadline,
      frequency,
      mandatory,
      allowRetakes,
      maxAttempts,
      notificationSettings
    } = req.body;

    // Validation
    if (!templateId || !employeeIds || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and employee IDs are required'
      });
    }

    if (!startDate || !deadline) {
      return res.status(400).json({
        success: false,
        error: 'Start date and deadline are required'
      });
    }

    // Parse and validate dates
    const start = new Date(startDate);
    const end = new Date(deadline);

    const dateValidation = validateAssessmentDates(start, end);
    if (!dateValidation.isValid) {
      return res.status(400).json({
        success: false,
        errors: dateValidation.errors
      });
    }

    // Check if template exists and is accessible
    const template = await prisma.assessment_templates.findFirst({
      where: {
        id: parseInt(templateId),
        isActive: true
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Assessment template not found or not active'
      });
    }

    // Check for conflicts
    const conflictCheck = await checkAssessmentConflicts(
      employeeIds,
      start,
      end,
      tenantId,
      template.type
    );

    if (conflictCheck.hasConflicts) {
      return res.status(400).json({
        success: false,
        error: 'Some employees have conflicting assessments',
        conflicts: conflictCheck.conflicts,
        suggestions: conflictCheck.suggestions
      });
    }

    // Create target audience JSON
    const targetAudience = {
      employeeIds: employeeIds,
      totalCount: employeeIds.length,
      selectedAt: new Date()
    };

    // Create notification settings JSON
    const notifications = notificationSettings || {
      sendOnAssignment: true,
      sendReminders: true,
      reminderFrequency: 7,
      channels: ['email', 'in_app']
    };

    // Use transaction to create campaign and assignments
    const result = await prisma.$transaction(async (tx) => {
      // Create campaign
      const campaign = await tx.assessment_campaigns.create({
        data: {
          tenant_id: tenantId,
          template_id: parseInt(templateId),
          name: name || `${template.name} - ${new Date().toLocaleDateString()}`,
          description,
          start_date: start,
          deadline: end,
          status: 'PLANNED',
          frequency: frequency || 'once',
          mandatory: mandatory || false,
          allow_retakes: allowRetakes || false,
          max_attempts: maxAttempts || 1,
          target_audience: targetAudience,
          notification_settings: notifications,
          created_by: String(userId)
        }
      });

      // Create assignments for each employee (now using Integer employee IDs)
      const assignments = await tx.assessment_campaign_assignments.createMany({
        data: employeeIds.map(employeeId => ({
          campaign_id: campaign.id,
          employee_id: parseInt(employeeId), // Ensure it's an integer
          assigned_by: String(userId),
          status: 'ASSIGNED'
        }))
      });

      return { campaign, assignmentCount: assignments.count };
    });

    logger.info('Created assessment campaign with assignments', {
      campaignId: result.campaign.id,
      templateId,
      employeeCount: employeeIds.length,
      tenantId
    });

    // Return warnings if any
    const response = {
      success: true,
      data: result.campaign,
      message: `Campaign created and assigned to ${result.assignmentCount} employees`
    };

    if (conflictCheck.hasWarnings) {
      response.warnings = conflictCheck.warnings;
    }

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating assessment campaign', error);
    console.error('Campaign creation error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create assessment campaign',
      details: error.message
    });
  }
};

/**
 * Get all assessment campaigns
 * @route GET /api/assessment/campaigns
 */
const getCampaigns = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const { status, page = 1, limit = 10 } = req.query;

    const where = {
      tenant_id: tenantId
    };

    if (status) {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.assessment_campaigns.findMany({
        where,
        include: {
          template: {
            select: {
              name: true,
              type: true,
              assessment_questions: {
                select: { id: true }
              }
            }
          },
          assignments: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip: (page - 1) * limit,
        take: parseInt(limit)
      }),
      prisma.assessment_campaigns.count({ where })
    ]);

    // Add statistics to each campaign
    const campaignsWithStats = campaigns.map(campaign => ({
      ...campaign,
      stats: {
        totalAssigned: campaign.assignments.length,
        notStarted: campaign.assignments.filter(a => a.status === 'ASSIGNED').length,
        inProgress: campaign.assignments.filter(a => a.status === 'IN_PROGRESS').length,
        completed: campaign.assignments.filter(a => a.status === 'COMPLETED').length,
        questionCount: campaign.template?.assessment_questions?.length || 0
      }
    }));

    res.json({
      success: true,
      data: campaignsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching assessment campaigns', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
};

/**
 * Get single campaign by ID
 * @route GET /api/assessment/campaigns/:id
 */
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const campaign = await prisma.assessment_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        template: {
          include: {
            assessment_questions: {
              include: {
                assessment_options: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        },
        assignments: {
          include: {
            // We'll need to join with tenant_users to get employee details
            // This would be done in a separate query for now
          }
        },
        results: {
          select: {
            employee_id: true,
            completed_at: true,
            overall_score: true
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

    // Calculate completion rate
    const totalAssignments = campaign.assignments.length;
    const completedAssignments = campaign.assignments.filter(a => a.status === 'COMPLETED').length;
    const completionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

    res.json({
      success: true,
      data: {
        ...campaign,
        stats: {
          totalAssigned: totalAssignments,
          completed: completedAssignments,
          completionRate: completionRate.toFixed(1)
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
 * Update campaign status
 * @route PATCH /api/assessment/campaigns/:id/status
 */
const updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const validStatuses = ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if campaign exists
    const campaign = await prisma.assessment_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        results: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Validate status transition
    if (status === 'ARCHIVED' && campaign.results.length > 0) {
      // Can archive if has results
    } else if (status === 'COMPLETED' && campaign.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Can only complete active campaigns'
      });
    }

    // Update status
    const updated = await prisma.assessment_campaigns.update({
      where: { id },
      data: {
        status,
        archived_at: status === 'ARCHIVED' ? new Date() : null
      }
    });

    logger.info('Updated assessment campaign status', {
      campaignId: id,
      oldStatus: campaign.status,
      newStatus: status
    });

    res.json({
      success: true,
      data: updated,
      message: `Campaign status updated to ${status}`
    });
  } catch (error) {
    logger.error('Error updating campaign status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign status'
    });
  }
};

/**
 * Delete campaign (only if no assignments started)
 * @route DELETE /api/assessment/campaigns/:id
 */
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Check if campaign exists and has no started assignments
    const campaign = await prisma.assessment_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        assignments: {
          where: {
            status: {
              notIn: ['ASSIGNED']
            }
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

    if (campaign.assignments.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete campaign with started assignments'
      });
    }

    // Delete campaign (assignments will cascade delete)
    await prisma.assessment_campaigns.delete({
      where: { id }
    });

    logger.info('Deleted assessment campaign', { campaignId: id });

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
 * Check conflicts before creating campaign
 * @route POST /api/assessment/campaigns/check-conflicts
 */
const checkConflicts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const {
      employeeIds,
      startDate,
      deadline,
      assessmentType,
      excludeCampaignId
    } = req.body;

    if (!employeeIds || !startDate || !deadline) {
      return res.status(400).json({
        success: false,
        error: 'Employee IDs, start date, and deadline are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(deadline);

    const conflictCheck = await checkAssessmentConflicts(
      employeeIds,
      start,
      end,
      tenantId,
      assessmentType,
      excludeCampaignId
    );

    res.json({
      success: true,
      ...conflictCheck
    });
  } catch (error) {
    logger.error('Error checking conflicts', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check conflicts'
    });
  }
};

/**
 * Get campaign statistics
 * @route GET /api/assessment/campaigns/:id/stats
 */
const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const campaign = await prisma.assessment_campaigns.findFirst({
      where: {
        id,
        tenant_id: tenantId
      },
      include: {
        assignments: true,
        results: {
          select: {
            overall_score: true,
            percentile: true,
            completed_at: true,
            time_taken: true
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
    const stats = {
      totalAssigned: campaign.assignments.length,
      notStarted: campaign.assignments.filter(a => a.status === 'ASSIGNED').length,
      inProgress: campaign.assignments.filter(a => a.status === 'IN_PROGRESS').length,
      completed: campaign.assignments.filter(a => a.status === 'COMPLETED').length,
      expired: campaign.assignments.filter(a => a.status === 'EXPIRED').length,

      // Performance metrics
      averageScore: campaign.results.length > 0
        ? campaign.results.reduce((sum, r) => sum + (r.overall_score || 0), 0) / campaign.results.length
        : null,
      averageTimeMinutes: campaign.results.length > 0
        ? campaign.results.reduce((sum, r) => sum + (r.time_taken || 0), 0) / campaign.results.length
        : null,

      // Progress
      completionRate: campaign.assignments.length > 0
        ? (campaign.assignments.filter(a => a.status === 'COMPLETED').length / campaign.assignments.length) * 100
        : 0,

      // Time analysis
      daysRemaining: Math.max(0, Math.ceil((new Date(campaign.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching campaign stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign statistics'
    });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaignStatus,
  deleteCampaign,
  checkConflicts,
  getCampaignStats
};