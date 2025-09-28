/**
 * Calendar Aggregation Service
 * @module services/calendarAggregationService
 * @created 2025-09-25
 * @description Service for aggregating and formatting calendar data from multiple sources
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

class CalendarAggregationService {
  /**
   * Transform campaigns into calendar events format
   * @param {Array} campaigns - Raw campaign data
   * @param {string} type - Campaign type (engagement/assessment)
   * @returns {Array} Formatted calendar events
   */
  formatCampaignsForCalendar(campaigns, type) {
    return campaigns.map(campaign => {
      const baseEvent = {
        id: `${type}_${campaign.id}`,
        campaignId: campaign.id,
        type,
        title: campaign.name,
        description: campaign.description,
        start: campaign.start_date,
        end: type === 'engagement' ? campaign.end_date : campaign.deadline,
        allDay: false,
        editable: ['PLANNED', 'ACTIVE'].includes(campaign.status),
        className: `campaign-${type}`,
        extendedProps: {
          campaignType: type,
          status: campaign.status,
          templateId: campaign.template_id,
          templateName: campaign.template?.title,
          frequency: campaign.frequency,
          targetCount: campaign.assignments?.length || 0,
          completedCount: 0,
          progressPercentage: 0
        }
      };

      // Calculate completion stats
      if (type === 'engagement') {
        const totalResponses = campaign._count?.responses || 0;
        const totalAssignments = campaign._count?.assignments || 0;
        baseEvent.extendedProps.completedCount = totalResponses;
        baseEvent.extendedProps.progressPercentage = totalAssignments > 0
          ? Math.round((totalResponses / totalAssignments) * 100)
          : 0;
      } else if (type === 'assessment') {
        const completed = campaign.assignments?.filter(a => a.status === 'COMPLETED').length || 0;
        baseEvent.extendedProps.completedCount = completed;
        baseEvent.extendedProps.progressPercentage = campaign.assignments?.length > 0
          ? Math.round((completed / campaign.assignments.length) * 100)
          : 0;
        baseEvent.extendedProps.mandatory = campaign.mandatory;
      }

      // Set color based on type and status
      baseEvent.color = this.getEventColor(type, campaign.status);
      baseEvent.textColor = this.getTextColor(type, campaign.status);

      return baseEvent;
    });
  }

  /**
   * Get color for calendar event based on type and status
   */
  getEventColor(type, status) {
    const colorMap = {
      engagement: {
        PLANNED: '#D1FAE5',    // Light green
        ACTIVE: '#10B981',     // Green
        COMPLETED: '#6B7280',  // Gray
        ARCHIVED: '#E5E7EB'    // Light gray
      },
      assessment: {
        PLANNED: '#DBEAFE',    // Light blue
        ACTIVE: '#3B82F6',     // Blue
        COMPLETED: '#6B7280',  // Gray
        ARCHIVED: '#E5E7EB'    // Light gray
      }
    };

    return colorMap[type]?.[status] || '#9CA3AF';
  }

  /**
   * Get text color for calendar event
   */
  getTextColor(type, status) {
    const isDark = ['ACTIVE', 'COMPLETED'].includes(status);
    return isDark ? '#FFFFFF' : '#111827';
  }

  /**
   * Group campaigns by date for list view
   */
  groupCampaignsByDate(campaigns) {
    const grouped = {};

    campaigns.forEach(campaign => {
      const dateKey = new Date(campaign.start_date).toLocaleDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: campaign.start_date,
          campaigns: []
        };
      }
      grouped[dateKey].campaigns.push(campaign);
    });

    // Sort dates and campaigns within each date
    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(group => ({
        ...group,
        campaigns: group.campaigns.sort((a, b) =>
          new Date(a.start_date) - new Date(b.start_date)
        )
      }));
  }

  /**
   * Calculate workload for employees
   */
  async calculateEmployeeWorkload(tenantId, employeeIds, dateRange) {
    const workloadMap = new Map();

    // Initialize workload for each employee
    employeeIds.forEach(id => {
      workloadMap.set(id, {
        employeeId: id,
        engagementCount: 0,
        assessmentCount: 0,
        totalCount: 0,
        activeCampaigns: [],
        upcomingCampaigns: [],
        workloadLevel: 'low' // low, medium, high, overload
      });
    });

    // Fetch all campaigns for employees
    const [engagements, assessments] = await Promise.all([
      prisma.engagement_campaigns.findMany({
        where: {
          tenant_id: tenantId,
          assignments: {
            some: {
              employee_id: { in: employeeIds }
            }
          },
          status: { in: ['PLANNED', 'ACTIVE'] },
          start_date: { lte: dateRange.end },
          end_date: { gte: dateRange.start }
        },
        include: {
          assignments: {
            where: {
              employee_id: { in: employeeIds }
            },
            select: {
              employee_id: true,
              status: true
            }
          }
        }
      }),
      prisma.assessment_campaigns.findMany({
        where: {
          tenant_id: tenantId,
          assignments: {
            some: {
              employee_id: { in: employeeIds }
            }
          },
          status: { in: ['PLANNED', 'ACTIVE'] },
          start_date: { lte: dateRange.end },
          deadline: { gte: dateRange.start }
        },
        include: {
          assignments: {
            where: {
              employee_id: { in: employeeIds }
            },
            select: {
              employee_id: true,
              status: true
            }
          }
        }
      })
    ]);

    // Process engagement campaigns
    engagements.forEach(campaign => {
      campaign.assignments.forEach(assignment => {
        const workload = workloadMap.get(assignment.employee_id);
        if (workload) {
          workload.engagementCount++;
          workload.totalCount++;

          const campaignInfo = {
            id: campaign.id,
            name: campaign.name,
            type: 'engagement',
            status: campaign.status
          };

          if (campaign.status === 'ACTIVE') {
            workload.activeCampaigns.push(campaignInfo);
          } else {
            workload.upcomingCampaigns.push(campaignInfo);
          }
        }
      });
    });

    // Process assessment campaigns
    assessments.forEach(campaign => {
      campaign.assignments.forEach(assignment => {
        const workload = workloadMap.get(assignment.employee_id);
        if (workload) {
          workload.assessmentCount++;
          workload.totalCount++;

          const campaignInfo = {
            id: campaign.id,
            name: campaign.name,
            type: 'assessment',
            status: campaign.status,
            mandatory: campaign.mandatory
          };

          if (campaign.status === 'ACTIVE') {
            workload.activeCampaigns.push(campaignInfo);
          } else {
            workload.upcomingCampaigns.push(campaignInfo);
          }
        }
      });
    });

    // Calculate workload levels
    workloadMap.forEach(workload => {
      if (workload.totalCount === 0) {
        workload.workloadLevel = 'none';
      } else if (workload.totalCount <= 2) {
        workload.workloadLevel = 'low';
      } else if (workload.totalCount <= 4) {
        workload.workloadLevel = 'medium';
      } else if (workload.totalCount <= 6) {
        workload.workloadLevel = 'high';
      } else {
        workload.workloadLevel = 'overload';
      }
    });

    return Array.from(workloadMap.values());
  }

  /**
   * Generate timeline view data
   */
  async generateTimelineData(tenantId, dateRange, groupBy = 'employee') {
    const timeline = [];

    if (groupBy === 'employee') {
      // Get all employees with campaigns
      const employees = await prisma.tenant_users.findMany({
        where: {
          tenant_id: tenantId,
          OR: [
            {
              engagement_campaign_assignments: {
                some: {
                  campaign: {
                    start_date: { lte: dateRange.end },
                    end_date: { gte: dateRange.start }
                  }
                }
              }
            },
            {
              assessment_campaign_assignments: {
                some: {
                  campaign: {
                    start_date: { lte: dateRange.end },
                    deadline: { gte: dateRange.start }
                  }
                }
              }
            }
          ]
        },
        select: {
          id: true,
          email: true,
          engagement_campaign_assignments: {
            include: {
              campaign: true
            }
          },
          assessment_campaign_assignments: {
            include: {
              campaign: true
            }
          }
        }
      });

      employees.forEach(employee => {
        const events = [];

        // Add engagement campaigns
        employee.engagement_campaign_assignments.forEach(assignment => {
          events.push({
            id: `eng_${assignment.id}`,
            title: assignment.campaign.name,
            start: assignment.campaign.start_date,
            end: assignment.campaign.end_date,
            type: 'engagement',
            status: assignment.status
          });
        });

        // Add assessment campaigns
        employee.assessment_campaign_assignments.forEach(assignment => {
          events.push({
            id: `ass_${assignment.id}`,
            title: assignment.campaign.name,
            start: assignment.campaign.start_date,
            end: assignment.campaign.deadline,
            type: 'assessment',
            status: assignment.status
          });
        });

        timeline.push({
          id: employee.id,
          title: employee.email,
          events: events.sort((a, b) => new Date(a.start) - new Date(b.start))
        });
      });
    }

    return timeline;
  }

  /**
   * Get calendar summary statistics
   */
  async getCalendarSummary(tenantId, dateRange) {
    const [
      totalEngagements,
      activeEngagements,
      totalAssessments,
      activeAssessments,
      totalEmployees
    ] = await Promise.all([
      prisma.engagement_campaigns.count({
        where: {
          tenant_id: tenantId,
          start_date: { lte: dateRange.end },
          end_date: { gte: dateRange.start }
        }
      }),
      prisma.engagement_campaigns.count({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE'
        }
      }),
      prisma.assessment_campaigns.count({
        where: {
          tenant_id: tenantId,
          start_date: { lte: dateRange.end },
          deadline: { gte: dateRange.start }
        }
      }),
      prisma.assessment_campaigns.count({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE'
        }
      }),
      prisma.tenant_users.count({
        where: {
          tenant_id: tenantId,
          OR: [
            {
              engagement_campaign_assignments: {
                some: {
                  campaign: {
                    start_date: { lte: dateRange.end },
                    end_date: { gte: dateRange.start }
                  }
                }
              }
            },
            {
              assessment_campaign_assignments: {
                some: {
                  campaign: {
                    start_date: { lte: dateRange.end },
                    deadline: { gte: dateRange.start }
                  }
                }
              }
            }
          ]
        }
      })
    ]);

    return {
      totalCampaigns: totalEngagements + totalAssessments,
      activeCampaigns: activeEngagements + activeAssessments,
      engagementCampaigns: {
        total: totalEngagements,
        active: activeEngagements
      },
      assessmentCampaigns: {
        total: totalAssessments,
        active: activeAssessments
      },
      employeesInvolved: totalEmployees,
      dateRange
    };
  }
}

module.exports = new CalendarAggregationService();