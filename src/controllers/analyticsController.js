const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Analytics Controller
 * Provides analytics and monitoring endpoints for the assessment system
 */
class AnalyticsController {
  /**
   * Get analytics overview
   */
  async getOverview(req, res) {
    try {
      const { range = '30d' } = req.query;
      const dateRange = this.getDateRange(range);

      // Get counts
      const [
        totalAssessments,
        activeTemplates,
        totalResponses,
        tenantStats
      ] = await Promise.all([
        prisma.tenantAssessmentSelection.count({
          where: { createdAt: { gte: dateRange } }
        }),
        prisma.assessmentTemplate.count({
          where: { isActive: true }
        }),
        prisma.assessmentResponse.count({
          where: { createdAt: { gte: dateRange } }
        }),
        prisma.tenantAssessmentSelection.groupBy({
          by: ['tenantId'],
          where: { createdAt: { gte: dateRange } },
          _count: true
        })
      ]);

      // Calculate completion rates
      const completionData = await prisma.assessmentResponse.groupBy({
        by: ['assessmentId', 'status'],
        where: { createdAt: { gte: dateRange } },
        _count: true
      });

      const completed = completionData
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + d._count, 0);
      const total = completionData.reduce((sum, d) => sum + d._count, 0);
      const avgCompletionRate = total > 0 ? (completed / total) * 100 : 0;

      // Calculate average completion time
      const completionTimes = await prisma.assessmentResponse.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: dateRange }
        },
        select: {
          completedAt: true,
          createdAt: true
        }
      });

      const avgCompletionTime = this.calculateAverageTime(completionTimes);
      const tenantAdoption = (tenantStats.length / 100) * 100; // Assuming 100 total tenants

      // Get usage data
      const usage = await this.getUsageData(dateRange);
      const performance = await this.getPerformanceData(dateRange);
      const ai = await this.getAIUsageData(dateRange);

      res.json({
        overview: {
          totalAssessments,
          activeTemplates,
          totalResponses,
          avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
          avgCompletionTime,
          tenantAdoption: Math.round(tenantAdoption)
        },
        usage,
        performance,
        ai
      });
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get usage data
   */
  async getUsageData(dateRange) {
    // Daily usage
    const dailyData = await prisma.assessmentResponse.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: dateRange } },
      _count: true
    });

    const daily = this.groupByDay(dailyData);

    // By type
    const typeData = await prisma.tenantAssessmentSelection.groupBy({
      by: ['templateId'],
      where: { createdAt: { gte: dateRange } },
      _count: true
    });

    const templates = await prisma.assessmentTemplate.findMany({
      where: {
        id: { in: typeData.map(t => t.templateId) }
      },
      select: { id: true, type: true }
    });

    const byType = typeData.map(t => {
      const template = templates.find(temp => temp.id === t.templateId);
      return {
        type: template?.type || 'unknown',
        count: t._count,
        percentage: 0
      };
    });

    const totalByType = byType.reduce((sum, t) => sum + t.count, 0);
    byType.forEach(t => {
      t.percentage = Math.round((t.count / totalByType) * 100);
    });

    // By tenant
    const tenantData = await prisma.tenantAssessmentSelection.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: dateRange } },
      _count: true,
      orderBy: { _count: { tenantId: 'desc' } },
      take: 10
    });

    const byTenant = tenantData.map(t => ({
      tenant: `Tenant ${t.tenantId.substring(0, 8)}`,
      count: t._count
    }));

    return { daily, byType, byTenant };
  }

  /**
   * Get performance data
   */
  async getPerformanceData(dateRange) {
    // Completion rates by template
    const completionByTemplate = await prisma.assessmentResponse.groupBy({
      by: ['assessmentId', 'status'],
      where: { createdAt: { gte: dateRange } },
      _count: true
    });

    const templateIds = [...new Set(completionByTemplate.map(c => c.assessmentId))];
    const selections = await prisma.tenantAssessmentSelection.findMany({
      where: { id: { in: templateIds } },
      include: { template: true }
    });

    const completionRates = this.calculateCompletionRates(completionByTemplate, selections);

    // Average scores
    const scoreData = await prisma.assessmentResponse.groupBy({
      by: ['assessmentId'],
      where: {
        status: 'completed',
        createdAt: { gte: dateRange }
      },
      _avg: { score: true }
    });

    const avgScores = scoreData.map(s => {
      const selection = selections.find(sel => sel.id === s.assessmentId);
      return {
        template: selection?.template?.name || 'Unknown',
        score: Math.round(s._avg.score || 0)
      };
    });

    // Response time trend
    const responseTime = await this.getResponseTimeTrend(dateRange);

    return { completionRates, avgScores, responseTime };
  }

  /**
   * Get AI usage data
   * Returns zeros until AI usage tracking is implemented
   */
  async getAIUsageData(dateRange) {
    return {
      totalRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      costEstimate: 0,
      byProvider: []
    };
  }

  /**
   * Get real-time activity
   */
  async getActivity(req, res) {
    try {
      const { limit = 10 } = req.query;

      const recentActivities = await prisma.assessmentResponse.findMany({
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          assessment: {
            include: {
              template: true
            }
          }
        }
      });

      const activities = recentActivities.map(activity => ({
        time: this.getRelativeTime(activity.createdAt),
        event: activity.status === 'completed'
          ? 'Assessment completato'
          : 'Assessment iniziato',
        template: activity.assessment.template.name,
        tenant: `Tenant ${activity.assessment.tenantId.substring(0, 8)}`,
        type: activity.assessment.template.type
      }));

      res.json(activities);
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(req, res) {
    try {
      const { range = '30d', format = 'json' } = req.query;
      const dateRange = this.getDateRange(range);

      const data = await this.getOverview({ query: { range } }, { json: () => {} });

      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename=analytics_${range}.json`);
          res.json(data);
          break;

        case 'csv':
          const csv = this.convertToCSV(data);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=analytics_${range}.csv`);
          res.send(csv);
          break;

        case 'pdf':
          // PDF generation would require additional library like pdfkit
          res.status(501).json({ error: 'PDF export not yet implemented' });
          break;

        default:
          res.status(400).json({ error: 'Invalid format' });
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get completion statistics
   */
  async getCompletionStats(req, res) {
    try {
      const { templateId } = req.query;

      const where = templateId
        ? { assessment: { templateId } }
        : {};

      const stats = await prisma.assessmentResponse.groupBy({
        by: ['status'],
        where,
        _count: true
      });

      res.json(stats);
    } catch (error) {
      console.error('Error fetching completion stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get AI usage statistics
   */
  async getAIUsageStats(req, res) {
    try {
      const { range = '30d' } = req.query;
      const dateRange = this.getDateRange(range);

      const aiData = await this.getAIUsageData(dateRange);
      res.json(aiData);
    } catch (error) {
      console.error('Error fetching AI usage stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get tenant-specific analytics
   */
  async getTenantAnalytics(req, res) {
    try {
      const { tenantId } = req.params;
      const { range = '30d' } = req.query;
      const dateRange = this.getDateRange(range);

      const [assessments, responses, templates] = await Promise.all([
        prisma.tenantAssessmentSelection.count({
          where: {
            tenantId,
            createdAt: { gte: dateRange }
          }
        }),
        prisma.assessmentResponse.count({
          where: {
            assessment: { tenantId },
            createdAt: { gte: dateRange }
          }
        }),
        prisma.tenantAssessmentSelection.findMany({
          where: {
            tenantId,
            createdAt: { gte: dateRange }
          },
          include: {
            template: true
          },
          distinct: ['templateId']
        })
      ]);

      res.json({
        tenantId,
        totalAssessments: assessments,
        totalResponses: responses,
        activeTemplates: templates.map(t => t.template),
        period: range
      });
    } catch (error) {
      console.error('Error fetching tenant analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper methods
   */
  getDateRange(range) {
    const now = new Date();
    const map = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };

    const days = map[range] || 30;
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  }

  groupByDay(data) {
    const grouped = {};
    data.forEach(item => {
      const date = item.createdAt.toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + item._count;
    });

    return Object.entries(grouped).map(([date, count]) => ({
      date,
      count
    }));
  }

  calculateAverageTime(times) {
    if (times.length === 0) return 0;

    const durations = times.map(t => {
      const start = new Date(t.createdAt);
      const end = new Date(t.completedAt);
      return (end - start) / (1000 * 60); // minutes
    });

    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    return Math.round(avg);
  }

  calculateCompletionRates(data, selections) {
    const rates = {};

    data.forEach(item => {
      if (!rates[item.assessmentId]) {
        rates[item.assessmentId] = { completed: 0, total: 0 };
      }
      rates[item.assessmentId].total += item._count;
      if (item.status === 'completed') {
        rates[item.assessmentId].completed += item._count;
      }
    });

    return Object.entries(rates).map(([assessmentId, counts]) => {
      const selection = selections.find(s => s.id === assessmentId);
      return {
        template: selection?.template?.name || 'Unknown',
        rate: Math.round((counts.completed / counts.total) * 100)
      };
    });
  }

  async getResponseTimeTrend(dateRange) {
    const times = await prisma.assessmentResponse.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: dateRange }
      },
      select: {
        createdAt: true,
        completedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const grouped = {};
    times.forEach(t => {
      const date = t.createdAt.toISOString().split('T')[0];
      const duration = (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60);

      if (!grouped[date]) {
        grouped[date] = { total: 0, count: 0 };
      }
      grouped[date].total += duration;
      grouped[date].count++;
    });

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      time: Math.round(data.total / data.count)
    }));
  }

  getRelativeTime(date) {
    const now = new Date();
    const diff = (now - new Date(date)) / 1000; // seconds

    if (diff < 60) return `${Math.round(diff)} secondi fa`;
    if (diff < 3600) return `${Math.round(diff / 60)} minuti fa`;
    if (diff < 86400) return `${Math.round(diff / 3600)} ore fa`;
    return `${Math.round(diff / 86400)} giorni fa`;
  }

  convertToCSV(data) {
    // Simple CSV conversion for overview data
    const rows = [
      ['Metric', 'Value'],
      ['Total Assessments', data.overview.totalAssessments],
      ['Active Templates', data.overview.activeTemplates],
      ['Total Responses', data.overview.totalResponses],
      ['Avg Completion Rate', `${data.overview.avgCompletionRate}%`],
      ['Avg Completion Time', `${data.overview.avgCompletionTime} minutes`],
      ['Tenant Adoption', `${data.overview.tenantAdoption}%`]
    ];

    return rows.map(row => row.join(',')).join('\n');
  }
}

module.exports = new AnalyticsController();