const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateTenantUser } = require('../middlewares/unifiedAuth');

const prisma = new PrismaClient();

// Get personal dashboard data for the logged-in user
router.get('/personal', authenticateTenantUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const tenantId = req.user.tenant_id || req.user.tenantId;

    console.log('Dashboard request - User:', userEmail, 'Tenant:', tenantId);

    // Find the employee
    const employee = await prisma.employees.findFirst({
      where: {
        email: userEmail,
        tenant_id: tenantId
      },
      include: {
        departments: true,
        employee_roles: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    // Calculate seniority from hire_date
    const hireDate = new Date(employee.hire_date);
    const now = new Date();
    const yearsOfService = (now - hireDate) / (365 * 24 * 60 * 60 * 1000);

    let seniority = 'Junior';
    if (yearsOfService >= 5) {
      seniority = 'Senior';
    } else if (yearsOfService >= 2) {
      seniority = 'Middle';
    }

    // Get current project
    const currentProjectAssignment = await prisma.employee_projects.findFirst({
      where: {
        employee_id: employee.id,
        is_current: true
      },
      orderBy: {
        start_date: 'desc'
      }
    });

    const currentProject = currentProjectAssignment ? {
      name: currentProjectAssignment.project_name,
      role: currentProjectAssignment.role,
      description: currentProjectAssignment.description
    } : null;

    // Get current role with relations
    const currentRoleData = await prisma.employee_roles.findFirst({
      where: {
        employee_id: employee.id,
        is_current: true
      },
      include: {
        roles: {
          select: {
            id: true,
            Role: true,
            NameKnown_Role: true
          }
        },
        sub_roles: {
          select: {
            id: true,
            Sub_Role: true,
            NameKnown_Sub_Role: true
          }
        }
      }
    });

    // Get seniority from role anni_esperienza if available
    let finalSeniority = seniority;
    if (currentRoleData?.anni_esperienza) {
      const roleYears = currentRoleData.anni_esperienza;
      if (roleYears >= 5) {
        finalSeniority = 'Senior';
      } else if (roleYears >= 2) {
        finalSeniority = 'Middle';
      } else {
        finalSeniority = 'Junior';
      }
    }

    // Transform skills data
    const skillNames = {
      1: 'JavaScript',
      2: 'TypeScript',
      3: 'React',
      4: 'Node.js',
      5: 'Python',
      6: 'SQL',
      7: 'Docker',
      8: 'AWS',
      9: 'Git',
      10: 'Agile/Scrum'
    };

    const skills = employee.employee_skills ? employee.employee_skills.map(es => ({
      id: es.skill_id,
      name: skillNames[es.skill_id] || `Skill ${es.skill_id}`,
      proficiencyLevel: es.proficiency_level,
      percentage: es.proficiency_level * 20
    })) : [];

    // Engagement trend (empty for now)
    const engagementTrend = [];

    // Next assessment date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    const nextAssessmentDate = nextDate;

    // Skill gaps
    const skillGaps = skills
      .filter(skill => skill.proficiencyLevel < 3)
      .map(skill => ({
        name: skill.name,
        currentLevel: skill.proficiencyLevel,
        targetLevel: 3,
        gap: 3 - skill.proficiencyLevel,
        percentage: `+${(3 - skill.proficiencyLevel) * 20}% necessario`
      }));

    // Response
    const dashboardData = {
      success: true,
      employee: {
        id: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        email: employee.email,
        position: employee.position,
        department: employee.departments?.department_name || null,
        hireDate: employee.hire_date,
        yearsOfService: Math.round(yearsOfService * 10) / 10,
        seniority: `${finalSeniority} (${Math.round(yearsOfService * 10) / 10} anni)`
      },
      status: {
        currentProject: currentProject ? {
          name: currentProject.name,
          role: currentProject.role,
          description: currentProject.description
        } : null,
        role: currentRoleData ? {
          name: currentRoleData.sub_roles?.NameKnown_Sub_Role ||
                currentRoleData.sub_roles?.Sub_Role ||
                currentRoleData.roles?.NameKnown_Role ||
                currentRoleData.roles?.Role ||
                employee.position ||
                'Non assegnato',
          roleId: currentRoleData.role_id,
          subRoleId: currentRoleData.sub_role_id,
          anni_esperienza: currentRoleData.anni_esperienza
        } : {
          name: employee.position || 'Non assegnato',
          roleId: null,
          subRoleId: null,
          anni_esperienza: null
        },
        seniority: currentRoleData?.anni_esperienza
          ? `${finalSeniority} (${currentRoleData.anni_esperienza} anni nel ruolo)`
          : `${finalSeniority} (${Math.round(yearsOfService * 10) / 10} anni in azienda)`
      },
      skills: skills,
      skillGaps: skillGaps,
      engagementTrend: engagementTrend,
      activities: {
        nextAssessment: nextAssessmentDate,
        softSkillsAvailable: true
      }
    };

    res.json(dashboardData);

  } catch (error) {
    console.error('Error fetching personal dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

module.exports = router;
