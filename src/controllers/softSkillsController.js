/**
 * Soft Skills Controller
 * Gestisce le API per soft skills degli utenti
 * @module controllers/softSkillsController
 */

const prisma = require('../config/database');
const logger = require('../utils/logger');
const pdfGenerator = require('../services/pdfGeneratorService');
const path = require('path');

/**
 * Get user soft skills from DB
 * Queries employee_soft_skill_assessments for the latest scores,
 * falling back to employee_soft_skills if no assessments exist.
 */
const getUserSoftSkills = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required'
      });
    }

    const employeeId = parseInt(userId);
    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Try to get assessment-based scores first (most accurate)
    const assessmentScores = await prisma.employee_soft_skill_assessments.findMany({
      where: { employeeId },
      include: { soft_skills: true },
      orderBy: { calculatedAt: 'desc' }
    });

    if (assessmentScores.length > 0) {
      // Group by softSkillId, keep only the latest per skill
      const latestBySkill = new Map();
      for (const score of assessmentScores) {
        if (!latestBySkill.has(score.softSkillId)) {
          latestBySkill.set(score.softSkillId, score);
        }
      }

      const skills = Array.from(latestBySkill.values()).map(score => ({
        id: String(score.id),
        userId: String(employeeId),
        softSkillId: String(score.softSkillId),
        softSkill: {
          id: String(score.soft_skills.id),
          name: score.soft_skills.name,
          category: score.soft_skills.category || 'Generale',
          description: score.soft_skills.description || ''
        },
        score: Math.round(score.score),
        confidence: score.confidence,
        weight: score.weight,
        previousScore: score.previousScore ? Math.round(score.previousScore) : null,
        trend: score.trend || 'STABLE',
        calculatedAt: score.calculatedAt.toISOString()
      }));

      return res.json(skills);
    }

    // Fallback: check employee_soft_skills (role-based assignments without scores)
    const employeeSkills = await prisma.employee_soft_skills.findMany({
      where: { employee_id: employeeId },
      include: { soft_skills: true }
    });

    if (employeeSkills.length > 0) {
      const skills = employeeSkills.map(es => ({
        id: String(es.id),
        userId: String(employeeId),
        softSkillId: String(es.soft_skill_id),
        softSkill: {
          id: String(es.soft_skills.id),
          name: es.soft_skills.name,
          category: es.soft_skills.category || 'Generale',
          description: es.soft_skills.description || ''
        },
        score: 0, // No assessment score yet
        confidence: 0,
        weight: 1.0,
        previousScore: null,
        trend: 'STABLE',
        calculatedAt: (es.updated_at || es.created_at || new Date()).toISOString()
      }));

      return res.json(skills);
    }

    // No data at all
    res.json([]);

  } catch (error) {
    logger.error('Error fetching user soft skills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch soft skills'
    });
  }
};

/**
 * Get radar chart data from DB
 */
const getRadarChartData = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const employeeId = parseInt(userId);

    if (!userId || isNaN(employeeId)) {
      return res.json([]);
    }

    // Get latest assessment scores for this employee
    const assessmentScores = await prisma.employee_soft_skill_assessments.findMany({
      where: { employeeId },
      include: { soft_skills: true },
      orderBy: { calculatedAt: 'desc' }
    });

    if (assessmentScores.length === 0) {
      return res.json([]);
    }

    // Keep only latest per skill
    const latestBySkill = new Map();
    for (const score of assessmentScores) {
      if (!latestBySkill.has(score.softSkillId)) {
        latestBySkill.set(score.softSkillId, score);
      }
    }

    // Get tenant-wide averages for benchmarks
    const tenantId = req.user?.tenantId;
    let benchmarkMap = new Map();

    if (tenantId) {
      const allScores = await prisma.employee_soft_skill_assessments.findMany({
        where: {
          employees: { tenant_id: tenantId }
        },
        select: { softSkillId: true, score: true }
      });

      // Calculate averages per skill
      const skillTotals = new Map();
      for (const s of allScores) {
        if (!skillTotals.has(s.softSkillId)) {
          skillTotals.set(s.softSkillId, { sum: 0, count: 0 });
        }
        const t = skillTotals.get(s.softSkillId);
        t.sum += s.score;
        t.count += 1;
      }
      for (const [skillId, t] of skillTotals) {
        benchmarkMap.set(skillId, Math.round(t.sum / t.count));
      }
    }

    const radarData = Array.from(latestBySkill.values()).map(score => ({
      skill: score.soft_skills.name,
      score: Math.round(score.score),
      benchmark: benchmarkMap.get(score.softSkillId) || undefined
    }));

    res.json(radarData);

  } catch (error) {
    logger.error('Error fetching radar chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch radar data'
    });
  }
};

/**
 * Get skills history from DB
 */
const getSkillsHistory = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const employeeId = parseInt(userId);

    if (!userId || isNaN(employeeId)) {
      return res.json([]);
    }

    // Get all assessment scores for this employee, ordered by date
    const allScores = await prisma.employee_soft_skill_assessments.findMany({
      where: { employeeId },
      include: {
        soft_skills: true,
        assessment_instances: { select: { id: true, completedAt: true } }
      },
      orderBy: { calculatedAt: 'asc' }
    });

    if (allScores.length === 0) {
      return res.json([]);
    }

    // Group by skill
    const skillGroups = new Map();
    for (const score of allScores) {
      const key = score.softSkillId;
      if (!skillGroups.has(key)) {
        skillGroups.set(key, {
          skillName: score.soft_skills.name,
          skillId: String(score.softSkillId),
          history: []
        });
      }
      skillGroups.get(key).history.push({
        date: score.calculatedAt.toISOString().split('T')[0],
        score: Math.round(score.score),
        assessmentId: String(score.assessmentInstanceId)
      });
    }

    // Calculate current score and trend for each skill
    const history = Array.from(skillGroups.values()).map(group => {
      const lastScore = group.history[group.history.length - 1].score;
      const prevScore = group.history.length > 1
        ? group.history[group.history.length - 2].score
        : null;

      let trend = 'STABLE';
      if (prevScore !== null) {
        const diff = lastScore - prevScore;
        if (Math.abs(diff) >= 5) {
          trend = diff > 0 ? 'IMPROVING' : 'DECLINING';
        }
      }

      return {
        ...group,
        currentScore: lastScore,
        trend
      };
    });

    res.json(history);

  } catch (error) {
    logger.error('Error fetching skills history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history'
    });
  }
};

/**
 * Get team benchmarks from DB
 */
const getTeamBenchmarks = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user?.tenantId;

    if (!tenantId) {
      return res.json([]);
    }

    // Get all assessment scores for the tenant
    const allScores = await prisma.employee_soft_skill_assessments.findMany({
      where: {
        employees: { tenant_id: tenantId }
      },
      include: { soft_skills: true }
    });

    if (allScores.length === 0) {
      return res.json([]);
    }

    // Group by skill and compute averages
    const skillTotals = new Map();
    for (const s of allScores) {
      if (!skillTotals.has(s.softSkillId)) {
        skillTotals.set(s.softSkillId, {
          skillId: String(s.softSkillId),
          skillName: s.soft_skills.name,
          sum: 0,
          count: 0
        });
      }
      const t = skillTotals.get(s.softSkillId);
      t.sum += s.score;
      t.count += 1;
    }

    const benchmarks = Array.from(skillTotals.values()).map(t => ({
      skillId: t.skillId,
      skillName: t.skillName,
      teamAverage: Math.round(t.sum / t.count),
      departmentAverage: Math.round(t.sum / t.count), // same as team for now
      companyAverage: Math.round(t.sum / t.count)
    }));

    res.json(benchmarks);

  } catch (error) {
    logger.error('Error fetching benchmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch benchmarks'
    });
  }
};

/**
 * Start assessment
 */
const startAssessment = async (req, res) => {
  try {
    const { scheduleId } = req.body;

    if (!scheduleId) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID required'
      });
    }

    // Look up the schedule and its template
    const schedule = await prisma.assessment_schedules.findUnique({
      where: { id: parseInt(scheduleId) },
      include: {
        tenant_assessment_selections: {
          include: {
            assessment_templates: true
          }
        }
      }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Assessment schedule not found'
      });
    }

    const template = schedule.tenant_assessment_selections?.assessment_templates;
    const templateId = template?.id;

    if (!templateId) {
      return res.status(404).json({
        success: false,
        error: 'Assessment template not found for this schedule'
      });
    }

    // Create an assessment instance
    const instance = await prisma.assessment_instances.create({
      data: {
        scheduleId: schedule.id,
        templateId,
        userId: req.user?.id || '',
        tenantId: req.user?.tenantId || '',
        startedAt: new Date()
      }
    });

    // Get questions for this template
    const questions = await prisma.assessment_questions.findMany({
      where: { templateId },
      include: { assessment_options: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { order: 'asc' }
    });

    const formattedQuestions = questions.map(q => ({
      id: String(q.id),
      text: q.text,
      type: q.type || 'likert',
      category: q.category || 'Generale',
      options: q.assessment_options.length > 0
        ? q.assessment_options.map(o => ({ text: o.text, value: o.value }))
        : [
            { text: 'Completamente in disaccordo', value: 1 },
            { text: 'In disaccordo', value: 2 },
            { text: 'Neutrale', value: 3 },
            { text: "D'accordo", value: 4 },
            { text: "Completamente d'accordo", value: 5 }
          ],
      isRequired: q.isRequired ?? true
    }));

    res.json({
      instance: {
        id: String(instance.id),
        templateName: template?.name || 'Assessment',
        totalQuestions: formattedQuestions.length,
        estimatedTime: Math.ceil(formattedQuestions.length * 0.75)
      },
      questions: formattedQuestions
    });

  } catch (error) {
    logger.error('Error starting assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start assessment'
    });
  }
};

/**
 * Complete assessment
 */
const completeAssessment = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { responses, timeSpent } = req.body;
    const parsedInstanceId = parseInt(instanceId);

    if (isNaN(parsedInstanceId)) {
      return res.status(400).json({ success: false, error: 'Invalid instance ID' });
    }

    // Get the instance
    const instance = await prisma.assessment_instances.findUnique({
      where: { id: parsedInstanceId }
    });

    if (!instance) {
      return res.status(404).json({ success: false, error: 'Assessment instance not found' });
    }

    // Save responses
    if (responses && Array.isArray(responses)) {
      for (const r of responses) {
        await prisma.assessment_instance_responses.upsert({
          where: {
            instanceId_questionId: {
              instanceId: parsedInstanceId,
              questionId: parseInt(r.questionId)
            }
          },
          create: {
            instanceId: parsedInstanceId,
            questionId: parseInt(r.questionId),
            answer: { value: r.value },
            score: r.value
          },
          update: {
            answer: { value: r.value },
            score: r.value
          }
        });
      }
    }

    // Mark instance as completed
    await prisma.assessment_instances.update({
      where: { id: parsedInstanceId },
      data: {
        completedAt: new Date(),
        timeSpent: timeSpent || null
      }
    });

    // Calculate soft skill scores from the responses
    // Get question-to-skill mappings for questions in this template
    const questionSkillMappings = await prisma.question_soft_skill_mappings.findMany({
      where: {
        assessment_questions: {
          templateId: instance.templateId
        }
      },
      include: { soft_skills: true }
    });

    const skillScores = new Map();
    for (const mapping of questionSkillMappings) {
      const response = responses?.find(r => parseInt(r.questionId) === mapping.questionId);
      if (response) {
        if (!skillScores.has(mapping.softSkillId)) {
          skillScores.set(mapping.softSkillId, {
            skillName: mapping.soft_skills.name,
            scores: [],
            weight: mapping.weight || 1.0
          });
        }
        skillScores.get(mapping.softSkillId).scores.push(
          (response.value / 5) * 100 * (mapping.weight || 1.0)
        );
      }
    }

    // Resolve employee ID from userId
    const employee = await prisma.employees.findFirst({
      where: {
        tenant_users: {
          some: { id: instance.userId }
        }
      },
      select: { id: true }
    });

    const employeeId = employee?.id;

    // Calculate and save average scores per skill
    const softSkills = [];
    if (employeeId) {
      for (const [skillId, data] of skillScores) {
        const avgScore = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);

        // Get previous score
        const prevAssessment = await prisma.employee_soft_skill_assessments.findFirst({
          where: {
            employeeId,
            softSkillId: skillId,
            assessmentInstanceId: { not: parsedInstanceId }
          },
          orderBy: { calculatedAt: 'desc' }
        });

        const previousScore = prevAssessment ? prevAssessment.score : null;
        let trend = 'STABLE';
        if (previousScore !== null) {
          const diff = avgScore - previousScore;
          if (Math.abs(diff) >= 5) {
            trend = diff > 0 ? 'IMPROVING' : 'DECLINING';
          }
        }

        await prisma.employee_soft_skill_assessments.upsert({
          where: {
            employee_soft_skill_assessments_unique: {
              employeeId,
              softSkillId: skillId,
              assessmentInstanceId: parsedInstanceId
            }
          },
          create: {
            employeeId,
            softSkillId: skillId,
            assessmentInstanceId: parsedInstanceId,
            score: avgScore,
            confidence: Math.min(data.scores.length / 5, 1.0),
            weight: data.weight,
            previousScore: previousScore,
            trend: trend
          },
          update: {
            score: avgScore,
            confidence: Math.min(data.scores.length / 5, 1.0),
            previousScore: previousScore,
            trend: trend
          }
        });

        softSkills.push({
          skill: data.skillName,
          score: avgScore
        });
      }
    }

    res.json({
      success: true,
      softSkills,
      reportUrl: `/reports/${instanceId}.pdf`
    });

  } catch (error) {
    logger.error('Error completing assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete assessment'
    });
  }
};

/**
 * Generate PDF report
 */
const generateReport = async (req, res) => {
  try {
    const { userId, instanceId, type = 'assessment' } = req.body;
    const employeeId = parseInt(userId);

    if (isNaN(employeeId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Get employee info
    const employee = await prisma.employees.findUnique({
      where: { id: employeeId },
      select: { id: true, first_name: true, last_name: true }
    });

    // Get the latest soft skill scores
    const assessmentScores = await prisma.employee_soft_skill_assessments.findMany({
      where: { employeeId },
      include: { soft_skills: true },
      orderBy: { calculatedAt: 'desc' }
    });

    // Keep only latest per skill
    const latestBySkill = new Map();
    for (const score of assessmentScores) {
      if (!latestBySkill.has(score.softSkillId)) {
        latestBySkill.set(score.softSkillId, score);
      }
    }

    const softSkills = Array.from(latestBySkill.values()).map(score => ({
      skill: score.soft_skills.name,
      score: Math.round(score.score),
      trend: score.trend || 'STABLE'
    }));

    if (softSkills.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No soft skill data found for this employee'
      });
    }

    // Calculate statistics
    const averageScore = Math.round(
      softSkills.reduce((sum, s) => sum + s.score, 0) / softSkills.length
    );

    const sortedSkills = [...softSkills].sort((a, b) => b.score - a.score);
    const strengths = sortedSkills.slice(0, 3);
    const improvements = sortedSkills.slice(-3).reverse();

    const recommendations = [];
    if (improvements[0] && improvements[0].score < 70) {
      recommendations.push(
        `Considera di migliorare ${improvements[0].skill} attraverso formazione specifica.`
      );
    }
    if (strengths[0] && strengths[0].score > 80) {
      recommendations.push(
        `Il tuo punto di forza in ${strengths[0].skill} può essere valorizzato in ruoli di coordinamento.`
      );
    }

    const userName = employee
      ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || `Employee ${employeeId}`
      : `Employee ${employeeId}`;

    const reportData = {
      userId,
      userName,
      assessmentName: 'Soft Skills Assessment',
      completedAt: new Date().toISOString(),
      averageScore,
      softSkills,
      strengths,
      improvements,
      recommendations
    };

    const result = await pdfGenerator.generateAssessmentReport(reportData);

    res.json({
      success: true,
      reportUrl: result.path,
      fileName: result.fileName
    });

  } catch (error) {
    logger.error('Error generating report', error, 'SoftSkillsController');
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
};

/**
 * Download report
 */
const downloadReport = async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '..', '..', 'public', 'reports', fileName);

    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error('Error downloading report', err, 'SoftSkillsController');
        res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }
    });

  } catch (error) {
    logger.error('Error in download report', error, 'SoftSkillsController');
    res.status(500).json({
      success: false,
      error: 'Failed to download report'
    });
  }
};

module.exports = {
  getUserSoftSkills,
  getRadarChartData,
  getSkillsHistory,
  getTeamBenchmarks,
  startAssessment,
  completeAssessment,
  generateReport,
  downloadReport
};
