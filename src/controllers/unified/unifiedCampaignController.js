/**
 * Unified Campaign Controller
 * @module controllers/unified/unifiedCampaignController
 * @created 2025-09-25
 * @description Manages unified calendar view for both engagement and assessment campaigns
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

/**
 * Get unified calendar data for both engagement and assessment campaigns
 * @route GET /api/unified/calendar
 */
const getUnifiedCalendar = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      view = 'month', // month, week, list
      includeCompleted = false,
      employeeId,
      page = 1,
      limit = 50
    } = req.query;

    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Build date filters
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Build status filter
    const statusFilter = includeCompleted === 'true'
      ? {}
      : { notIn: ['COMPLETED', 'ARCHIVED'] };

    // Fetch engagement campaigns
    const engagementWhere = {
      tenant_id: tenantId,
      status: statusFilter,
      ...(startDate || endDate ? {
        OR: [
          { start_date: dateFilter },
          { end_date: dateFilter }
        ]
      } : {})
    };

    // Fetch assessment campaigns
    const assessmentWhere = {
      tenant_id: tenantId,
      status: statusFilter,
      ...(startDate || endDate ? {
        OR: [
          { start_date: dateFilter },
          { deadline: dateFilter }
        ]
      } : {})
    };

    // Add employee filter if specified
    if (employeeId) {
      engagementWhere.assignments = {
        some: { employee_id: employeeId }
      };
      assessmentWhere.assignments = {
        some: { employee_id: employeeId }
      };
    }

    // Parallel fetch both campaign types
    const [engagementCampaigns, assessmentCampaigns] = await Promise.all([
      prisma.engagement_campaigns.findMany({
        where: engagementWhere,
        include: {
          template: {
            select: {
              title: true,
              type: true,
              category: true
            }
          },
          assignments: {
            select: {
              id: true,
              employee_id: true,
              status: true
            }
          },
          _count: {
            select: {
              assignments: true,
              responses: true
            }
          }
        },
        orderBy: { start_date: 'asc' }
      }),
      prisma.assessment_campaigns.findMany({
        where: assessmentWhere,
        include: {
          template: {
            select: {
              name: true,
              type: true,
              description: true
            }
          },
          assignments: {
            select: {
              id: true,
              employee_id: true,
              status: true
            }
          },
          _count: {
            select: {
              assignments: true
            }
          }
        },
        orderBy: { start_date: 'asc' }
      })
    ]);

    // Transform and merge campaigns
    const mergedCampaigns = [
      ...engagementCampaigns.map(campaign => ({
        id: campaign.id,
        type: 'engagement',
        name: campaign.name,
        description: campaign.description,
        templateName: campaign.template?.title,
        templateType: campaign.template?.type,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        status: campaign.status,
        frequency: campaign.frequency,
        color: '#10B981', // Green for engagement
        icon: 'chat',
        stats: {
          totalAssigned: campaign._count.assignments,
          totalResponses: campaign._count.responses,
          completionRate: campaign._count.assignments > 0
            ? Math.round((campaign._count.responses / campaign._count.assignments) * 100)
            : 0
        },
        assignments: campaign.assignments
      })),
      ...assessmentCampaigns.map(campaign => ({
        id: campaign.id,
        type: 'assessment',
        name: campaign.name,
        description: campaign.description,
        templateName: campaign.template?.name,
        templateType: campaign.template?.type,
        startDate: campaign.start_date,
        endDate: campaign.deadline,
        status: campaign.status,
        frequency: campaign.frequency,
        mandatory: campaign.mandatory,
        color: '#3B82F6', // Blue for assessment
        icon: 'clipboard',
        stats: {
          totalAssigned: campaign._count.assignments,
          completed: campaign.assignments.filter(a => a.status === 'COMPLETED').length,
          inProgress: campaign.assignments.filter(a => a.status === 'IN_PROGRESS').length,
          notStarted: campaign.assignments.filter(a => a.status === 'ASSIGNED').length
        },
        assignments: campaign.assignments
      }))
    ];

    // Sort by start date
    mergedCampaigns.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedCampaigns = mergedCampaigns.slice(skip, skip + parseInt(limit));

    logger.info('Retrieved unified calendar data', {
      tenantId,
      engagementCount: engagementCampaigns.length,
      assessmentCount: assessmentCampaigns.length,
      totalCampaigns: mergedCampaigns.length
    });

    res.json({
      success: true,
      data: paginatedCampaigns,
      summary: {
        totalEngagements: engagementCampaigns.length,
        totalAssessments: assessmentCampaigns.length,
        totalCampaigns: mergedCampaigns.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mergedCampaigns.length,
        totalPages: Math.ceil(mergedCampaigns.length / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching unified calendar', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unified calendar data'
    });
  }
};

/**
 * Check for conflicts when scheduling new campaigns
 * @route POST /api/unified/check-conflicts
 */
const checkConflicts = async (req, res) => {
  try {
    const {
      employeeIds,
      startDate,
      endDate,
      campaignType,
      excludeCampaignId
    } = req.body;

    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Check for overlapping campaigns
    const engagementDateOverlap = {
      start_date: { lte: new Date(endDate) },
      end_date: { gte: new Date(startDate) }
    };

    const assessmentDateOverlap = {
      start_date: { lte: new Date(endDate) },
      deadline: { gte: new Date(startDate) }
    };

    // Check both campaign types for conflicts
    const [engagementConflicts, assessmentConflicts] = await Promise.all([
      prisma.engagement_campaigns.findMany({
        where: {
          tenant_id: tenantId,
          ...engagementDateOverlap,
          assignments: {
            some: {
              employee_id: { in: employeeIds }
            }
          },
          ...(excludeCampaignId && campaignType === 'engagement'
            ? { id: { not: excludeCampaignId } }
            : {}),
          status: { notIn: ['COMPLETED', 'ARCHIVED'] }
        },
        include: {
          assignments: {
            where: {
              employee_id: { in: employeeIds }
            },
            select: {
              employee_id: true
            }
          },
          template: {
            select: {
              title: true,
              type: true
            }
          }
        }
      }),
      prisma.assessment_campaigns.findMany({
        where: {
          tenant_id: tenantId,
          ...assessmentDateOverlap,
          assignments: {
            some: {
              employee_id: { in: employeeIds }
            }
          },
          ...(excludeCampaignId && campaignType === 'assessment'
            ? { id: { not: excludeCampaignId } }
            : {}),
          status: { notIn: ['COMPLETED', 'ARCHIVED'] }
        },
        include: {
          assignments: {
            where: {
              employee_id: { in: employeeIds }
            },
            select: {
              employee_id: true
            }
          },
          template: {
            select: {
              title: true,
              type: true
            }
          }
        }
      })
    ]);

    // Analyze conflicts
    const conflicts = [];
    const warnings = [];
    const affectedEmployees = new Set();

    // Process engagement conflicts
    engagementConflicts.forEach(campaign => {
      campaign.assignments.forEach(assignment => {
        affectedEmployees.add(assignment.employee_id);
        conflicts.push({
          type: 'overlap',
          severity: 'warning',
          campaignType: 'engagement',
          campaignId: campaign.id,
          campaignName: campaign.name,
          templateName: campaign.template?.title,
          employeeId: assignment.employee_id,
          message: `Employee already has engagement campaign "${campaign.name}" scheduled`
        });
      });
    });

    // Process assessment conflicts
    assessmentConflicts.forEach(campaign => {
      campaign.assignments.forEach(assignment => {
        affectedEmployees.add(assignment.employee_id);
        const severity = campaign.mandatory ? 'error' : 'warning';
        conflicts.push({
          type: campaign.mandatory ? 'mandatory_conflict' : 'overlap',
          severity,
          campaignType: 'assessment',
          campaignId: campaign.id,
          campaignName: campaign.name,
          templateName: campaign.template?.title,
          employeeId: assignment.employee_id,
          mandatory: campaign.mandatory,
          message: `Employee already has ${campaign.mandatory ? 'mandatory ' : ''}assessment "${campaign.name}" scheduled`
        });
      });
    });

    // Check for cognitive overload (more than 3 active campaigns)
    const totalConflicts = engagementConflicts.length + assessmentConflicts.length;
    if (totalConflicts >= 3) {
      warnings.push({
        type: 'cognitive_overload',
        severity: 'warning',
        message: 'Employees may experience survey fatigue with multiple concurrent campaigns',
        suggestion: 'Consider spacing out campaigns or reducing the number of participants'
      });
    }

    const hasErrors = conflicts.some(c => c.severity === 'error');
    const hasWarnings = conflicts.some(c => c.severity === 'warning') || warnings.length > 0;

    res.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      hasErrors,
      hasWarnings,
      conflicts,
      warnings,
      affectedEmployees: Array.from(affectedEmployees),
      suggestions: {
        alternativeDates: totalConflicts >= 2 ? {
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
        } : null,
        employeesToExclude: Array.from(affectedEmployees).slice(0, 5)
      }
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
 * Get campaign statistics for dashboard
 * @route GET /api/unified/stats
 */
const getCampaignStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const { period = 'month' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get campaign statistics
    const [engagementStats, assessmentStats] = await Promise.all([
      prisma.engagement_campaigns.groupBy({
        by: ['status'],
        where: {
          tenant_id: tenantId,
          created_at: { gte: startDate }
        },
        _count: { status: true }
      }),
      prisma.assessment_campaigns.groupBy({
        by: ['status'],
        where: {
          tenant_id: tenantId,
          created_at: { gte: startDate }
        },
        _count: { status: true }
      })
    ]);

    // Get upcoming campaigns
    const [upcomingEngagements, upcomingAssessments] = await Promise.all([
      prisma.engagement_campaigns.count({
        where: {
          tenant_id: tenantId,
          status: 'PLANNED',
          start_date: { gte: now }
        }
      }),
      prisma.assessment_campaigns.count({
        where: {
          tenant_id: tenantId,
          status: 'PLANNED',
          start_date: { gte: now }
        }
      })
    ]);

    // Get active campaigns
    const [activeEngagements, activeAssessments] = await Promise.all([
      prisma.engagement_campaigns.count({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE'
        }
      }),
      prisma.assessment_campaigns.count({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE'
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalActive: activeEngagements + activeAssessments,
          totalUpcoming: upcomingEngagements + upcomingAssessments,
          engagementActive: activeEngagements,
          assessmentActive: activeAssessments
        },
        engagement: {
          byStatus: engagementStats,
          active: activeEngagements,
          upcoming: upcomingEngagements
        },
        assessment: {
          byStatus: assessmentStats,
          active: activeAssessments,
          upcoming: upcomingAssessments
        },
        period
      }
    });
  } catch (error) {
    logger.error('Error fetching campaign stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign statistics'
    });
  }
};

/**
 * Reschedule a campaign (drag & drop from calendar)
 * @route PATCH /api/unified/reschedule
 */
const rescheduleCampaign = async (req, res) => {
  try {
    const {
      campaignId,
      campaignType,
      newStartDate,
      newEndDate,
      checkConflicts = true
    } = req.body;

    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Validate campaign ownership
    const model = campaignType === 'engagement'
      ? prisma.engagement_campaigns
      : prisma.assessment_campaigns;

    const campaign = await model.findFirst({
      where: {
        id: campaignId,
        tenant_id: tenantId
      },
      include: {
        assignments: {
          select: {
            employee_id: true
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

    // Check if campaign can be rescheduled
    if (campaign.status === 'COMPLETED' || campaign.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reschedule completed or archived campaigns'
      });
    }

    // Check for conflicts if requested
    if (checkConflicts) {
      const employeeIds = campaign.assignments.map(a => a.employee_id);
      const conflictCheck = await checkConflictsInternal({
        employeeIds,
        startDate: newStartDate,
        endDate: newEndDate,
        campaignType,
        excludeCampaignId: campaignId,
        tenantId
      });

      if (conflictCheck.hasErrors) {
        return res.status(409).json({
          success: false,
          error: 'Rescheduling would create conflicts',
          conflicts: conflictCheck.conflicts
        });
      }
    }

    // Update campaign dates
    const updateData = {
      start_date: new Date(newStartDate),
      updated_at: new Date()
    };

    if (campaignType === 'engagement') {
      updateData.end_date = new Date(newEndDate);
    } else {
      updateData.deadline = new Date(newEndDate);
    }

    const updated = await model.update({
      where: { id: campaignId },
      data: updateData
    });

    logger.info('Campaign rescheduled', {
      campaignId,
      campaignType,
      newStartDate,
      newEndDate
    });

    res.json({
      success: true,
      data: updated,
      message: 'Campaign rescheduled successfully'
    });
  } catch (error) {
    logger.error('Error rescheduling campaign', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule campaign'
    });
  }
};

// Internal helper function for conflict checking
async function checkConflictsInternal({ employeeIds, startDate, endDate, campaignType, excludeCampaignId, tenantId }) {
  const engagementDateOverlap = {
    start_date: { lte: new Date(endDate) },
    end_date: { gte: new Date(startDate) }
  };

  const assessmentDateOverlap = {
    start_date: { lte: new Date(endDate) },
    deadline: { gte: new Date(startDate) }
  };

  const [engagementConflicts, assessmentConflicts] = await Promise.all([
    prisma.engagement_campaigns.findMany({
      where: {
        tenant_id: tenantId,
        ...engagementDateOverlap,
        assignments: {
          some: {
            employee_id: { in: employeeIds }
          }
        },
        ...(excludeCampaignId && campaignType === 'engagement'
          ? { id: { not: excludeCampaignId } }
          : {}),
        status: { notIn: ['COMPLETED', 'ARCHIVED'] }
      }
    }),
    prisma.assessment_campaigns.findMany({
      where: {
        tenant_id: tenantId,
        ...assessmentDateOverlap,
        assignments: {
          some: {
            employee_id: { in: employeeIds }
          }
        },
        ...(excludeCampaignId && campaignType === 'assessment'
          ? { id: { not: excludeCampaignId } }
          : {}),
        status: { notIn: ['COMPLETED', 'ARCHIVED'] }
      }
    })
  ]);

  const conflicts = [];
  const hasErrors = assessmentConflicts.some(c => c.mandatory);

  return {
    hasErrors,
    conflicts: [...engagementConflicts, ...assessmentConflicts]
  };
}

module.exports = {
  getUnifiedCalendar,
  checkConflicts,
  getCampaignStats,
  rescheduleCampaign
};