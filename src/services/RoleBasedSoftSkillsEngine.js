/**
 * Role-Based Soft Skills Engine
 * Calcola soft skills pesati per ruolo specifico
 * @module services/RoleBasedSoftSkillsEngine
 */

const prisma = require('../config/database');

class RoleBasedSoftSkillsEngine {
  constructor() {
    this.PRIORITY_WEIGHTS = {
      1: 1.5,   // Critico per il ruolo
      2: 1.3,   // Molto importante
      3: 1.2,   // Importante
      4: 1.0,   // Rilevante
      5: 0.9,   // Utile
      6: 0.8,   // Complementare
      7: 0.7    // Secondario
    };

    this.SKILL_LEVELS = {
      EXPERT: { min: 80, label: 'Expert', color: '#10b981' },
      ADVANCED: { min: 60, label: 'Advanced', color: '#3b82f6' },
      INTERMEDIATE: { min: 40, label: 'Intermediate', color: '#f59e0b' },
      BASIC: { min: 0, label: 'Basic', color: '#ef4444' }
    };
  }

  /**
   * Calcola soft skills da risposte assessment con pesi per ruolo
   * @param {string} assessmentId - ID dell'assessment
   * @param {number} employeeId - ID del dipendente
   * @param {number} roleId - ID del ruolo
   * @param {Object} responses - Risposte all'assessment {questionId: value}
   * @returns {Object} Risultati calcolati con fit per ruolo
   */
  async calculateRoleBasedSkills(assessmentId, employeeId, roleId, responses) {
    try {
      console.log(`📊 Calcolo soft skills per ruolo ${roleId}, dipendente ${employeeId}`);

      // 1. Recupera i requisiti soft skills per il ruolo
      const roleSkills = await this.getRoleSkillRequirements(roleId);
      if (!roleSkills || roleSkills.length === 0) {
        throw new Error(`Nessun requisito soft skill trovato per il ruolo ${roleId}`);
      }

      // 2. Calcola i punteggi base dai modelli psicometrici
      const baseScores = await this.calculateBaseScores(assessmentId, responses);

      // 3. Applica i pesi basati sul ruolo
      const roleWeightedScores = this.applyRoleWeights(baseScores, roleSkills);

      // 4. Calcola il fit score complessivo per il ruolo
      const roleFitScore = this.calculateRoleFit(roleWeightedScores);

      // 5. Genera insights e raccomandazioni personalizzate
      const insights = await this.generateRoleInsights(roleWeightedScores, roleSkills, roleId);

      // 6. Salva i risultati nel database
      const savedResult = await this.saveResults(
        assessmentId,
        employeeId,
        roleId,
        roleWeightedScores,
        roleFitScore,
        insights
      );

      return {
        success: true,
        result: savedResult,
        scores: roleWeightedScores,
        roleFit: roleFitScore,
        insights: insights
      };

    } catch (error) {
      console.error('❌ Errore nel calcolo soft skills:', error);
      throw error;
    }
  }

  /**
   * Recupera i requisiti soft skills per un ruolo
   */
  async getRoleSkillRequirements(roleId) {
    const requirements = await prisma.roleSoftSkill.findMany({
      where: { roleId },
      include: { softSkill: true },
      orderBy: { priority: 'asc' }
    });

    return requirements.map(req => ({
      skillId: req.softSkillId,
      skillName: req.softSkill.name,
      priority: req.priority,
      weight: req.weight || this.PRIORITY_WEIGHTS[req.priority],
      isRequired: req.isRequired,
      minScore: req.minScore || (req.priority <= 3 ? 60 : 40),
      targetScore: req.targetScore || (req.priority <= 3 ? 80 : 60)
    }));
  }

  /**
   * Calcola punteggi base dalle risposte assessment
   */
  async calculateBaseScores(assessmentId, responses) {
    // Recupera le mappature domande-soft skills
    const questionIds = Object.keys(responses);
    const mappings = await prisma.questionSoftSkillMapping.findMany({
      where: { questionId: { in: questionIds } },
      include: { softSkill: true }
    });

    // Raggruppa per soft skill
    const skillScores = new Map();

    for (const [questionId, responseValue] of Object.entries(responses)) {
      const questionMappings = mappings.filter(m => m.questionId === questionId);

      for (const mapping of questionMappings) {
        const skillId = mapping.softSkillId;
        const skillName = mapping.softSkill.name;

        if (!skillScores.has(skillId)) {
          skillScores.set(skillId, {
            skillId,
            skillName,
            totalScore: 0,
            totalWeight: 0,
            responseCount: 0
          });
        }

        const skill = skillScores.get(skillId);

        // Normalizza il valore della risposta (assumendo scala 1-5)
        const normalizedValue = ((responseValue - 1) / 4) * 100;

        // Applica il peso del mapping
        const weightedScore = normalizedValue * mapping.weight;

        // Considera il tipo di mapping (positive/negative)
        const adjustedScore = mapping.mappingType === 'negative'
          ? 100 - weightedScore
          : weightedScore;

        skill.totalScore += adjustedScore;
        skill.totalWeight += mapping.weight;
        skill.responseCount++;
      }
    }

    // Calcola punteggi finali
    const baseScores = {};
    for (const [skillId, data] of skillScores) {
      if (data.totalWeight > 0) {
        baseScores[skillId] = {
          skillId: data.skillId,
          skillName: data.skillName,
          rawScore: Math.round(data.totalScore / data.totalWeight),
          confidence: this.calculateConfidence(data.responseCount, data.totalWeight),
          responseCount: data.responseCount
        };
      }
    }

    return baseScores;
  }

  /**
   * Applica pesi basati sui requisiti del ruolo
   */
  applyRoleWeights(baseScores, roleSkills) {
    const weightedScores = {};

    for (const roleSkill of roleSkills) {
      const baseScore = baseScores[roleSkill.skillId];

      if (baseScore) {
        const adjustedScore = baseScore.rawScore * roleSkill.weight;

        weightedScores[roleSkill.skillId] = {
          ...baseScore,
          priority: roleSkill.priority,
          weight: roleSkill.weight,
          weightedScore: Math.round(adjustedScore),
          isRequired: roleSkill.isRequired,
          minScore: roleSkill.minScore,
          targetScore: roleSkill.targetScore,
          gap: roleSkill.targetScore - baseScore.rawScore,
          meetsMinimum: baseScore.rawScore >= roleSkill.minScore,
          meetsTarget: baseScore.rawScore >= roleSkill.targetScore,
          level: this.getSkillLevel(baseScore.rawScore)
        };
      } else {
        // Skill richiesta ma non valutata
        weightedScores[roleSkill.skillId] = {
          skillId: roleSkill.skillId,
          skillName: roleSkill.skillName,
          rawScore: 0,
          weightedScore: 0,
          priority: roleSkill.priority,
          weight: roleSkill.weight,
          isRequired: roleSkill.isRequired,
          minScore: roleSkill.minScore,
          targetScore: roleSkill.targetScore,
          gap: roleSkill.targetScore,
          meetsMinimum: false,
          meetsTarget: false,
          level: this.getSkillLevel(0),
          noData: true
        };
      }
    }

    return weightedScores;
  }

  /**
   * Calcola fit complessivo per il ruolo
   */
  calculateRoleFit(weightedScores) {
    let totalScore = 0;
    let totalWeight = 0;
    let criticalSkillsFit = 0;
    let criticalSkillsCount = 0;

    for (const skillId in weightedScores) {
      const skill = weightedScores[skillId];

      if (skill.noData) continue;

      // Calcola score aggiustato con penalità se sotto il minimo
      let adjustedScore = skill.rawScore;
      if (skill.isRequired && !skill.meetsMinimum) {
        adjustedScore *= 0.7; // Penalità del 30% se non raggiunge il minimo
      }

      totalScore += adjustedScore * skill.weight;
      totalWeight += skill.weight;

      // Traccia le skills critiche (priorità 1-3)
      if (skill.priority <= 3) {
        criticalSkillsFit += adjustedScore;
        criticalSkillsCount++;
      }
    }

    const overallFit = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const criticalFit = criticalSkillsCount > 0
      ? Math.round(criticalSkillsFit / criticalSkillsCount)
      : 0;

    return {
      overall: overallFit,
      critical: criticalFit,
      level: this.getSkillLevel(overallFit),
      recommendation: this.getFitRecommendation(overallFit, criticalFit)
    };
  }

  /**
   * Genera insights personalizzati per il ruolo
   */
  async generateRoleInsights(scores, roleSkills, roleId) {
    // Identifica punti di forza (top 3 che superano il target)
    const strengths = Object.values(scores)
      .filter(s => !s.noData && s.meetsTarget)
      .sort((a, b) => {
        // Priorità prima per importanza del ruolo, poi per score
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.rawScore - a.rawScore;
      })
      .slice(0, 3)
      .map(s => ({
        skillId: s.skillId,
        skillName: s.skillName,
        score: s.rawScore,
        priority: s.priority,
        message: this.getStrengthMessage(s)
      }));

    // Identifica aree di sviluppo (bottom 3 prioritari sotto il target)
    const developmentAreas = Object.values(scores)
      .filter(s => !s.noData && !s.meetsTarget)
      .sort((a, b) => {
        // Priorità prima per importanza, poi per gap maggiore
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.gap - a.gap;
      })
      .slice(0, 3)
      .map(s => ({
        skillId: s.skillId,
        skillName: s.skillName,
        score: s.rawScore,
        priority: s.priority,
        gap: s.gap,
        message: this.getDevelopmentMessage(s)
      }));

    // Recupera il nome del ruolo (usando raw query perché roles ha @@ignore)
    const roles = await prisma.$queryRaw`
      SELECT "Role", "NameKnown_Role"
      FROM roles
      WHERE id = ${roleId}
      LIMIT 1
    `;
    const role = roles[0];

    const roleName = role?.Role || role?.NameKnown_Role || `Ruolo ${roleId}`;

    return {
      strengths,
      developmentAreas,
      overallAssessment: this.getOverallAssessment(scores, roleName),
      recommendations: this.generateRecommendations(developmentAreas, roleName)
    };
  }

  /**
   * Salva i risultati nel database
   */
  async saveResults(assessmentId, employeeId, roleId, scores, roleFit, insights) {
    // Salva risultati per ruolo
    const roleBasedResult = await prisma.roleBasedAssessmentResult.create({
      data: {
        assessmentResultId: assessmentId,
        employeeId,
        roleId,
        overallFitScore: roleFit.overall,
        strengths: insights.strengths,
        developmentAreas: insights.developmentAreas,
        recommendations: insights.recommendations
      }
    });

    // Salva score individuali per soft skill
    for (const skillId in scores) {
      const score = scores[skillId];
      if (!score.noData) {
        await prisma.assessmentSoftSkillScore.upsert({
          where: {
            assessmentId_employeeId_softSkillId: {
              assessmentId,
              employeeId,
              softSkillId: skillId
            }
          },
          update: {
            rawScore: score.rawScore,
            normalizedScore: score.weightedScore,
            percentile: await this.calculatePercentile(skillId, score.rawScore),
            level: score.level.label,
            confidence: score.confidence,
            scoreDetails: {
              priority: score.priority,
              weight: score.weight,
              gap: score.gap,
              meetsTarget: score.meetsTarget
            }
          },
          create: {
            assessmentId,
            employeeId,
            softSkillId: skillId,
            rawScore: score.rawScore,
            normalizedScore: score.weightedScore,
            percentile: await this.calculatePercentile(skillId, score.rawScore),
            level: score.level.label,
            confidence: score.confidence,
            scoreDetails: {
              priority: score.priority,
              weight: score.weight,
              gap: score.gap,
              meetsTarget: score.meetsTarget
            }
          }
        });
      }
    }

    return roleBasedResult;
  }

  // Helper methods

  calculateConfidence(responseCount, totalWeight) {
    const minResponses = 5;
    const optimalResponses = 15;

    const responseFactor = Math.min(responseCount / minResponses, 1.0);
    const weightFactor = Math.min(totalWeight / 3.0, 1.0);

    return Math.round((responseFactor * weightFactor) * 100) / 100;
  }

  getSkillLevel(score) {
    if (score >= 80) return this.SKILL_LEVELS.EXPERT;
    if (score >= 60) return this.SKILL_LEVELS.ADVANCED;
    if (score >= 40) return this.SKILL_LEVELS.INTERMEDIATE;
    return this.SKILL_LEVELS.BASIC;
  }

  getFitRecommendation(overallFit, criticalFit) {
    if (overallFit >= 80 && criticalFit >= 80) {
      return 'Eccellente fit per il ruolo. Competenze pienamente allineate.';
    } else if (overallFit >= 60 && criticalFit >= 60) {
      return 'Buon fit per il ruolo. Alcune aree di miglioramento identificate.';
    } else if (criticalFit < 50) {
      return 'Fit critico. Richiesto sviluppo significativo nelle competenze chiave.';
    } else {
      return 'Fit moderato. Piano di sviluppo raccomandato per colmare i gap.';
    }
  }

  getStrengthMessage(skill) {
    const messages = {
      1: `Competenza distintiva critica per il ruolo (Priorità ${skill.priority})`,
      2: `Punto di forza molto importante per il successo nel ruolo`,
      3: `Competenza ben sviluppata e importante per il ruolo`,
      default: `Competenza sopra la media che supporta le performance`
    };
    return messages[skill.priority] || messages.default;
  }

  getDevelopmentMessage(skill) {
    if (skill.isRequired && !skill.meetsMinimum) {
      return `⚠️ Competenza critica sotto il minimo richiesto (gap: ${Math.abs(skill.gap)} punti)`;
    } else if (skill.priority <= 3) {
      return `📈 Area di sviluppo prioritaria (gap: ${Math.abs(skill.gap)} punti)`;
    } else {
      return `💡 Opportunità di miglioramento (gap: ${Math.abs(skill.gap)} punti)`;
    }
  }

  getOverallAssessment(scores, roleName) {
    const totalSkills = Object.keys(scores).length;
    const meetsTarget = Object.values(scores).filter(s => !s.noData && s.meetsTarget).length;
    const meetsMinimum = Object.values(scores).filter(s => !s.noData && s.meetsMinimum).length;

    return {
      summary: `Valutazione per il ruolo di ${roleName}`,
      skillsCoverage: `${totalSkills} competenze valutate`,
      targetAchievement: `${meetsTarget}/${totalSkills} competenze al livello target`,
      minimumAchievement: `${meetsMinimum}/${totalSkills} competenze al livello minimo`,
      readiness: meetsMinimum === totalSkills ? 'Pronto per il ruolo' : 'Richiede sviluppo'
    };
  }

  generateRecommendations(developmentAreas, roleName) {
    const recommendations = [];

    if (developmentAreas.length === 0) {
      recommendations.push({
        type: 'success',
        title: 'Ottimo profilo',
        description: `Tutte le competenze richieste per ${roleName} sono al livello target.`,
        action: 'Considera opportunità di crescita avanzate o mentoring.'
      });
    } else {
      developmentAreas.forEach(area => {
        recommendations.push({
          type: 'development',
          title: `Sviluppare ${area.skillName}`,
          description: area.message,
          action: this.getTrainingRecommendation(area.skillName, area.gap)
        });
      });
    }

    return recommendations;
  }

  getTrainingRecommendation(skillName, gap) {
    const trainingMap = {
      'Comunicazione Efficace': 'Corso di public speaking e comunicazione assertiva',
      'Leadership': 'Programma di leadership development e coaching',
      'Lavoro di Squadra': 'Workshop di team building e collaborazione',
      'Problem Solving': 'Training di problem solving strutturato e pensiero analitico',
      'Gestione del Tempo': 'Corso di time management e prioritizzazione',
      'Empatia': 'Training di intelligenza emotiva e ascolto attivo',
      'Resilienza': 'Workshop di stress management e resilienza',
      'Pensiero Critico': 'Corso di analisi critica e decision making',
      'Capacità Decisionale': 'Training di decision making e valutazione rischi',
      'Ascolto Attivo': 'Workshop di comunicazione e ascolto empatico',
      'Intelligenza Emotiva': 'Programma di sviluppo dell\'intelligenza emotiva',
      'Flessibilità e Adattabilità': 'Training di change management e agilità'
    };

    return trainingMap[skillName] || 'Piano di sviluppo personalizzato consigliato';
  }

  async calculatePercentile(skillId, score) {
    // Calcola il percentile basato su tutti gli score esistenti per quella skill
    const allScores = await prisma.assessmentSoftSkillScore.findMany({
      where: { softSkillId: skillId },
      select: { normalizedScore: true }
    });

    if (allScores.length === 0) return 50;

    const sortedScores = allScores
      .map(s => s.normalizedScore)
      .sort((a, b) => a - b);

    const position = sortedScores.filter(s => s < score).length;
    return Math.round((position / sortedScores.length) * 100);
  }
}

module.exports = RoleBasedSoftSkillsEngine;