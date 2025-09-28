const SoftSkillService = require('../services/SoftSkillService');

class SoftSkillController {
  constructor() {
    this.service = new SoftSkillService();
  }

  // =============== SOFT SKILLS ===============

  async getAllSoftSkills(req, res) {
    try {
      const { category, isActive } = req.query;
      const softSkills = await this.service.getAllSoftSkills({ category, isActive });

      res.json({
        success: true,
        data: softSkills,
        count: softSkills.length
      });
    } catch (error) {
      console.error('Error fetching soft skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch soft skills'
      });
    }
  }

  async getSoftSkillById(req, res) {
    try {
      const { id } = req.params;
      const softSkill = await this.service.getSoftSkillById(id);

      if (!softSkill) {
        return res.status(404).json({
          success: false,
          error: 'Soft skill not found'
        });
      }

      res.json({
        success: true,
        data: softSkill
      });
    } catch (error) {
      console.error('Error fetching soft skill:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch soft skill'
      });
    }
  }

  async createSoftSkill(req, res) {
    try {
      const softSkill = await this.service.createSoftSkill(req.body);

      res.status(201).json({
        success: true,
        data: softSkill,
        message: 'Soft skill created successfully'
      });
    } catch (error) {
      console.error('Error creating soft skill:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create soft skill'
      });
    }
  }

  async updateSoftSkill(req, res) {
    try {
      const { id } = req.params;
      const softSkill = await this.service.updateSoftSkill(id, req.body);

      res.json({
        success: true,
        data: softSkill,
        message: 'Soft skill updated successfully'
      });
    } catch (error) {
      console.error('Error updating soft skill:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update soft skill'
      });
    }
  }

  // =============== ROLE MAPPINGS ===============

  async getSkillsForRole(req, res) {
    try {
      const { roleId } = req.params;
      const skills = await this.service.getSkillsForRole(parseInt(roleId));

      res.json({
        success: true,
        data: skills,
        count: skills.length
      });
    } catch (error) {
      console.error('Error fetching skills for role:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch skills for role'
      });
    }
  }

  async getRolesForSkill(req, res) {
    try {
      const { skillId } = req.params;
      const roles = await this.service.getRolesForSkill(skillId);

      res.json({
        success: true,
        data: roles,
        count: roles.length
      });
    } catch (error) {
      console.error('Error fetching roles for skill:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch roles for skill'
      });
    }
  }

  async mapRoleToSkill(req, res) {
    try {
      const { roleId, skillId } = req.params;
      const mapping = await this.service.mapRoleToSkill(
        parseInt(roleId),
        skillId,
        req.body
      );

      res.json({
        success: true,
        data: mapping,
        message: 'Role-skill mapping created/updated successfully'
      });
    } catch (error) {
      console.error('Error mapping role to skill:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to map role to skill'
      });
    }
  }

  // =============== SCORING ===============

  async calculateScores(req, res) {
    try {
      const { employeeId, assessmentId, responses } = req.body;

      if (!employeeId || !assessmentId || !responses) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: employeeId, assessmentId, responses'
        });
      }

      const scores = await this.service.calculateSoftSkillScores(
        employeeId,
        assessmentId,
        responses
      );

      res.json({
        success: true,
        data: scores,
        message: 'Scores calculated successfully'
      });
    } catch (error) {
      console.error('Error calculating scores:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate scores'
      });
    }
  }

  // =============== EMPLOYEE PROFILES ===============

  async getEmployeeProfile(req, res) {
    try {
      const { employeeId } = req.params;
      const profile = await this.service.getEmployeeSkillProfile(parseInt(employeeId));

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error fetching employee profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch employee profile'
      });
    }
  }

  // =============== TEAM ANALYSIS ===============

  async getTeamAnalysis(req, res) {
    try {
      const { employeeIds } = req.body;

      if (!employeeIds || !Array.isArray(employeeIds)) {
        return res.status(400).json({
          success: false,
          error: 'Employee IDs array is required'
        });
      }

      const analysis = await this.service.getTeamSkillAnalysis(employeeIds);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error analyzing team skills:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze team skills'
      });
    }
  }

  // =============== TENANT PROFILES ===============

  async getTenantProfiles(req, res) {
    try {
      const { tenantId } = req.user; // Assume tenant ID comes from authenticated user
      const profiles = await this.service.getTenantProfiles(tenantId);

      res.json({
        success: true,
        data: profiles,
        count: profiles.length
      });
    } catch (error) {
      console.error('Error fetching tenant profiles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tenant profiles'
      });
    }
  }

  async createTenantProfile(req, res) {
    try {
      const { tenantId } = req.user;
      const profile = await this.service.createTenantProfile(tenantId, req.body);

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Tenant profile created successfully'
      });
    } catch (error) {
      console.error('Error creating tenant profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create tenant profile'
      });
    }
  }

  async applyProfileToEmployee(req, res) {
    try {
      const { employeeId, profileId } = req.params;
      const result = await this.service.applyProfileToEmployee(
        parseInt(employeeId),
        profileId
      );

      res.json({
        success: true,
        data: result,
        message: 'Profile applied to employee successfully'
      });
    } catch (error) {
      console.error('Error applying profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply profile to employee'
      });
    }
  }

  // =============== REPORTS ===============

  async generateSkillReport(req, res) {
    try {
      const { employeeId } = req.params;
      const { format = 'json' } = req.query;

      const profile = await this.service.getEmployeeSkillProfile(parseInt(employeeId));

      // Group by category
      const categorized = {
        relational: [],
        collaborative: [],
        cognitive: [],
        adaptive: []
      };

      profile.forEach(skill => {
        if (categorized[skill.category]) {
          categorized[skill.category].push(skill);
        }
      });

      // Calculate aggregates
      const summary = {
        overall: profile.reduce((sum, s) => sum + s.score, 0) / profile.length,
        strengths: profile.filter(s => s.score >= 70).map(s => s.skill),
        improvements: profile.filter(s => s.score < 50).map(s => s.skill),
        byCategory: {}
      };

      Object.entries(categorized).forEach(([cat, skills]) => {
        if (skills.length > 0) {
          summary.byCategory[cat] = {
            average: skills.reduce((sum, s) => sum + s.score, 0) / skills.length,
            skills: skills.map(s => ({ name: s.skill, score: s.score, level: s.level }))
          };
        }
      });

      const report = {
        employeeId,
        generatedAt: new Date(),
        profile,
        summary,
        recommendations: this.generateRecommendations(profile)
      };

      if (format === 'pdf') {
        // TODO: Implement PDF generation
        return res.status(501).json({
          success: false,
          error: 'PDF generation not yet implemented'
        });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate skill report'
      });
    }
  }

  generateRecommendations(profile) {
    const recommendations = [];
    const weakSkills = profile.filter(s => s.score < 50);
    const strongSkills = profile.filter(s => s.score >= 70);

    // Priority improvements
    if (weakSkills.length > 0) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        skills: weakSkills.map(s => s.skill),
        suggestion: `Focus on developing ${weakSkills.slice(0, 3).map(s => s.skill).join(', ')} through targeted training and practice.`
      });
    }

    // Leverage strengths
    if (strongSkills.length > 0) {
      recommendations.push({
        type: 'leverage',
        priority: 'medium',
        skills: strongSkills.map(s => s.skill),
        suggestion: `Leverage your strengths in ${strongSkills.slice(0, 3).map(s => s.skill).join(', ')} to mentor others and take on challenging projects.`
      });
    }

    // Balance recommendations
    const categories = ['relational', 'collaborative', 'cognitive', 'adaptive'];
    categories.forEach(cat => {
      const catSkills = profile.filter(s => s.category === cat);
      const avgScore = catSkills.reduce((sum, s) => sum + s.score, 0) / catSkills.length;

      if (avgScore < 50) {
        recommendations.push({
          type: 'category',
          priority: 'medium',
          category: cat,
          suggestion: `Your ${cat} skills need attention. Consider workshops or coaching focused on ${cat} competencies.`
        });
      }
    });

    return recommendations;
  }
}

module.exports = SoftSkillController;