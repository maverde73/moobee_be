/**
 * Advanced Matching Controller
 * @module controllers/project/matching
 * @created 2025-09-27 18:00
 *
 * Implements 4-factor matching algorithm:
 * - Skills Match (40%)
 * - Availability (30%)
 * - Experience (20%)
 * - Preferences (10%)
 */

const prisma = require('../../config/database');

const SENIORITY_MAP = {
  'JUNIOR': 1, 'Junior': 1,
  'MIDDLE': 2, 'Mid': 2, 'Mid-level': 2,
  'SENIOR': 3, 'Senior': 3,
  'LEAD': 4, 'Lead': 4,
  'PRINCIPAL': 5, 'Principal': 5
};

class MatchingController {
  /**
   * Run matching algorithm for a project role
   * POST /api/project-roles/:roleId/match
   */
  async runMatching(req, res) {
    try {
      const { roleId } = req.params;
      const { filters = {} } = req.body;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Get role with project details
      const role = await prisma.project_roles.findUnique({
        where: { id: roleId },
        include: {
          projects: true
        }
      });

      if (!role || role.projects.tenant_id !== tenantId) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      // Get available employees
      const employees = await this.getAvailableEmployees(
        tenantId,
        role.projects.start_date,
        role.projects.end_date,
        filters
      );

      if (employees.length === 0) {
        return res.json({
          success: true,
          data: {
            role_id: roleId,
            total_candidates: 0,
            qualified_matches: 0,
            top_matches: []
          },
          message: 'No available employees found'
        });
      }

      // Calculate match scores for all employees
      const matches = await Promise.all(
        employees.map(employee =>
          this.calculateMatchScore(employee, role)
        )
      );

      // Filter and sort matches
      const qualifiedMatches = matches
        .filter(m => m.match_score > 30) // Minimum threshold
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 20); // Top 20 candidates

      // Clear previous results
      await prisma.project_matching_results.deleteMany({
        where: { project_role_id: roleId }
      });

      // Save new matching results
      if (qualifiedMatches.length > 0) {
        await prisma.project_matching_results.createMany({
          data: qualifiedMatches.map(match => ({
            project_role_id: roleId,
            employee_id: match.employee_id,
            match_score: match.match_score,
            skills_match: match.skills_match,
            availability_match: match.availability_match,
            experience_match: match.experience_match,
            preference_match: match.preference_match,
            ai_reasoning: match.reasoning,
            suggested_allocation: match.suggested_allocation,
            risk_factors: match.risks,
            growth_potential: match.growth,
            is_shortlisted: match.match_score >= 70 // Auto-shortlist high matches
          }))
        });
      }

      // Log activity
      await prisma.project_activity_logs.create({
        data: {
          project_id: role.projects.id,
          activity_type: 'MATCHING_RUN',
          description: `Matching algorithm run for role: ${role.title}`,
          user_id: String(req.user.id),
          metadata: {
            role_id: roleId,
            candidates_evaluated: employees.length,
            qualified_matches: qualifiedMatches.length
          }
        }
      });

      // Return top matches with employee details
      const topMatches = await prisma.project_matching_results.findMany({
        where: { project_role_id: roleId },
        include: {
          employees: {
            include: {
              departments: true
            }
          }
        },
        orderBy: { match_score: 'desc' },
        take: 10
      });

      res.json({
        success: true,
        data: {
          role_id: roleId,
          total_candidates: employees.length,
          qualified_matches: qualifiedMatches.length,
          top_matches: topMatches
        }
      });

    } catch (error) {
      console.error('Error running matching:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run matching algorithm'
      });
    }
  }

  /**
   * Get available employees based on date range and filters
   */
  async getAvailableEmployees(tenantId, startDate, endDate, filters = {}) {
    const where = {
      tenant_id: tenantId,
      is_active: true
    };

    // Add filter conditions
    if (filters.department_id) {
      where.department_id = filters.department_id;
    }

    if (filters.min_experience) {
      // Would need to calculate from hire_date
    }

    // Get employees with their skills, roles, office, languages, and current assignments
    const employees = await prisma.employees.findMany({
      where,
      include: {
        employee_skills: {
          include: {
            skills: true
          }
        },
        employee_certifications: true,
        employee_soft_skills: {
          include: {
            soft_skills: true
          }
        },
        employee_roles: true,
        offices: true,
        employee_languages: {
          include: {
            languages: true
          }
        },
        project_assignments: {
          where: {
            OR: [
              {
                AND: [
                  { start_date: { lte: endDate || new Date('2100-01-01') } },
                  { end_date: { gte: startDate || new Date() } }
                ]
              }
            ],
            is_active: true
          }
        }
      }
    });

    // Calculate availability for each employee
    return employees.map(employee => {
      const totalAllocation = employee.project_assignments.reduce(
        (sum, assignment) => sum + (assignment.allocation_percentage || 0),
        0
      );

      return {
        ...employee,
        current_allocation: totalAllocation,
        available_allocation: 100 - totalAllocation
      };
    });
  }

  /**
   * Calculate match score for an employee-role pair
   */
  async calculateMatchScore(employee, role) {
    const scores = {
      skills_match: 0,
      availability_match: 0,
      experience_match: 0,
      preference_match: 0
    };

    // 1. Skills Match (40%)
    scores.skills_match = await this.calculateSkillsMatch(employee, role);

    // 2. Availability Match (30%)
    scores.availability_match = this.calculateAvailabilityMatch(employee, role);

    // 3. Experience Match (20%)
    scores.experience_match = this.calculateExperienceMatch(employee, role);

    // 4. Preference Match (10%)
    scores.preference_match = await this.calculatePreferenceMatch(employee, role);

    // Calculate total weighted score
    const totalScore = (
      scores.skills_match * 0.4 +
      scores.availability_match * 0.3 +
      scores.experience_match * 0.2 +
      scores.preference_match * 0.1
    );

    // Generate reasoning and recommendations
    const reasoning = this.generateMatchReasoning(scores, employee, role);
    const risks = this.identifyRisks(scores, employee, role);
    const growth = this.assessGrowthPotential(scores, employee, role);

    return {
      employee_id: employee.id,
      match_score: Math.round(totalScore),
      ...scores,
      reasoning,
      risks,
      growth,
      suggested_allocation: this.suggestAllocation(employee, role, scores)
    };
  }

  /**
   * Calculate skills match score
   * Uses proficiency-weighted scoring: each matched skill contributes
   * based on how proficient the employee is (proficiency_level 1-10).
   * An employee with all required skills at proficiency 10 scores 100.
   */
  async calculateSkillsMatch(employee, role) {
    let score = 0;

    // Check hard skills
    if (role.hard_skills && Array.isArray(role.hard_skills)) {
      const requiredSkillIds = role.hard_skills.map(s => s.id || s);
      const totalRequiredSkills = requiredSkillIds.length;

      if (totalRequiredSkills > 0 && employee.employee_skills) {
        // Build a map of employee skill_id → proficiency for fast lookup
        const employeeSkillMap = {};
        for (const es of employee.employee_skills) {
          employeeSkillMap[es.skill_id] = {
            proficiency: es.proficiency_level || 0,
            years: parseFloat(es.years_experience) || 0
          };
        }

        // Max possible score = totalRequiredSkills * 10 (max proficiency)
        const maxPossible = totalRequiredSkills * 10;
        let weightedSum = 0;

        for (const skillId of requiredSkillIds) {
          const empSkill = employeeSkillMap[skillId];
          if (empSkill) {
            // Proficiency contributes 70%, years experience bonus 30%
            // Years bonus: capped at 10 years → max 10 points
            const profScore = Math.min(empSkill.proficiency, 10);
            const yearsBonus = Math.min(empSkill.years, 10);
            weightedSum += profScore * 0.7 + yearsBonus * 0.3;
          }
          // Missing skill contributes 0
        }

        score = (weightedSum / maxPossible) * 100;
      }
    }

    // Check certifications if required
    if (role.required_certifications && role.required_certifications.length > 0) {
      const employeeCertNames = (employee.employee_certifications || [])
        .map(ec => (ec.certification_name || '').toLowerCase());
      const matchedCerts = role.required_certifications.filter(rc =>
        employeeCertNames.some(ecn => ecn.includes(rc.toLowerCase()))
      );
      const certBonus = role.required_certifications.length > 0
        ? (matchedCerts.length / role.required_certifications.length) * 100
        : 0;
      score = score * 0.85 + certBonus * 0.15;
    }

    // Bonus for soft skills
    if (role.soft_skills && employee.employee_soft_skills && employee.employee_soft_skills.length > 0) {
      const roleSoftSkillIds = Array.isArray(role.soft_skills)
        ? role.soft_skills.map(s => s.id || s)
        : [];
      if (roleSoftSkillIds.length > 0) {
        const matchedSoft = employee.employee_soft_skills.filter(ess =>
          roleSoftSkillIds.includes(ess.soft_skill_id)
        ).length;
        const softSkillBonus = Math.min(
          Math.round((matchedSoft / roleSoftSkillIds.length) * 20),
          20
        );
        score = Math.min(score + softSkillBonus, 100);
      }
    }

    return Math.round(score);
  }

  /**
   * Calculate availability match score
   */
  calculateAvailabilityMatch(employee, role) {
    const requiredAllocation = role.allocation_percentage || 100;
    const availableAllocation = employee.available_allocation || 100;

    if (availableAllocation >= requiredAllocation) {
      return 100;
    }

    // Linear scoring based on available vs required allocation
    return Math.round((availableAllocation / requiredAllocation) * 100);
  }

  /**
   * Calculate experience match score
   * Uses employee_roles.seniority from DB and average years_experience
   * from employee_skills for a more accurate assessment.
   */
  calculateExperienceMatch(employee, role) {
    let score = 20; // Base score (expanded range 20-100)

    // Calculate average years from employee_skills (more accurate than hire_date)
    let avgYears = 0;
    if (employee.employee_skills && employee.employee_skills.length > 0) {
      const totalYears = employee.employee_skills.reduce(
        (sum, es) => sum + (parseFloat(es.years_experience) || 0), 0
      );
      avgYears = totalYears / employee.employee_skills.length;
    }

    // Fallback to hire_date if no skill years data
    if (avgYears === 0) {
      avgYears = this.calculateYearsOfExperience(employee);
    }

    // Check years of experience against role requirements
    if (role.min_experience_years) {
      if (avgYears >= role.min_experience_years) {
        score += 25;
      } else {
        // Partial credit proportional to how close they are
        score += Math.round(25 * Math.min(avgYears / role.min_experience_years, 1));
      }

      if (role.preferred_experience_years &&
          avgYears >= role.preferred_experience_years) {
        score += 15;
      }
    }

    // Check seniority level match using DB seniority from employee_roles
    if (role.seniority) {
      const roleSeniority = SENIORITY_MAP[role.seniority] || 2;

      // Use seniority from employee_roles (DB) instead of recalculating from hire_date
      let employeeSeniority = 2; // default Mid
      const currentRole = employee.employee_roles?.find(r => r.is_current) || employee.employee_roles?.[0];
      if (currentRole?.seniority) {
        employeeSeniority = SENIORITY_MAP[currentRole.seniority] || 2;
      }

      if (employeeSeniority === roleSeniority) {
        score += 20; // Exact match
      } else if (employeeSeniority > roleSeniority) {
        score += 15; // Overqualified (still good but slight penalty)
      } else if (employeeSeniority === roleSeniority - 1) {
        score += 10; // Growth opportunity
      }
      // More than 1 level below: no bonus
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate preference match score
   * Checks work mode, location, and language against employee data.
   */
  async calculatePreferenceMatch(employee, role) {
    let score = 30; // Base score (expanded range 30-100)
    let factors = 0;
    let matched = 0;

    // Work mode preference
    if (role.work_mode) {
      factors++;
      if (role.work_mode === 'REMOTE') {
        matched++; // Remote open to everyone
      } else if (role.work_mode === 'ON_SITE' || role.work_mode === 'HYBRID') {
        // On-site/hybrid: employee must be in the same city
        if (role.location && employee.offices?.city &&
            role.location.toLowerCase().includes(employee.offices.city.toLowerCase())) {
          matched++;
        }
      }
    }

    // Location preference (separate from work_mode for additional granularity)
    if (role.location) {
      factors++;
      if (employee.offices && employee.offices.city &&
          role.location.toLowerCase().includes(employee.offices.city.toLowerCase())) {
        matched++;
      }
    }

    // Language requirements
    if (role.required_languages && role.required_languages.length > 0) {
      factors++;
      if (employee.employee_languages && employee.employee_languages.length > 0) {
        const empLangs = employee.employee_languages.map(l =>
          (l.languages?.name || '').toLowerCase()
        );
        const hasAll = role.required_languages.every(rl =>
          empLangs.some(el => el.includes(rl.toLowerCase()))
        );
        if (hasAll) matched++;
      }
    }

    // Scale bonus based on how many factors matched
    if (factors > 0) {
      score += Math.round((matched / factors) * 70);
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate years of experience for an employee
   */
  calculateYearsOfExperience(employee) {
    if (!employee.hire_date) return 0;

    const hireDate = new Date(employee.hire_date);
    const now = new Date();
    const years = (now - hireDate) / (365.25 * 24 * 60 * 60 * 1000);

    return Math.floor(years);
  }

  /**
   * Determine employee seniority level
   * Uses employee_roles.seniority from DB, falls back to hire_date calculation.
   */
  determineEmployeeSeniority(employee) {
    // Prefer DB seniority from employee_roles
    const currentRole = employee.employee_roles?.find(r => r.is_current) || employee.employee_roles?.[0];
    if (currentRole?.seniority && SENIORITY_MAP[currentRole.seniority] !== undefined) {
      return SENIORITY_MAP[currentRole.seniority];
    }

    // Fallback to hire_date calculation
    const years = this.calculateYearsOfExperience(employee);
    if (years < 2) return 1;
    if (years < 5) return 2;
    if (years < 8) return 3;
    if (years < 12) return 4;
    return 5;
  }

  /**
   * Generate match reasoning explanation
   */
  generateMatchReasoning(scores, employee, role) {
    const reasoning = {
      strengths: [],
      weaknesses: [],
      overall: ''
    };

    // Analyze strengths
    if (scores.skills_match >= 80) {
      reasoning.strengths.push('Excellent skills match');
    }
    if (scores.availability_match >= 90) {
      reasoning.strengths.push('High availability');
    }
    if (scores.experience_match >= 80) {
      reasoning.strengths.push('Strong experience level');
    }

    // Analyze weaknesses
    if (scores.skills_match < 50) {
      reasoning.weaknesses.push('Skills gap identified');
    }
    if (scores.availability_match < 50) {
      reasoning.weaknesses.push('Limited availability');
    }

    // Overall assessment (weighted average matching the algorithm weights)
    const avgScore = scores.skills_match * 0.4 + scores.availability_match * 0.3 +
                     scores.experience_match * 0.2 + scores.preference_match * 0.1;

    if (avgScore >= 80) {
      reasoning.overall = 'Excellent match - highly recommended';
    } else if (avgScore >= 60) {
      reasoning.overall = 'Good match - recommended with considerations';
    } else if (avgScore >= 40) {
      reasoning.overall = 'Partial match - development opportunity';
    } else {
      reasoning.overall = 'Limited match - significant gaps';
    }

    return reasoning;
  }

  /**
   * Identify risks for the match
   */
  identifyRisks(scores, employee, role) {
    const risks = [];

    if (scores.availability_match < 100) {
      risks.push({
        type: 'availability',
        level: scores.availability_match < 50 ? 'high' : 'medium',
        description: 'Employee may be overallocated'
      });
    }

    if (scores.skills_match < 70) {
      risks.push({
        type: 'skills',
        level: scores.skills_match < 40 ? 'high' : 'medium',
        description: 'Skills gap may require training'
      });
    }

    if (role.is_critical && scores.experience_match < 60) {
      risks.push({
        type: 'experience',
        level: 'high',
        description: 'Critical role requires more experience'
      });
    }

    return risks;
  }

  /**
   * Assess growth potential
   */
  assessGrowthPotential(scores, employee, role) {
    const growth = {
      skill_development: false,
      career_advancement: false,
      score: 0
    };

    // Skills growth opportunity
    if (scores.skills_match >= 60 && scores.skills_match < 90) {
      growth.skill_development = true;
      growth.score += 30;
    }

    // Career advancement opportunity
    const employeeSeniority = this.determineEmployeeSeniority(employee);
    const targetSeniority = SENIORITY_MAP[role.seniority] || 2;

    if (targetSeniority === employeeSeniority + 1) {
      growth.career_advancement = true;
      growth.score += 40;
    }

    return growth;
  }

  /**
   * Suggest allocation percentage
   */
  suggestAllocation(employee, role, scores) {
    const requiredAllocation = role.allocation_percentage || 100;
    const availableAllocation = employee.available_allocation || 100;

    if (availableAllocation >= requiredAllocation) {
      return requiredAllocation;
    }

    // If high match but limited availability, suggest partial
    if (scores.skills_match >= 80 && scores.experience_match >= 70) {
      return Math.min(availableAllocation, requiredAllocation);
    }

    return Math.min(availableAllocation, requiredAllocation * 0.75);
  }

  /**
   * Update shortlist status
   * PATCH /api/matching-results/:resultId/shortlist
   */
  async updateShortlist(req, res) {
    try {
      const { resultId } = req.params;
      const { is_shortlisted } = req.body;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Verify the result belongs to the user's tenant
      const existing = await prisma.project_matching_results.findUnique({
        where: { id: resultId },
        include: {
          project_roles: {
            include: { projects: true }
          }
        }
      });

      if (!existing || existing.project_roles.projects.tenant_id !== tenantId) {
        return res.status(404).json({
          success: false,
          error: 'Matching result not found'
        });
      }

      const updated = await prisma.project_matching_results.update({
        where: { id: resultId },
        data: {
          is_shortlisted,
          reviewed_by: String(req.user.id),
          reviewed_at: new Date()
        },
        include: {
          employees: true,
          project_roles: true
        }
      });

      res.json({
        success: true,
        data: updated
      });

    } catch (error) {
      console.error('Error updating shortlist:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update shortlist'
      });
    }
  }

  /**
   * Get matching results for a role
   * GET /api/project-roles/:roleId/matches
   */
  async getMatchingResults(req, res) {
    try {
      const { roleId } = req.params;
      const { shortlisted_only = false } = req.query;
      const tenantId = req.user.tenant_id || req.user.tenantId;

      // Verify the role belongs to the user's tenant
      const role = await prisma.project_roles.findUnique({
        where: { id: roleId },
        include: { projects: true }
      });

      if (!role || role.projects.tenant_id !== tenantId) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      const where = { project_role_id: roleId };

      if (shortlisted_only === 'true') {
        where.is_shortlisted = true;
      }

      const results = await prisma.project_matching_results.findMany({
        where,
        include: {
          employees: {
            include: {
              departments: true,
              employee_skills: {
                include: {
                  skills: true
                }
              }
            }
          }
        },
        orderBy: { match_score: 'desc' }
      });

      res.json({
        success: true,
        data: results,
        count: results.length
      });

    } catch (error) {
      console.error('Error fetching matching results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch matching results'
      });
    }
  }
}

module.exports = new MatchingController();