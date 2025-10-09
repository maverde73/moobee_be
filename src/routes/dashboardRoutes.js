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

    // Get current project from work experience (is_current = true)
    const currentWorkExperience = await prisma.employee_work_experiences.findFirst({
      where: {
        employee_id: employee.id,
        is_current: true
      },
      include: {
        companies: true
      },
      orderBy: {
        start_date: 'desc'
      }
    });

    const currentProject = currentWorkExperience ? {
      name: currentWorkExperience.companies?.name || currentWorkExperience.company_name || 'Progetto corrente',
      role: currentWorkExperience.job_title,
      description: currentWorkExperience.description
    } : null;

    // Get current roles (can be multiple)
    const currentRoles = await prisma.employee_roles.findMany({
      where: {
        employee_id: employee.id,
        is_current: true
      }
    });

    // Get role and sub_role names for all current roles
    let roleNames = [];
    let finalSeniority = seniority;

    for (const roleData of currentRoles) {
      let roleName = null;
      let subRoleName = null;

      if (roleData.role_id) {
        const role = await prisma.roles.findUnique({
          where: { id: roleData.role_id },
          select: {
            Role: true,
            NameKnown_Role: true
          }
        });
        roleName = role?.NameKnown_Role || role?.Role;
      }

      if (roleData.sub_role_id) {
        const subRole = await prisma.sub_roles.findUnique({
          where: { id: roleData.sub_role_id },
          select: {
            Sub_Role: true,
            NameKnown_Sub_Role: true
          }
        });
        subRoleName = subRole?.NameKnown_Sub_Role || subRole?.Sub_Role;
      }

      roleNames.push(subRoleName || roleName);

      // Get highest seniority from all roles
      if (roleData.anni_esperienza) {
        const roleYears = roleData.anni_esperienza;
        let roleSeniority = 'Junior';
        if (roleYears >= 5) {
          roleSeniority = 'Senior';
        } else if (roleYears >= 2) {
          roleSeniority = 'Middle';
        }

        // Use the highest seniority level
        const seniorityLevels = { 'Junior': 1, 'Middle': 2, 'Senior': 3 };
        if (seniorityLevels[roleSeniority] > seniorityLevels[finalSeniority]) {
          finalSeniority = roleSeniority;
        }
      }
    }

    // Use first current role for backward compatibility
    const currentRoleData = currentRoles[0] || null;

    // Get top skills grouped by role for radar charts
    const skillsByRole = [];
    const gradingThreshold = 0.85;
    const limit = 7;

    console.log('[Dashboard] Processing skills for', currentRoles.length, 'current roles');

    for (const roleData of currentRoles) {
      if (!roleData.sub_role_id) {
        console.log('[Dashboard] Skipping role without sub_role_id:', roleData.id);
        continue;
      }

      console.log('[Dashboard] Processing role:', roleData.id, 'sub_role_id:', roleData.sub_role_id);

      // Get role/sub-role names
      let roleName = null;
      let subRoleName = null;

      if (roleData.role_id) {
        const role = await prisma.roles.findUnique({
          where: { id: roleData.role_id },
          select: { Role: true, NameKnown_Role: true }
        });
        roleName = role?.NameKnown_Role || role?.Role;
      }

      if (roleData.sub_role_id) {
        const subRole = await prisma.sub_roles.findUnique({
          where: { id: roleData.sub_role_id },
          select: { Sub_Role: true, NameKnown_Sub_Role: true }
        });
        subRoleName = subRole?.NameKnown_Sub_Role || subRole?.Sub_Role;
      }

      // Get ALL employee skills with grading for this specific sub-role (using LEFT JOIN)
      // This allows us to show all skills with visual differentiation based on relevance
      const roleSkills = await prisma.$queryRaw`
        SELECT
          s.id as skill_id,
          s."NameKnown_Skill" as skill_name,
          es.proficiency_level,
          ssv."Grading",
          ssv."Value"
        FROM employee_skills es
        JOIN skills s ON es.skill_id = s.id
        LEFT JOIN skills_sub_roles_value ssv ON ssv.id_skill = es.skill_id
          AND ssv.id_sub_role = ${roleData.sub_role_id}
        WHERE es.employee_id = ${employee.id}
          AND es.proficiency_level > 0
        ORDER BY
          CASE
            WHEN ssv."Grading" IS NOT NULL THEN ssv."Grading"
            ELSE 0
          END DESC,
          es.proficiency_level DESC
      `;

      // Convert to array with relevance categorization
      const skillsArray = roleSkills.map(skill => {
        const grading = skill.Grading ? Number(skill.Grading) : null;
        let relevance = 'non-core'; // Default: skill not relevant to this role

        if (grading !== null) {
          if (grading >= gradingThreshold) {
            relevance = 'core'; // Highly relevant to this role
          } else if (grading >= 0.5) {
            relevance = 'secondary'; // Moderately relevant to this role
          } else {
            relevance = 'tertiary'; // Low relevance to this role
          }
        }

        return {
          skill_id: Number(skill.skill_id),
          skill_name: skill.skill_name,
          proficiency_level: skill.proficiency_level || 0,
          grading: grading,
          value: skill.Value ? Number(skill.Value) : null,
          relevance: relevance
        };
      });

      // Separate core skills from others
      const coreSkills = skillsArray.filter(s => s.relevance === 'core');
      const secondarySkills = skillsArray.filter(s => s.relevance === 'secondary');
      const otherSkills = skillsArray.filter(s => s.relevance === 'tertiary' || s.relevance === 'non-core');

      // Select skills to display (prioritize core, then secondary, then others)
      let selectedSkills = [];

      // Always include all core skills (up to limit)
      if (coreSkills.length >= limit) {
        selectedSkills = coreSkills.slice(0, limit);
      } else {
        selectedSkills = [...coreSkills];
        const remaining = limit - coreSkills.length;

        // Add secondary skills if space available
        if (secondarySkills.length > 0 && remaining > 0) {
          selectedSkills = [...selectedSkills, ...secondarySkills.slice(0, remaining)];
        }

        // Add other skills if still space available
        const stillRemaining = limit - selectedSkills.length;
        if (otherSkills.length > 0 && stillRemaining > 0) {
          selectedSkills = [...selectedSkills, ...otherSkills.slice(0, stillRemaining)];
        }
      }

      skillsByRole.push({
        roleId: roleData.role_id,
        subRoleId: roleData.sub_role_id,
        roleName: roleName,
        subRoleName: subRoleName,
        displayName: subRoleName || roleName || 'Non assegnato',
        skills: selectedSkills
      });

      console.log('[Dashboard] Added role to skillsByRole:', {
        displayName: subRoleName || roleName,
        totalSkills: skillsArray.length,
        coreSkills: coreSkills.length,
        secondarySkills: secondarySkills.length,
        otherSkills: otherSkills.length,
        selectedCount: selectedSkills.length
      });
    }

    console.log('[Dashboard] Final skillsByRole count:', skillsByRole.length);

    // Transform skills data (legacy, for backward compatibility)
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
        roles: currentRoles.length > 0 ? currentRoles.map((role, index) => ({
          name: roleNames[index] || employee.position || 'Non assegnato',
          roleId: role.role_id,
          subRoleId: role.sub_role_id,
          anni_esperienza: role.anni_esperienza
        })) : [{
          name: employee.position || 'Non assegnato',
          roleId: null,
          subRoleId: null,
          anni_esperienza: null
        }],
        // Keep legacy single role for backward compatibility
        role: currentRoleData ? {
          name: roleNames[0] || employee.position || 'Non assegnato',
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
      skillsByRole: skillsByRole, // NEW: Skills grouped by role with grading
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
