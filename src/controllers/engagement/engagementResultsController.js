/**
 * Engagement Results Controller
 * @module controllers/engagement/engagementResultsController
 * @created 2025-09-26 20:30
 * @updated 2025-09-26 22:00 - Updated to use new engagement_results table
 * @description Handles retrieval and analysis of engagement survey results
 */

const prisma = require('../../config/database');

/**
 * Helper function to get employee.id from tenant_users.id
 */
const getEmployeeIdFromTenantUser = async (tenantUserId, tenantId) => {
  // First find the tenant_user to get their email
  const tenantUser = await prisma.tenant_users.findUnique({
    where: {
      id: tenantUserId
    }
  });

  if (!tenantUser) {
    return null;
  }

  // Then find the employee by email and tenant_id
  const employee = await prisma.employees.findFirst({
    where: {
      email: tenantUser.email,
      tenant_id: tenantId
    }
  });

  return employee ? employee.id : null;
};

/**
 * Get engagement results for the logged-in employee (using new engagement_results table)
 */
const getMyEngagementResults = async (req, res) => {
  try {
    // Convert id to string if it's a number (old tokens might have numeric id)
    const tenantUserId = String(req.user.id); // Convert to String for tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;

    console.log('Fetching engagement results for tenant_user:', tenantUserId);

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(tenantUserId, tenantId);

    if (!employeeId) {
      console.log('No employee found for tenant_user:', tenantUserId);
      return res.json({
        success: true,
        data: {
          latest: null,
          history: [],
          statistics: null,
          allResults: []
        }
      });
    }

    // Fetch engagement results from the new engagement_results table
    const engagementResults = await prisma.engagement_results.findMany({
      where: {
        employee_id: employeeId
      },
      include: {
        campaign: {
          include: {
            template: true
          }
        }
      },
      orderBy: {
        completed_at: 'desc'
      }
    });

    console.log(`Found ${engagementResults.length} engagement results for employee:`, employeeId);

    // Format results for frontend
    const results = engagementResults.map(result => ({
      id: result.id,
      campaignName: result.campaign.name,
      templateName: result.campaign.template.title,
      completedAt: result.completed_at,
      startedAt: result.started_at,
      responseTime: result.time_taken,
      scores: {
        overall: result.overall_score || 0,
        byArea: result.area_scores || {}
      },
      percentile: result.percentile,
      strengths: result.strengths,
      improvements: result.improvements,
      sentiment: result.sentiment,
      trend: result.trend,
      totalQuestions: result.responses ? Object.keys(result.responses).length : 0,
      answeredQuestions: result.responses ? Object.keys(result.responses).length : 0,
      completionRate: result.completion_rate
    }));

    // Get historical data for trend analysis
    const historicalData = results.map(r => ({
      date: r.completedAt,
      overall: r.scores.overall,
      ...r.scores.byArea
    }));

    // Get latest result for radar chart
    const latestResult = results[0] || null;

    // Calculate statistics
    const stats = calculateStatistics(results);

    res.json({
      success: true,
      data: {
        latest: latestResult,
        history: historicalData,
        statistics: stats,
        allResults: results
      }
    });

  } catch (error) {
    console.error('Error fetching engagement results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch engagement results',
      message: error.message
    });
  }
};

/**
 * Get engagement results by campaign ID
 */
const getEngagementResultsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const tenantUserId = String(req.user.id);
    const tenantId = req.user.tenant_id || req.user.tenantId;

    // Get employee ID
    const employeeId = await getEmployeeIdFromTenantUser(tenantUserId, tenantId);

    if (!employeeId) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Fetch specific campaign result from new table
    const result = await prisma.engagement_results.findFirst({
      where: {
        campaign_id: campaignId,
        employee_id: employeeId
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                questions: true
              }
            }
          }
        }
      }
    });

    if (!result) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Format response data
    const formattedResult = {
      id: result.id,
      campaignName: result.campaign.name,
      templateName: result.campaign.template.title,
      completedAt: result.completed_at,
      scores: {
        overall: result.overall_score || 0,
        byArea: result.area_scores || {}
      },
      percentile: result.percentile,
      strengths: result.strengths,
      improvements: result.improvements,
      sentiment: result.sentiment,
      responses: result.responses,
      questions: result.campaign.template.questions
    };

    res.json({
      success: true,
      data: formattedResult
    });

  } catch (error) {
    console.error('Error fetching campaign results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign results',
      message: error.message
    });
  }
};

/**
 * Calculate statistics from results
 */
const calculateStatistics = (results) => {
  if (!results || results.length === 0) {
    return null;
  }

  const overallScores = results.map(r => r.scores.overall);
  const avgScore = overallScores.reduce((sum, s) => sum + s, 0) / overallScores.length;
  const maxScore = Math.max(...overallScores);
  const minScore = Math.min(...overallScores);

  // Calculate trend
  let trend = 'stable';
  if (results.length >= 2) {
    const recent = overallScores.slice(0, Math.min(3, results.length));
    const older = overallScores.slice(3, Math.min(6, results.length));

    if (older.length > 0) {
      const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
      const olderAvg = older.reduce((sum, s) => sum + s, 0) / older.length;

      if (recentAvg > olderAvg + 5) trend = 'improving';
      else if (recentAvg < olderAvg - 5) trend = 'declining';
    }
  }

  // Calculate area statistics
  const areaStats = {};
  const areas = ['MOTIVATION', 'LEADERSHIP', 'COMMUNICATION', 'WORK_LIFE_BALANCE', 'BELONGING', 'GROWTH'];

  areas.forEach(area => {
    const areaScores = results
      .map(r => r.scores.byArea[area])
      .filter(s => s !== undefined && s !== null);

    if (areaScores.length > 0) {
      areaStats[area] = {
        average: areaScores.reduce((sum, s) => sum + s, 0) / areaScores.length,
        max: Math.max(...areaScores),
        min: Math.min(...areaScores)
      };
    }
  });

  return {
    totalResponses: results.length,
    averageScore: Math.round(avgScore * 100) / 100,
    highestScore: Math.round(maxScore * 100) / 100,
    lowestScore: Math.round(minScore * 100) / 100,
    trend: trend,
    byArea: areaStats,
    lastUpdated: results[0]?.completedAt || null
  };
};

module.exports = {
  getMyEngagementResults,
  getEngagementResultsByCampaign
};