/**
 * Engagement Weighted Results Controller
 * @created 2025-09-26 21:40
 * @description Handles engagement results with weighted scoring
 */

const prisma = require('../../config/database');

/**
 * Helper function to get employee.id from tenant_users.id
 */
const getEmployeeIdFromTenantUser = async (tenantUserId, tenantId) => {
  const tenantUser = await prisma.tenant_users.findUnique({
    where: { id: tenantUserId }
  });

  if (!tenantUser) return null;

  const employee = await prisma.employees.findFirst({
    where: {
      email: tenantUser.email,
      tenant_id: tenantId
    }
  });

  return employee ? employee.id : null;
};

/**
 * Calculate weighted scores for engagement responses
 */
const calculateWeightedScores = async (responses, templateId) => {
  // Get all weights for this template
  const weights = await prisma.engagement_question_weights.findMany({
    where: { template_id: templateId }
  });

  // Create weight map for quick lookup
  const weightMap = {};
  weights.forEach(w => {
    weightMap[w.question_id] = {
      area: w.area,
      weight: w.weight,
      impact_factor: w.impact_factor,
      is_reversed: w.is_reversed
    };
  });

  // Calculate scores
  const areaScores = {};
  const weightedScores = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const response of responses) {
    const questionWeight = weightMap[response.question_id] || {
      area: 'GENERAL',
      weight: 1.0,
      impact_factor: 1.0,
      is_reversed: false
    };

    // Calculate score (1-5 scale to 0-100)
    let value = response.answer || response.value;
    if (questionWeight.is_reversed) {
      value = 6 - value; // Reverse score for negative questions
    }

    const rawScore = (value / 5) * 100;
    const weightedScore = rawScore * questionWeight.weight * questionWeight.impact_factor;

    // Store weighted score for this question
    weightedScores[response.question_id] = {
      raw_value: response.answer || response.value,
      weight: questionWeight.weight,
      weighted_score: weightedScore,
      area: questionWeight.area
    };

    // Add to area totals
    if (!areaScores[questionWeight.area]) {
      areaScores[questionWeight.area] = {
        total_score: 0,
        total_weight: 0,
        count: 0
      };
    }

    areaScores[questionWeight.area].total_score += weightedScore;
    areaScores[questionWeight.area].total_weight += questionWeight.weight;
    areaScores[questionWeight.area].count += 1;

    totalWeightedScore += weightedScore;
    totalWeight += questionWeight.weight;
  }

  // Calculate area averages
  const finalAreaScores = {};
  for (const area in areaScores) {
    finalAreaScores[area] = areaScores[area].total_score / areaScores[area].total_weight;
  }

  // Calculate overall score
  const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  return {
    weighted_scores: weightedScores,
    area_scores: finalAreaScores,
    overall_score: Math.round(overallScore * 100) / 100
  };
};

/**
 * Submit engagement with weighted scoring
 */
const submitWeightedEngagement = async (req, res) => {
  try {
    const { id } = req.params; // assignment_id
    const { responses } = req.body;
    const tenantUserId = String(req.user.id);
    const tenantId = req.user.tenant_id || req.user.tenantId;

    console.log('Submitting weighted engagement for:', tenantUserId);

    // Get employee ID
    const employeeId = await getEmployeeIdFromTenantUser(tenantUserId, tenantId);
    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Get assignment with campaign and template
    const assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        id: id,
        employee_id: employeeId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
      },
      include: {
        campaign: {
          include: {
            template: true
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found or already completed'
      });
    }

    // Calculate weighted scores
    const scores = await calculateWeightedScores(responses, assignment.campaign.template_id);

    // Calculate percentile (within campaign)
    const campaignResults = await prisma.engagement_results.findMany({
      where: { campaign_id: assignment.campaign_id },
      select: { overall_score: true }
    });

    let percentile = 100;
    if (campaignResults.length > 0) {
      const lowerScores = campaignResults.filter(r => r.overall_score < scores.overall_score).length;
      percentile = (lowerScores / campaignResults.length) * 100;
    }

    // Determine strengths and improvements
    const sortedAreas = Object.entries(scores.area_scores)
      .sort((a, b) => b[1] - a[1]);

    const strengths = sortedAreas.slice(0, 3).map(([area, score]) => ({
      area,
      score: Math.round(score * 100) / 100
    }));

    const improvements = sortedAreas.slice(-3).map(([area, score]) => ({
      area,
      score: Math.round(score * 100) / 100
    }));

    // Determine sentiment
    let sentiment = 'NEUTRAL';
    if (scores.overall_score >= 75) sentiment = 'POSITIVE';
    else if (scores.overall_score < 50) sentiment = 'NEGATIVE';

    // Create engagement result
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Create engagement_results record
      const engagementResult = await prisma.engagement_results.create({
        data: {
          campaign_id: assignment.campaign_id,
          assignment_id: assignment.id,
          employee_id: employeeId,
          tenant_user_id: tenantUserId,
          template_id: assignment.campaign.template_id,
          responses: responses,
          weighted_scores: scores.weighted_scores,
          area_scores: scores.area_scores,
          overall_score: scores.overall_score,
          percentile: percentile,
          strengths: strengths,
          improvements: improvements,
          sentiment: sentiment,
          completed_at: new Date(),
          started_at: assignment.started_at || assignment.assigned_at,
          time_taken: assignment.started_at ?
            Math.floor((Date.now() - new Date(assignment.started_at).getTime()) / 1000) : null,
          attempt_number: 1,
          completion_rate: (responses.length / (assignment.campaign.template.questions?.length || 1)) * 100
        }
      });

      // 2. Update assignment status
      await prisma.engagement_campaign_assignments.update({
        where: { id: assignment.id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          completion_rate: 100
        }
      });

      // 3. Mark campaign as having responses
      await prisma.engagement_campaigns.update({
        where: { id: assignment.campaign_id },
        data: { has_responses: true }
      });

      return engagementResult;
    });

    res.json({
      success: true,
      data: {
        id: result.id,
        overall_score: result.overall_score,
        area_scores: result.area_scores,
        percentile: result.percentile,
        strengths: result.strengths,
        improvements: result.improvements,
        sentiment: result.sentiment
      },
      message: 'Engagement submitted successfully with weighted scoring'
    });

  } catch (error) {
    console.error('Error submitting weighted engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit engagement',
      message: error.message
    });
  }
};

/**
 * Get weighted engagement results
 */
const getWeightedEngagementResults = async (req, res) => {
  try {
    const tenantUserId = String(req.user.id);
    const tenantId = req.user.tenant_id || req.user.tenantId;

    // Get employee ID
    const employeeId = await getEmployeeIdFromTenantUser(tenantUserId, tenantId);
    if (!employeeId) {
      return res.json({
        success: true,
        data: [],
        message: 'No results found'
      });
    }

    // Get all engagement results for this employee
    const results = await prisma.engagement_results.findMany({
      where: { employee_id: employeeId },
      include: {
        campaign: {
          include: {
            template: true
          }
        }
      },
      orderBy: { completed_at: 'desc' }
    });

    // Format results
    const formattedResults = results.map(result => ({
      id: result.id,
      campaign: {
        id: result.campaign.id,
        name: result.campaign.name,
        template_name: result.campaign.template.title
      },
      overall_score: result.overall_score,
      area_scores: result.area_scores,
      percentile: result.percentile,
      strengths: result.strengths,
      improvements: result.improvements,
      sentiment: result.sentiment,
      trend: result.trend,
      completed_at: result.completed_at,
      time_taken: result.time_taken
    }));

    res.json({
      success: true,
      data: formattedResults
    });

  } catch (error) {
    console.error('Error fetching weighted results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch results',
      message: error.message
    });
  }
};

/**
 * Get engagement trends for employee
 */
const getEngagementTrends = async (req, res) => {
  try {
    const tenantUserId = String(req.user.id);
    const tenantId = req.user.tenant_id || req.user.tenantId;

    // Get employee ID
    const employeeId = await getEmployeeIdFromTenantUser(tenantUserId, tenantId);
    if (!employeeId) {
      return res.json({
        success: true,
        data: { trends: [] }
      });
    }

    // Get last 6 engagement results
    const results = await prisma.engagement_results.findMany({
      where: { employee_id: employeeId },
      select: {
        overall_score: true,
        area_scores: true,
        completed_at: true
      },
      orderBy: { completed_at: 'desc' },
      take: 6
    });

    if (results.length < 2) {
      return res.json({
        success: true,
        data: {
          trend: 'STABLE',
          message: 'Not enough data for trend analysis'
        }
      });
    }

    // Calculate trend
    const recent = results.slice(0, 3);
    const older = results.slice(3, 6);

    const recentAvg = recent.reduce((sum, r) => sum + (r.overall_score || 0), 0) / recent.length;
    const olderAvg = older.length > 0 ?
      older.reduce((sum, r) => sum + (r.overall_score || 0), 0) / older.length :
      recentAvg;

    let trend = 'STABLE';
    if (recentAvg > olderAvg + 5) trend = 'IMPROVING';
    else if (recentAvg < olderAvg - 5) trend = 'DECLINING';

    res.json({
      success: true,
      data: {
        trend,
        current_score: recentAvg,
        previous_score: olderAvg,
        change: recentAvg - olderAvg,
        history: results.map(r => ({
          score: r.overall_score,
          date: r.completed_at
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
      message: error.message
    });
  }
};

module.exports = {
  submitWeightedEngagement,
  getWeightedEngagementResults,
  getEngagementTrends
};