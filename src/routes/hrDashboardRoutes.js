const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticateTenantUser } = require('../middlewares/unifiedAuth');

/**
 * GET /api/hr/dashboard-stats
 * Aggregated HR dashboard statistics from real DB data
 */
router.get('/dashboard-stats', authenticateTenantUser, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;

    const [
      employeeTotal,
      unassignedResult,
      skillGapsResult,
      lowEngagementResult,
      availableCount,
      activeProjects,
      openRoles,
      engagementAverages,
      engagementTrend,
      templateCount,
      activeCampaigns,
      completedAssessments,
      inProgressAssignments,
      assignedEmployeesResult,
      topSkills,
      departmentDistribution,
    ] = await Promise.all([
      // 1. Total active employees
      safeQuery(() =>
        prisma.employees.count({
          where: { tenant_id: tenantId, is_active: true },
        })
      ),

      // 2. Employees without project assignments (employee_projects)
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT COUNT(DISTINCT e.id)::int as count
          FROM employees e
          LEFT JOIN employee_projects ep ON e.id = ep.employee_id AND ep.is_current = true
          WHERE e.tenant_id = ${tenantId}::uuid
            AND e.is_active = true
            AND ep.id IS NULL
        `
      ),

      // 3. Employees with < 3 skills
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM employees e
          LEFT JOIN (
            SELECT employee_id, COUNT(*) as skill_count
            FROM employee_skills
            WHERE tenant_id = ${tenantId}::uuid
            GROUP BY employee_id
          ) es ON e.id = es.employee_id
          WHERE e.tenant_id = ${tenantId}::uuid
            AND e.is_active = true
            AND (es.skill_count IS NULL OR es.skill_count < 3)
        `
      ),

      // 4. Employees with avg engagement < 60
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT COUNT(DISTINCT sub.employee_id)::int as count
          FROM (
            SELECT es.employee_id,
              AVG(COALESCE(es.job_satisfaction, 0) + COALESCE(es.work_life_balance, 0) +
                  COALESCE(es.career_development, 0) + COALESCE(es.team_collaboration, 0)) / 4.0 as avg_score
            FROM engagement_surveys es
            WHERE es.tenant_id = ${tenantId}::uuid
            GROUP BY es.employee_id
            HAVING AVG(COALESCE(es.job_satisfaction, 0) + COALESCE(es.work_life_balance, 0) +
                       COALESCE(es.career_development, 0) + COALESCE(es.team_collaboration, 0)) / 4.0 < 60
          ) sub
        `
      ),

      // 5. Available (active, no current projects)
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT COUNT(DISTINCT e.id)::int as count
          FROM employees e
          LEFT JOIN employee_projects ep ON e.id = ep.employee_id AND ep.is_current = true
          WHERE e.tenant_id = ${tenantId}::uuid
            AND e.is_active = true
            AND ep.id IS NULL
        `
      ),

      // 6. Active projects
      safeQuery(() =>
        prisma.projects.count({
          where: { tenant_id: tenantId, status: 'ACTIVE' },
        })
      ),

      // 7. Open project roles
      safeQuery(() =>
        prisma.project_roles.count({
          where: {
            status: 'OPEN',
            projects: { tenant_id: tenantId },
          },
        })
      ),

      // 8. Engagement averages by area
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT
            COALESCE(AVG(job_satisfaction), 0)::int as satisfaction,
            COALESCE(AVG(work_life_balance), 0)::int as work_life,
            COALESCE(AVG(career_development), 0)::int as growth,
            COALESCE(AVG(team_collaboration), 0)::int as motivation,
            COALESCE(AVG(
              (COALESCE(job_satisfaction, 0) + COALESCE(work_life_balance, 0) +
               COALESCE(career_development, 0) + COALESCE(team_collaboration, 0)) / 4.0
            ), 0)::int as overall_score
          FROM engagement_surveys
          WHERE tenant_id = ${tenantId}::uuid
        `
      ),

      // 9. Engagement trend by month (from engagement_results)
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT
            TO_CHAR(er.completed_at, 'Mon') as month,
            EXTRACT(YEAR FROM er.completed_at) as year,
            EXTRACT(MONTH FROM er.completed_at) as month_num,
            ROUND(AVG(er.overall_score))::int as value
          FROM engagement_results er
          JOIN engagement_campaigns ec ON er.campaign_id = ec.id
          WHERE ec.tenant_id = ${tenantId}
          GROUP BY TO_CHAR(er.completed_at, 'Mon'), EXTRACT(YEAR FROM er.completed_at), EXTRACT(MONTH FROM er.completed_at)
          ORDER BY year DESC, month_num DESC
          LIMIT 6
        `
      ),

      // 10. Template count
      safeQuery(() =>
        prisma.engagement_templates.count({
          where: { tenant_id: tenantId },
        })
      ),

      // 11. Active engagement campaigns
      safeQuery(() =>
        prisma.engagement_campaigns.count({
          where: { tenant_id: tenantId, status: 'ACTIVE' },
        })
      ),

      // 12. Completed assessment results
      safeQuery(() =>
        prisma.assessment_results.count({
          where: {
            campaign: { tenant_id: tenantId },
          },
        })
      ),

      // 13. In-progress assessment assignments
      safeQuery(() =>
        prisma.assessment_campaign_assignments.count({
          where: {
            status: 'IN_PROGRESS',
            campaign: { tenant_id: tenantId },
          },
        })
      ),

      // 14. Distinct assigned employees
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT COUNT(DISTINCT aca.employee_id)::int as count
          FROM assessment_campaign_assignments aca
          JOIN assessment_campaigns ac ON aca.campaign_id = ac.id
          WHERE ac.tenant_id = ${tenantId}
        `
      ),

      // 15. Top 8 skills by count
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT s."NameKnown_Skill" as skill, COUNT(es.id)::int as count
          FROM employee_skills es
          JOIN skills s ON es.skill_id = s.id
          WHERE es.tenant_id = ${tenantId}::uuid
          GROUP BY s."NameKnown_Skill"
          ORDER BY count DESC
          LIMIT 8
        `
      ),

      // 16. Department distribution
      safeQuery(() =>
        prisma.$queryRaw`
          SELECT d.department_name as name, COUNT(e.id)::int as count
          FROM employees e
          JOIN departments d ON e.department_id = d.id
          WHERE e.tenant_id = ${tenantId}::uuid
            AND e.is_active = true
          GROUP BY d.department_name
          ORDER BY count DESC
        `
      ),
    ]);

    // Process results
    const total = employeeTotal || 0;
    const unassigned = extractCount(unassignedResult);
    const skillGaps = extractCount(skillGapsResult);
    const lowEngagement = extractCount(lowEngagementResult);
    const available = extractCount(availableCount);

    // Engagement metrics
    const engMetrics = Array.isArray(engagementAverages) && engagementAverages.length > 0
      ? engagementAverages[0]
      : { satisfaction: 0, work_life: 0, growth: 0, motivation: 0, overall_score: 0 };

    // Engagement trend (reverse to chronological order)
    const trend = Array.isArray(engagementTrend)
      ? engagementTrend.reverse().map(r => ({ month: r.month, value: r.value || 0 }))
      : [];

    // Skills distribution with percentage
    const skillsDist = Array.isArray(topSkills)
      ? topSkills.map(s => ({
          skill: s.skill || 'Unknown',
          count: s.count || 0,
          percentage: total > 0 ? Math.round((s.count / total) * 100) : 0,
        }))
      : [];

    // Department distribution with colors
    const DEPT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const departments = Array.isArray(departmentDistribution)
      ? departmentDistribution.map((d, i) => ({
          name: d.name,
          count: d.count,
          color: DEPT_COLORS[i % DEPT_COLORS.length],
        }))
      : [];

    res.json({
      success: true,
      data: {
        employees: {
          total,
          unassigned,
          skillGaps,
          lowEngagement,
          available,
        },
        projects: {
          active: activeProjects || 0,
          openRoles: openRoles || 0,
        },
        engagement: {
          overallScore: engMetrics.overall_score || 0,
          satisfaction: engMetrics.satisfaction || 0,
          growth: engMetrics.growth || 0,
          workLife: engMetrics.work_life || 0,
          motivation: engMetrics.motivation || 0,
          trend,
        },
        assessments: {
          templateCount: templateCount || 0,
          activeCampaigns: activeCampaigns || 0,
          completedCount: completedAssessments || 0,
          inProgressCount: inProgressAssignments || 0,
          assignedEmployees: extractCount(assignedEmployeesResult),
        },
        skills: {
          distribution: skillsDist,
        },
        departments,
      },
    });
  } catch (error) {
    console.error('Error fetching HR dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message,
    });
  }
});

/**
 * Safe query wrapper - returns default value on error
 */
async function safeQuery(queryFn, defaultValue = null) {
  try {
    return await queryFn();
  } catch (err) {
    console.warn('HR Dashboard query failed:', err.message);
    return defaultValue;
  }
}

/**
 * Extract count from raw query result
 */
function extractCount(result) {
  if (Array.isArray(result) && result.length > 0) {
    return result[0].count || 0;
  }
  return 0;
}

module.exports = router;
