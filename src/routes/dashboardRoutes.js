const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateTenantUser } = require('../middlewares/unifiedAuth');

const prisma = new PrismaClient();

// Get personal dashboard data for the logged-in user
router.get('/personal', authenticateTenantUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const tenantId = req.user.tenant_id || req.user.tenantId; // Support both field names

    // Debug logging
    console.log('Dashboard request - User:', userEmail, 'Tenant:', tenantId);

    // Find the employee based on email
    const employee = await prisma.employees.findFirst({
      where: {
        email: userEmail,
        tenant_id: tenantId
      },
      include: {
        departments: true, // Fixed relation name
        // employee_skills: true, // This table might not exist, comment for now
        employee_roles: {
          where: {
            is_current: true
          }
        },
        // Temporarily comment out problematic relations
        // project_assignments: {
        //   where: {
        //     is_active: true
        //   },
        //   include: {
        //     projects: true
        //   }
        // },
        // assessments_assessments_employee_idToemployees: {
        //   orderBy: {
        //     assessment_date: 'desc'
        //   },
        //   take: 6
        // }
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    // Calculate seniority
    const hireDate = new Date(employee.hire_date);
    const now = new Date();
    const yearsOfService = (now - hireDate) / (365 * 24 * 60 * 60 * 1000);

    let seniority = 'Junior';
    if (yearsOfService >= 5) {
      seniority = 'Senior';
    } else if (yearsOfService >= 2) {
      seniority = 'Middle';
    }

    // Get current project (commented out since relation is disabled)
    const currentProject = null; // employee.project_assignments?.[0]?.projects;

    // Get current role
    const currentRole = employee.employee_roles?.[0];

    // Transform skills data
    // Map skill IDs to names (temporary mapping until we add skills relation)
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
      percentage: es.proficiency_level * 20 // Convert 1-5 to percentage
    })) : [];

    // Transform assessments for engagement trend (empty for now since relation is commented)
    const engagementTrend = [];
    // const engagementTrend = employee.assessments_assessments_employee_idToemployees?.map(assessment => ({
    //   date: assessment.assessment_date,
    //   score: assessment.overall_score,
    //   percentage: Math.round((assessment.overall_score / 5) * 100)
    // })) || [];

    // Calculate next assessment date (monthly)
    let nextAssessmentDate = null;
    // const lastAssessment = employee.assessments_assessments_employee_idToemployees?.[0];
    // if (lastAssessment) {
    //   const lastDate = new Date(lastAssessment.assessment_date);
    //   const nextDate = new Date(lastDate);
    //   nextDate.setMonth(nextDate.getMonth() + 1);
    //   nextAssessmentDate = nextDate;
    // } else {
      // If no assessment, suggest one for next week
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);
      nextAssessmentDate = nextDate;
    // }

    // Identify skill gaps (skills below level 3)
    const skillGaps = skills
      .filter(skill => skill.proficiencyLevel < 3)
      .map(skill => ({
        name: skill.name,
        currentLevel: skill.proficiencyLevel,
        targetLevel: 3,
        gap: 3 - skill.proficiencyLevel,
        percentage: `+${(3 - skill.proficiencyLevel) * 20}% necessario`
      }));

    // Response data
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
        seniority: `${seniority} (${Math.round(yearsOfService * 10) / 10} anni)`
      },
      status: {
        currentProject: currentProject ? {
          name: currentProject.project_name,
          status: currentProject.status,
          code: currentProject.project_code
        } : null,
        role: {
          name: employee.position,
          roleId: currentRole?.role_id || null,
          subRoleId: currentRole?.sub_role_id || null
        },
        seniority: `${seniority} (${Math.round(yearsOfService * 10) / 10} anni)`
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