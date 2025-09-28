const { PrismaClient } = require('@prisma/client');

class SoftSkillService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  // =============== SOFT SKILLS CRUD ===============

  async getAllSoftSkills(filters = {}) {
    const { isActive = true, category } = filters;

    const where = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (category) where.category = category;

    return await this.prisma.softSkill.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            roleSkills: true,
            assessmentScores: true
          }
        }
      }
    });
  }

  async getSoftSkillById(id) {
    return await this.prisma.softSkill.findUnique({
      where: { id },
      include: {
        roleSkills: {
          orderBy: { priority: 'asc' }
        },
        assessmentScores: {
          take: 10,
          orderBy: { calculatedAt: 'desc' }
        }
      }
    });
  }

  async createSoftSkill(data) {
    const { code, name, nameEn, category, description, descriptionEn, orderIndex } = data;

    return await this.prisma.softSkill.create({
      data: {
        code,
        name,
        nameEn,
        category,
        description,
        descriptionEn,
        orderIndex,
        evaluationCriteria: data.evaluationCriteria || {}
      }
    });
  }

  async updateSoftSkill(id, data) {
    return await this.prisma.softSkill.update({
      where: { id },
      data
    });
  }

  // =============== ROLE-SKILL MAPPING ===============

  async getSkillsForRole(roleId) {
    return await this.prisma.roleSoftSkill.findMany({
      where: { roleId },
      include: {
        softSkill: true
      },
      orderBy: { priority: 'asc' }
    });
  }

  async getRolesForSkill(softSkillId) {
    return await this.prisma.roleSoftSkill.findMany({
      where: { softSkillId },
      include: {
        softSkill: true
      },
      orderBy: { weight: 'desc' }
    });
  }

  async mapRoleToSkill(roleId, softSkillId, data = {}) {
    const { priority = 1, weight = 1.0, isRequired = false, minScore = null } = data;

    return await this.prisma.roleSoftSkill.upsert({
      where: {
        roleId_softSkillId: {
          roleId,
          softSkillId
        }
      },
      update: {
        priority,
        weight,
        isRequired,
        minScore
      },
      create: {
        roleId,
        softSkillId,
        priority,
        weight,
        isRequired,
        minScore
      }
    });
  }

  // =============== SCORING & CALCULATION ===============

  async calculateSoftSkillScores(employeeId, assessmentId, responses) {
    const scores = [];

    // Get all soft skills
    const softSkills = await this.getAllSoftSkills();

    for (const skill of softSkills) {
      const score = await this.calculateSingleSkillScore(skill, responses);

      // Save the score
      const savedScore = await this.prisma.assessmentSoftSkillScore.create({
        data: {
          assessmentId,
          employeeId,
          softSkillId: skill.id,
          rawScore: score.raw,
          normalizedScore: score.normalized,
          percentile: score.percentile,
          level: this.getSkillLevel(score.normalized),
          confidence: score.confidence,
          scoreDetails: score.details
        }
      });

      scores.push(savedScore);
    }

    // Update employee's last assessment date
    await this.prisma.employees.update({
      where: { id: employeeId },
      data: { lastAssessmentDate: new Date() }
    });

    return scores;
  }

  async calculateSingleSkillScore(skill, responses) {
    // This is a simplified scoring algorithm
    // In production, this would use the correlation matrix from the document

    const { bigFiveResponses = {}, discResponses = {}, belbinResponses = {} } = responses;

    let weightedSum = 0;
    let totalWeight = 0;

    // Big Five contribution (35%)
    if (bigFiveResponses && Object.keys(bigFiveResponses).length > 0) {
      const bigFiveScore = this.calculateBigFiveContribution(skill.code, bigFiveResponses);
      weightedSum += bigFiveScore * 0.35;
      totalWeight += 0.35;
    }

    // DiSC contribution (35%)
    if (discResponses && Object.keys(discResponses).length > 0) {
      const discScore = this.calculateDiscContribution(skill.code, discResponses);
      weightedSum += discScore * 0.35;
      totalWeight += 0.35;
    }

    // Belbin contribution (30%)
    if (belbinResponses && Object.keys(belbinResponses).length > 0) {
      const belbinScore = this.calculateBelbinContribution(skill.code, belbinResponses);
      weightedSum += belbinScore * 0.30;
      totalWeight += 0.30;
    }

    const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 50; // Default to 50 if no data
    const normalized = this.normalizeScore(rawScore);

    return {
      raw: rawScore,
      normalized,
      percentile: await this.calculatePercentile(skill.id, normalized),
      confidence: totalWeight, // Confidence based on how many models contributed
      details: {
        bigFive: bigFiveResponses ? weightedSum * 0.35 : null,
        disc: discResponses ? weightedSum * 0.35 : null,
        belbin: belbinResponses ? weightedSum * 0.30 : null
      }
    };
  }

  // Correlation mappings (simplified version)
  calculateBigFiveContribution(skillCode, responses) {
    const correlations = {
      'communication_effective': { extraversion: 0.7, agreeableness: 0.3 },
      'active_listening': { agreeableness: 0.6, extraversion: -0.2 },
      'empathy': { agreeableness: 0.8, openness: 0.2 },
      'emotional_intelligence': { neuroticism: -0.5, agreeableness: 0.5 },
      'teamwork': { agreeableness: 0.7, extraversion: 0.3 },
      'leadership': { extraversion: 0.6, conscientiousness: 0.4 },
      'critical_thinking': { openness: 0.7, conscientiousness: 0.3 },
      'problem_solving': { openness: 0.6, conscientiousness: 0.4 },
      'flexibility': { openness: 0.8, neuroticism: -0.2 },
      'time_management': { conscientiousness: 0.9, neuroticism: -0.1 },
      'decision_making': { conscientiousness: 0.5, extraversion: 0.5 },
      'resilience': { neuroticism: -0.8, conscientiousness: 0.2 }
    };

    const skillCorrelations = correlations[skillCode] || {};
    let score = 50; // Base score

    for (const [trait, weight] of Object.entries(skillCorrelations)) {
      const traitScore = responses[trait] || 50;
      score += (traitScore - 50) * weight;
    }

    return Math.max(0, Math.min(100, score));
  }

  calculateDiscContribution(skillCode, responses) {
    const correlations = {
      'communication_effective': { I: 0.8, S: 0.2 },
      'active_listening': { S: 0.7, C: 0.3 },
      'empathy': { S: 0.8, I: 0.2 },
      'emotional_intelligence': { S: 0.5, I: 0.5 },
      'teamwork': { S: 0.6, I: 0.4 },
      'leadership': { D: 0.7, I: 0.3 },
      'critical_thinking': { C: 0.8, D: 0.2 },
      'problem_solving': { D: 0.6, C: 0.4 },
      'flexibility': { I: 0.6, S: 0.4 },
      'time_management': { C: 0.7, D: 0.3 },
      'decision_making': { D: 0.9, C: 0.1 },
      'resilience': { D: 0.5, S: 0.5 }
    };

    const skillCorrelations = correlations[skillCode] || {};
    let score = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of Object.entries(skillCorrelations)) {
      const dimensionScore = responses[dimension] || 0;
      score += dimensionScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? score / totalWeight : 50;
  }

  calculateBelbinContribution(skillCode, responses) {
    const correlations = {
      'communication_effective': { resource_investigator: 0.6, coordinator: 0.4 },
      'active_listening': { team_worker: 0.8, coordinator: 0.2 },
      'empathy': { team_worker: 0.9, coordinator: 0.1 },
      'emotional_intelligence': { coordinator: 0.6, team_worker: 0.4 },
      'teamwork': { team_worker: 0.7, coordinator: 0.3 },
      'leadership': { coordinator: 0.5, shaper: 0.5 },
      'critical_thinking': { monitor_evaluator: 0.8, plant: 0.2 },
      'problem_solving': { plant: 0.6, implementer: 0.4 },
      'flexibility': { resource_investigator: 0.7, plant: 0.3 },
      'time_management': { completer_finisher: 0.7, implementer: 0.3 },
      'decision_making': { shaper: 0.7, coordinator: 0.3 },
      'resilience': { shaper: 0.6, completer_finisher: 0.4 }
    };

    const skillCorrelations = correlations[skillCode] || {};
    let score = 0;
    let totalWeight = 0;

    for (const [role, weight] of Object.entries(skillCorrelations)) {
      const roleScore = responses[role] || 0;
      score += roleScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? score / totalWeight : 50;
  }

  normalizeScore(rawScore) {
    // Simple normalization to 0-100 scale
    return Math.max(0, Math.min(100, rawScore));
  }

  async calculatePercentile(softSkillId, score) {
    // Get all scores for this skill
    const allScores = await this.prisma.assessmentSoftSkillScore.findMany({
      where: { softSkillId },
      select: { normalizedScore: true }
    });

    if (allScores.length === 0) return 50;

    const scoresBelow = allScores.filter(s => s.normalizedScore < score).length;
    return Math.round((scoresBelow / allScores.length) * 100);
  }

  getSkillLevel(score) {
    if (score >= 80) return 'expert';
    if (score >= 60) return 'advanced';
    if (score >= 40) return 'intermediate';
    return 'beginner';
  }

  // =============== ANALYTICS ===============

  async getEmployeeSkillProfile(employeeId) {
    const latestScores = await this.prisma.assessmentSoftSkillScore.findMany({
      where: { employeeId },
      orderBy: { calculatedAt: 'desc' },
      distinct: ['softSkillId'],
      include: {
        softSkill: true
      }
    });

    return latestScores.map(score => ({
      skill: score.softSkill.name,
      code: score.softSkill.code,
      category: score.softSkill.category,
      score: score.normalizedScore,
      level: score.level,
      percentile: score.percentile
    }));
  }

  async getTeamSkillAnalysis(employeeIds) {
    const profiles = await Promise.all(
      employeeIds.map(id => this.getEmployeeSkillProfile(id))
    );

    // Aggregate team scores
    const skillAggregates = {};

    profiles.forEach(profile => {
      profile.forEach(skill => {
        if (!skillAggregates[skill.code]) {
          skillAggregates[skill.code] = {
            name: skill.skill,
            category: skill.category,
            scores: [],
            total: 0
          };
        }
        skillAggregates[skill.code].scores.push(skill.score);
        skillAggregates[skill.code].total += skill.score;
      });
    });

    // Calculate averages and identify gaps
    const teamProfile = Object.values(skillAggregates).map(skill => ({
      skill: skill.name,
      category: skill.category,
      avgScore: skill.total / skill.scores.length,
      minScore: Math.min(...skill.scores),
      maxScore: Math.max(...skill.scores),
      variance: this.calculateVariance(skill.scores)
    }));

    return {
      teamProfile,
      strengths: teamProfile.filter(s => s.avgScore >= 70).sort((a, b) => b.avgScore - a.avgScore),
      weaknesses: teamProfile.filter(s => s.avgScore < 50).sort((a, b) => a.avgScore - b.avgScore),
      gaps: teamProfile.filter(s => s.variance > 20) // High variance indicates unbalanced skills
    };
  }

  calculateVariance(scores) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / scores.length);
  }

  // =============== TENANT PROFILES ===============

  async getTenantProfiles(tenantId) {
    return await this.prisma.tenantSoftSkillProfile.findMany({
      where: { tenantId, isActive: true },
      orderBy: { isDefault: 'desc' }
    });
  }

  async createTenantProfile(tenantId, data) {
    const { profileName, description, roleIds, softSkillIds, weights, isDefault } = data;

    // If setting as default, unset other defaults
    if (isDefault) {
      await this.prisma.tenantSoftSkillProfile.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false }
      });
    }

    return await this.prisma.tenantSoftSkillProfile.create({
      data: {
        tenantId,
        profileName,
        description,
        roleIds: roleIds || [],
        softSkillIds,
        weights: weights || {},
        isDefault: isDefault || false
      }
    });
  }

  async applyProfileToEmployee(employeeId, profileId) {
    const profile = await this.prisma.tenantSoftSkillProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Update employee's assessment requirements based on profile
    return await this.prisma.employees.update({
      where: { id: employeeId },
      data: {
        nextAssessmentDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
      }
    });
  }
}

module.exports = SoftSkillService;