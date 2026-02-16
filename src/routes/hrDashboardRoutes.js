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

/**
 * GET /api/hr/alerts
 * Generate alerts from real DB data (engagement, unassigned, skill gaps, campaigns, projects)
 */
router.get('/alerts', authenticateTenantUser, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const alerts = [];

    // 1. Low engagement employees (avg < 50)
    const lowEngagement = await safeQuery(() =>
      prisma.$queryRaw`
        SELECT e.id, e.first_name, e.last_name, sr.title as role_title,
          AVG(COALESCE(es.job_satisfaction,0) + COALESCE(es.work_life_balance,0) + COALESCE(es.career_development,0) + COALESCE(es.team_collaboration,0)) / 4.0 as avg_score
        FROM employees e
        JOIN engagement_surveys es ON e.id = es.employee_id
        LEFT JOIN employee_roles er ON e.id = er.employee_id AND er.is_primary = true
        LEFT JOIN sub_roles sr ON er.sub_role_id = sr.id
        WHERE e.tenant_id = ${tenantId}::uuid AND e.is_active = true
        GROUP BY e.id, e.first_name, e.last_name, sr.title
        HAVING AVG(COALESCE(es.job_satisfaction,0) + COALESCE(es.work_life_balance,0) + COALESCE(es.career_development,0) + COALESCE(es.team_collaboration,0)) / 4.0 < 50
        LIMIT 5
      `,
      []
    );
    if (Array.isArray(lowEngagement)) {
      lowEngagement.forEach(e => {
        const score = Math.round(Number(e.avg_score) || 0);
        alerts.push({
          title: `Low engagement: ${e.first_name} ${e.last_name}`,
          description: `Average engagement score ${score}/100. 1:1 meeting recommended.`,
          priority: 'high',
          type: 'engagement',
          targetEmployee: {
            id: String(e.id),
            name: `${e.first_name} ${e.last_name}`,
            role: e.role_title || 'N/A',
          },
          createdBy: 'AI System',
          createdAt: new Date().toISOString(),
          status: 'open',
        });
      });
    }

    // 2. Employees unassigned for > 30 days
    const unassigned = await safeQuery(() =>
      prisma.$queryRaw`
        SELECT e.id, e.first_name, e.last_name, sr.title as role_title, e.created_at
        FROM employees e
        LEFT JOIN employee_projects ep ON e.id = ep.employee_id AND ep.is_current = true
        LEFT JOIN employee_roles er ON e.id = er.employee_id AND er.is_primary = true
        LEFT JOIN sub_roles sr ON er.sub_role_id = sr.id
        WHERE e.tenant_id = ${tenantId}::uuid AND e.is_active = true AND ep.id IS NULL
          AND e.created_at < NOW() - INTERVAL '30 days'
        LIMIT 5
      `,
      []
    );
    if (Array.isArray(unassigned)) {
      unassigned.forEach(e => {
        alerts.push({
          title: `Unassigned > 30 days: ${e.first_name} ${e.last_name}`,
          description: `Employee has not been assigned to any project for over 30 days.`,
          priority: 'medium',
          type: 'performance',
          targetEmployee: {
            id: String(e.id),
            name: `${e.first_name} ${e.last_name}`,
            role: e.role_title || 'N/A',
          },
          createdBy: 'AI System',
          createdAt: new Date().toISOString(),
          status: 'open',
        });
      });
    }

    // 3. Employees with < 2 skills
    const lowSkills = await safeQuery(() =>
      prisma.$queryRaw`
        SELECT e.id, e.first_name, e.last_name, sr.title as role_title, COALESCE(skill_counts.cnt, 0)::int as skill_count
        FROM employees e
        LEFT JOIN (SELECT employee_id, COUNT(*)::int as cnt FROM employee_skills WHERE tenant_id = ${tenantId}::uuid GROUP BY employee_id) skill_counts ON e.id = skill_counts.employee_id
        LEFT JOIN employee_roles er ON e.id = er.employee_id AND er.is_primary = true
        LEFT JOIN sub_roles sr ON er.sub_role_id = sr.id
        WHERE e.tenant_id = ${tenantId}::uuid AND e.is_active = true AND COALESCE(skill_counts.cnt, 0) < 2
        LIMIT 5
      `,
      []
    );
    if (Array.isArray(lowSkills)) {
      lowSkills.forEach(e => {
        alerts.push({
          title: `Critical skill gap: ${e.first_name} ${e.last_name}`,
          description: `Employee has only ${e.skill_count} skill(s) recorded. Profile enrichment needed.`,
          priority: 'medium',
          type: 'career_development',
          targetEmployee: {
            id: String(e.id),
            name: `${e.first_name} ${e.last_name}`,
            role: e.role_title || 'N/A',
          },
          createdBy: 'AI System',
          createdAt: new Date().toISOString(),
          status: 'open',
        });
      });
    }

    // 4. Campaigns ending within 7 days
    try {
      const expiringCampaigns = await prisma.engagement_campaigns.findMany({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE',
          end_date: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
        take: 3,
      });
      if (Array.isArray(expiringCampaigns)) {
        expiringCampaigns.forEach(campaign => {
          alerts.push({
            title: `Campaign ending soon: ${campaign.name}`,
            description: `Campaign "${campaign.name}" ends on ${campaign.end_date?.toISOString()?.split('T')[0] || 'N/A'}.`,
            priority: 'low',
            type: 'operational',
            createdBy: 'AI System',
            createdAt: new Date().toISOString(),
            status: 'open',
          });
        });
      }
    } catch (err) {
      console.warn('HR Dashboard alerts: campaigns query failed:', err.message);
    }

    // 5. At-risk projects (completion < 20% and end_date < 30 days from now)
    try {
      const atRiskProjects = await prisma.projects.findMany({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE',
          completion_percentage: { lt: 20 },
          end_date: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
        take: 3,
      });
      if (Array.isArray(atRiskProjects)) {
        atRiskProjects.forEach(project => {
          alerts.push({
            title: `Project at risk: ${project.name}`,
            description: `Project "${project.name}" is at ${project.completion_percentage || 0}% completion with deadline approaching.`,
            priority: 'high',
            type: 'performance',
            isGeneric: true,
            createdBy: 'AI System',
            createdAt: new Date().toISOString(),
            status: 'open',
          });
        });
      }
    } catch (err) {
      console.warn('HR Dashboard alerts: projects query failed:', err.message);
    }

    // Sort by priority (high=1, medium=2, low=3) and limit to 20
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));
    const limitedAlerts = alerts.slice(0, 20);

    res.json({ success: true, data: limitedAlerts });
  } catch (error) {
    console.error('Error fetching HR alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching HR alerts',
      error: error.message,
    });
  }
});

/**
 * GET /api/hr/vacancies
 * Open project roles (vacancies) with skills and project info
 */
router.get('/vacancies', authenticateTenantUser, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId;

    let roles;
    try {
      roles = await prisma.project_roles.findMany({
        where: {
          status: 'OPEN',
          projects: { tenant_id: tenantId },
        },
        include: {
          projects: { select: { id: true, name: true } },
          sub_roles: { select: { id: true, title: true, roles: { select: { role_name: true } } } },
          project_role_skills: { include: { skills: { select: { id: true, NameKnown_Skill: true } } } },
        },
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
        take: 50,
      });
    } catch (err) {
      console.warn('HR Dashboard vacancies: project_role_skills relation may not exist, retrying without it:', err.message);
      roles = await prisma.project_roles.findMany({
        where: {
          status: 'OPEN',
          projects: { tenant_id: tenantId },
        },
        include: {
          projects: { select: { id: true, name: true } },
          sub_roles: { select: { id: true, title: true, roles: { select: { role_name: true } } } },
        },
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
        take: 50,
      });
    }

    const mappedRoles = (roles || []).map(role => {
      const roleSkills = role.project_role_skills || [];
      return {
        id: role.id,
        title: role.title || role.sub_roles?.title || 'Open Role',
        projectId: role.project_id,
        projectName: role.projects?.name || 'N/A',
        department: role.sub_roles?.roles?.role_name || 'General',
        parent_role_name: role.sub_roles?.roles?.role_name || '',
        sub_role_id: role.sub_role_id,
        sub_role_name: role.sub_roles?.title || '',
        seniority: role.seniority || 'MIDDLE',
        priority: role.priority || 'NORMAL',
        status: role.status,
        quantity: role.quantity || 1,
        allocation_percentage: role.allocation_percentage || 100,
        min_experience_years: role.min_experience_years || 0,
        preferred_experience_years: role.preferred_experience_years || 0,
        hard_skills: roleSkills
          .filter(s => s.skill_type === 'HARD' || !s.skill_type)
          .map(s => ({ id: s.skills?.id, name: s.skills?.NameKnown_Skill || 'Unknown' })),
        soft_skills: roleSkills
          .filter(s => s.skill_type === 'SOFT')
          .map(s => ({ id: s.skills?.id, name: s.skills?.NameKnown_Skill || 'Unknown' })),
        required_certifications: role.required_certifications || [],
        preferred_certifications: role.preferred_certifications || [],
        required_languages: role.language_required || [],
        work_mode: role.work_mode || 'HYBRID',
        location: role.location || '',
        budget_range: role.budget_range ? `${role.budget_range.min || 0}-${role.budget_range.max || 0}` : '',
        description: role.description || '',
        description_it: role.description_it || '',
        constraints: role.constraints
          ? (Array.isArray(role.constraints) ? role.constraints.join('. ') : String(role.constraints))
          : '',
        opportunities: role.opportunities
          ? (Array.isArray(role.opportunities) ? role.opportunities.join('. ') : String(role.opportunities))
          : '',
        requestedBy: role.requested_by || null,
        createdAt: role.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: role.updated_at?.toISOString() || new Date().toISOString(),
        is_urgent: role.is_urgent || false,
        is_critical: role.is_critical || false,
        is_billable: role.is_billable !== undefined ? role.is_billable : true,
        matchedCandidatesCount: 0,
        difficulty: 'MEDIUM',
      };
    });

    res.json({ success: true, data: mappedRoles });
  } catch (error) {
    console.error('Error fetching HR vacancies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vacancies',
      error: error.message,
    });
  }
});

module.exports = router;
