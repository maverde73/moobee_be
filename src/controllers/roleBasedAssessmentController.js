/**
 * Role-Based Assessment Controller
 * Gestisce le API per assessment basati su ruolo e soft skills
 * @module controllers/roleBasedAssessmentController
 */

const prisma = require('../config/database');
const RoleBasedSoftSkillsEngine = require('../services/RoleBasedSoftSkillsEngine');
const logger = require('../utils/logger');
const engine = new RoleBasedSoftSkillsEngine();

/**
 * GET /api/assessments/roles/:roleId/templates
 * Ottieni template assessment raccomandati per ruolo
 */
const getRecommendedTemplatesForRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Verifica che il ruolo esista (usando raw query perché roles ha @@ignore)
    const roles = await prisma.$queryRaw`
      SELECT id, "Role", "NameKnown_Role"
      FROM roles
      WHERE id = ${parseInt(roleId)}
      LIMIT 1
    `;
    const role = roles[0];

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Ruolo non trovato'
      });
    }

    // Recupera template raccomandati per il ruolo
    const recommendedTemplates = await prisma.assessmentTemplateRole.findMany({
      where: {
        roleId: parseInt(roleId),
        isRecommended: true
      },
      include: {
        template: {
          include: {
            questions: {
              take: 3, // Solo prime 3 domande per preview
              select: {
                id: true,
                text: true,
                category: true
              }
            }
          }
        }
      }
    });

    // Se non ci sono template specifici, suggerisci i più comuni
    let templates = recommendedTemplates.map(rt => ({
      ...rt.template,
      frequency: rt.frequency,
      isRecommended: true
    }));

    if (templates.length === 0) {
      // Recupera template generici più usati
      const genericTemplates = await prisma.assessmentTemplate.findMany({
        where: {
          isActive: true,
          isPublic: true
        },
        take: 5,
        orderBy: {
          usageCount: 'desc'
        },
        include: {
          questions: {
            take: 3,
            select: {
              id: true,
              text: true,
              category: true
            }
          }
        }
      });

      templates = genericTemplates.map(t => ({
        ...t,
        frequency: 'quarterly',
        isRecommended: false
      }));
    }

    res.json({
      success: true,
      roleId: parseInt(roleId),
      roleName: role.Role || role.NameKnown_Role,
      templates: templates,
      count: templates.length
    });

  } catch (error) {
    logger.error('Errore nel recupero template per ruolo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

/**
 * POST /api/assessments/:id/calculate-role-fit
 * Calcola fit per ruolo dopo completamento assessment
 */
const calculateRoleFit = async (req, res) => {
  try {
    const { id: assessmentId } = req.params;
    const { employeeId, roleId, responses } = req.body;

    // Validazione input
    if (!employeeId || !roleId || !responses) {
      return res.status(400).json({
        success: false,
        error: 'Parametri mancanti: employeeId, roleId e responses sono richiesti'
      });
    }

    // Verifica che l'assessment esista
    const assessment = await prisma.assessmentTemplate.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: 'Assessment non trovato'
      });
    }

    // Calcola soft skills con engine
    const result = await engine.calculateRoleBasedSkills(
      assessmentId,
      parseInt(employeeId),
      parseInt(roleId),
      responses
    );

    // Aggiorna contatore utilizzo template
    await prisma.assessmentTemplate.update({
      where: { id: assessmentId },
      data: {
        usageCount: { increment: 1 }
      }
    });

    // Aggiorna data ultimo assessment per il dipendente
    await prisma.employees.update({
      where: { id: parseInt(employeeId) },
      data: {
        lastAssessmentDate: new Date()
      }
    });

    res.json({
      success: true,
      assessmentId,
      employeeId: parseInt(employeeId),
      roleId: parseInt(roleId),
      result: result
    });

  } catch (error) {
    logger.error('Errore nel calcolo role fit:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore nel calcolo del fit per ruolo'
    });
  }
};

/**
 * GET /api/employees/:id/role-skills-assessment
 * Ottieni valutazione skills per ruolo corrente del dipendente
 */
const getEmployeeRoleSkillsAssessment = async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const { roleId } = req.query;

    // Recupera dipendente con ruolo corrente
    const employee = await prisma.employees.findUnique({
      where: { id: parseInt(employeeId) },
      include: {
        employee_roles: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Dipendente non trovato'
      });
    }

    // Determina il ruolo da valutare
    const targetRoleId = roleId
      ? parseInt(roleId)
      : employee.currentRoleId || employee.employee_roles[0]?.role_id;

    if (!targetRoleId) {
      return res.status(400).json({
        success: false,
        error: 'Nessun ruolo specificato o assegnato al dipendente'
      });
    }

    // Recupera ultimi risultati assessment per il ruolo
    const latestResults = await prisma.roleBasedAssessmentResult.findFirst({
      where: {
        employeeId: parseInt(employeeId),
        roleId: targetRoleId
      },
      orderBy: {
        calculatedAt: 'desc'
      }
    });

    // Recupera scores soft skills
    const softSkillScores = await prisma.assessmentSoftSkillScore.findMany({
      where: {
        employeeId: parseInt(employeeId)
      },
      include: {
        softSkill: true
      },
      orderBy: {
        calculatedAt: 'desc'
      },
      distinct: ['softSkillId']
    });

    // Recupera requisiti del ruolo
    const roleRequirements = await prisma.roleSoftSkill.findMany({
      where: { roleId: targetRoleId },
      include: { softSkill: true },
      orderBy: { priority: 'asc' }
    });

    // Calcola gap analysis
    const gapAnalysis = roleRequirements.map(req => {
      const score = softSkillScores.find(s => s.softSkillId === req.softSkillId);
      const currentScore = score ? score.normalizedScore : 0;
      const gap = (req.targetScore || 70) - currentScore;

      return {
        skillId: req.softSkillId,
        skillName: req.softSkill.name,
        priority: req.priority,
        currentScore,
        targetScore: req.targetScore || 70,
        minScore: req.minScore || 50,
        gap,
        status: gap <= 0 ? 'achieved' : gap <= 10 ? 'close' : 'needsWork',
        lastAssessed: score?.calculatedAt
      };
    });

    // Recupera nome ruolo se presente
    let roleName = 'N/A';
    if (targetRoleId) {
      const roles = await prisma.$queryRaw`
        SELECT "Role", "NameKnown_Role"
        FROM roles
        WHERE id = ${targetRoleId}
        LIMIT 1
      `;
      if (roles[0]) {
        roleName = roles[0].Role || roles[0].NameKnown_Role;
      }
    }

    res.json({
      success: true,
      employeeId: parseInt(employeeId),
      employeeName: `${employee.first_name} ${employee.last_name}`,
      roleId: targetRoleId,
      roleName,
      lastAssessment: latestResults?.calculatedAt,
      overallFitScore: latestResults?.overallFitScore || null,
      strengths: latestResults?.strengths || [],
      developmentAreas: latestResults?.developmentAreas || [],
      recommendations: latestResults?.recommendations || [],
      gapAnalysis,
      softSkillScores: softSkillScores.map(s => ({
        skillId: s.softSkillId,
        skillName: s.softSkill.name,
        score: s.normalizedScore,
        level: s.level,
        percentile: s.percentile,
        confidence: s.confidence,
        lastUpdated: s.calculatedAt
      }))
    });

  } catch (error) {
    logger.error('Errore nel recupero assessment dipendente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

/**
 * GET /api/roles/:roleId/skill-requirements
 * Ottieni requisiti soft skills per ruolo
 */
const getRoleSkillRequirements = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { includeDescriptions } = req.query;

    // Verifica che il ruolo esista (usando raw query perché roles ha @@ignore)
    const roles = await prisma.$queryRaw`
      SELECT id, "Role", "NameKnown_Role"
      FROM roles
      WHERE id = ${parseInt(roleId)}
      LIMIT 1
    `;
    const role = roles[0];

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Ruolo non trovato'
      });
    }

    // Recupera requisiti soft skills
    const requirements = await prisma.roleSoftSkill.findMany({
      where: { roleId: parseInt(roleId) },
      include: {
        softSkill: true
      },
      orderBy: { priority: 'asc' }
    });

    // Formatta la risposta
    const formattedRequirements = requirements.map(req => ({
      skillId: req.softSkillId,
      skillName: req.softSkill.name,
      skillNameEn: req.softSkill.nameEn,
      category: req.softSkill.category,
      priority: req.priority,
      weight: req.weight,
      isRequired: req.isRequired,
      minScore: req.minScore || (req.priority <= 3 ? 60 : 40),
      targetScore: req.targetScore || (req.priority <= 3 ? 80 : 60),
      description: req.softSkill.description,
      evaluationCriteria: req.softSkill.evaluationCriteria
    }));

    // Raggruppa per priorità
    const byPriority = {
      critical: formattedRequirements.filter(r => r.priority <= 2),
      important: formattedRequirements.filter(r => r.priority >= 3 && r.priority <= 4),
      supportive: formattedRequirements.filter(r => r.priority >= 5)
    };

    res.json({
      success: true,
      roleId: parseInt(roleId),
      roleName: role.Role || role.NameKnown_Role,
      totalRequirements: requirements.length,
      requirements: formattedRequirements,
      byPriority,
      summary: {
        criticalSkills: byPriority.critical.length,
        importantSkills: byPriority.important.length,
        supportiveSkills: byPriority.supportive.length
      }
    });

  } catch (error) {
    logger.error('Errore nel recupero requisiti ruolo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

/**
 * GET /api/soft-skills/dashboard/:employeeId
 * Dashboard completa soft skills per dipendente
 */
const getSoftSkillsDashboard = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { compareWithRole, timeRange = '6m' } = req.query;

    // Recupera dipendente
    const employee = await prisma.employees.findUnique({
      where: { id: parseInt(employeeId) },
      include: {
        employee_roles: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Dipendente non trovato'
      });
    }

    // Recupera tutti gli scores soft skills
    const allScores = await prisma.assessmentSoftSkillScore.findMany({
      where: {
        employeeId: parseInt(employeeId)
      },
      include: {
        softSkill: true
      },
      orderBy: {
        calculatedAt: 'desc'
      }
    });

    // Raggruppa per skill e prendi l'ultimo score
    const latestScoresBySkill = {};
    const scoreHistory = {};

    allScores.forEach(score => {
      const skillId = score.softSkillId;

      // Traccia ultimo score
      if (!latestScoresBySkill[skillId]) {
        latestScoresBySkill[skillId] = score;
      }

      // Traccia storia
      if (!scoreHistory[skillId]) {
        scoreHistory[skillId] = [];
      }
      scoreHistory[skillId].push({
        date: score.calculatedAt,
        score: score.normalizedScore,
        level: score.level
      });
    });

    // Calcola trends
    const trends = Object.keys(scoreHistory).map(skillId => {
      const history = scoreHistory[skillId];
      if (history.length < 2) return null;

      const latest = history[0].score;
      const previous = history[1].score;
      const change = latest - previous;

      return {
        skillId,
        skillName: latestScoresBySkill[skillId].softSkill.name,
        trend: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
        changePercent: Math.round((change / previous) * 100)
      };
    }).filter(Boolean);

    // Confronto con requisiti ruolo se richiesto
    let roleComparison = null;
    if (compareWithRole) {
      const roleId = parseInt(compareWithRole);
      const roleRequirements = await prisma.roleSoftSkill.findMany({
        where: { roleId },
        include: { softSkill: true }
      });

      roleComparison = roleRequirements.map(req => {
        const currentScore = latestScoresBySkill[req.softSkillId];
        return {
          skillName: req.softSkill.name,
          required: req.targetScore || 70,
          current: currentScore ? currentScore.normalizedScore : 0,
          gap: (req.targetScore || 70) - (currentScore ? currentScore.normalizedScore : 0),
          priority: req.priority
        };
      });
    }

    // Top skills e areas di sviluppo
    const sortedSkills = Object.values(latestScoresBySkill)
      .sort((a, b) => b.normalizedScore - a.normalizedScore);

    const topSkills = sortedSkills.slice(0, 3).map(s => ({
      name: s.softSkill.name,
      score: s.normalizedScore,
      level: s.level,
      percentile: s.percentile
    }));

    const developmentAreas = sortedSkills.slice(-3).map(s => ({
      name: s.softSkill.name,
      score: s.normalizedScore,
      level: s.level,
      gap: 70 - s.normalizedScore // Assumendo 70 come target generico
    }));

    // Calcola overall score
    const overallScore = sortedSkills.length > 0
      ? Math.round(
          sortedSkills.reduce((sum, s) => sum + s.normalizedScore, 0) / sortedSkills.length
        )
      : 0;

    res.json({
      success: true,
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        role: 'N/A', // Role will be fetched separately if needed
        lastAssessment: employee.lastAssessmentDate
      },
      overview: {
        overallScore,
        totalSkillsAssessed: Object.keys(latestScoresBySkill).length,
        averageConfidence: Math.round(
          Object.values(latestScoresBySkill)
            .reduce((sum, s) => sum + (s.confidence || 0), 0) /
          Object.keys(latestScoresBySkill).length * 100
        ) / 100
      },
      topSkills,
      developmentAreas,
      trends,
      roleComparison,
      currentScores: Object.values(latestScoresBySkill).map(s => ({
        skillId: s.softSkillId,
        skillName: s.softSkill.name,
        category: s.softSkill.category,
        score: s.normalizedScore,
        level: s.level,
        percentile: s.percentile,
        confidence: s.confidence,
        lastUpdated: s.calculatedAt
      })),
      history: scoreHistory
    });

  } catch (error) {
    logger.error('Errore nel recupero dashboard soft skills:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

module.exports = {
  getRecommendedTemplatesForRole,
  calculateRoleFit,
  getEmployeeRoleSkillsAssessment,
  getRoleSkillRequirements,
  getSoftSkillsDashboard
};