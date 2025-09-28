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
 * Get user soft skills
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

    // Mock data for now - replace with actual DB query
    const mockSkills = [
      {
        id: '1',
        userId,
        softSkillId: 'sk1',
        softSkill: {
          id: 'sk1',
          name: 'Comunicazione',
          category: 'Interpersonale',
          description: 'Capacità di comunicare efficacemente'
        },
        score: 85,
        confidence: 0.9,
        weight: 1.0,
        previousScore: 80,
        trend: 'IMPROVING',
        calculatedAt: new Date().toISOString()
      },
      {
        id: '2',
        userId,
        softSkillId: 'sk2',
        softSkill: {
          id: 'sk2',
          name: 'Lavoro di squadra',
          category: 'Collaborazione',
          description: 'Capacità di lavorare in team'
        },
        score: 78,
        confidence: 0.85,
        weight: 1.0,
        previousScore: 78,
        trend: 'STABLE',
        calculatedAt: new Date().toISOString()
      },
      {
        id: '3',
        userId,
        softSkillId: 'sk3',
        softSkill: {
          id: 'sk3',
          name: 'Problem Solving',
          category: 'Cognitivo',
          description: 'Capacità di risolvere problemi complessi'
        },
        score: 92,
        confidence: 0.95,
        weight: 1.0,
        previousScore: 88,
        trend: 'IMPROVING',
        calculatedAt: new Date().toISOString()
      },
      {
        id: '4',
        userId,
        softSkillId: 'sk4',
        softSkill: {
          id: 'sk4',
          name: 'Adattabilità',
          category: 'Personale',
          description: 'Capacità di adattarsi al cambiamento'
        },
        score: 65,
        confidence: 0.8,
        weight: 1.0,
        previousScore: 70,
        trend: 'DECLINING',
        calculatedAt: new Date().toISOString()
      },
      {
        id: '5',
        userId,
        softSkillId: 'sk5',
        softSkill: {
          id: 'sk5',
          name: 'Leadership',
          category: 'Gestionale',
          description: 'Capacità di guidare e motivare altri'
        },
        score: 70,
        confidence: 0.75,
        weight: 1.0,
        previousScore: null,
        trend: 'STABLE',
        calculatedAt: new Date().toISOString()
      },
      {
        id: '6',
        userId,
        softSkillId: 'sk6',
        softSkill: {
          id: 'sk6',
          name: 'Gestione tempo',
          category: 'Organizzativo',
          description: 'Capacità di gestire tempo e priorità'
        },
        score: 88,
        confidence: 0.9,
        weight: 1.0,
        previousScore: 85,
        trend: 'IMPROVING',
        calculatedAt: new Date().toISOString()
      }
    ];

    res.json(mockSkills);

  } catch (error) {
    logger.error('Error fetching user soft skills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch soft skills'
    });
  }
};

/**
 * Get radar chart data
 */
const getRadarChartData = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;

    const radarData = [
      { skill: 'Comunicazione', score: 85, benchmark: 75 },
      { skill: 'Lavoro di squadra', score: 78, benchmark: 80 },
      { skill: 'Problem Solving', score: 92, benchmark: 70 },
      { skill: 'Adattabilità', score: 65, benchmark: 72 },
      { skill: 'Leadership', score: 70, benchmark: 68 },
      { skill: 'Gestione tempo', score: 88, benchmark: 75 }
    ];

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
 * Get skills history
 */
const getSkillsHistory = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;

    const history = [
      {
        skillName: 'Comunicazione',
        skillId: 'sk1',
        history: [
          { date: '2024-01-01', score: 75, assessmentId: 'a1' },
          { date: '2024-04-01', score: 80, assessmentId: 'a2' },
          { date: '2024-07-01', score: 85, assessmentId: 'a3' }
        ],
        currentScore: 85,
        trend: 'IMPROVING'
      }
    ];

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
 * Get team benchmarks
 */
const getTeamBenchmarks = async (req, res) => {
  try {
    const { tenantId } = req.query;

    const benchmarks = [
      {
        skillId: 'sk1',
        skillName: 'Comunicazione',
        teamAverage: 75,
        departmentAverage: 77,
        companyAverage: 76
      },
      {
        skillId: 'sk2',
        skillName: 'Lavoro di squadra',
        teamAverage: 80,
        departmentAverage: 82,
        companyAverage: 81
      },
      {
        skillId: 'sk3',
        skillName: 'Problem Solving',
        teamAverage: 70,
        departmentAverage: 72,
        companyAverage: 71
      },
      {
        skillId: 'sk4',
        skillName: 'Adattabilità',
        teamAverage: 72,
        departmentAverage: 74,
        companyAverage: 73
      },
      {
        skillId: 'sk5',
        skillName: 'Leadership',
        teamAverage: 68,
        departmentAverage: 70,
        companyAverage: 69
      },
      {
        skillId: 'sk6',
        skillName: 'Gestione tempo',
        teamAverage: 75,
        departmentAverage: 77,
        companyAverage: 76
      }
    ];

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

    // Mock response
    const instance = {
      id: 'inst_' + Date.now(),
      templateName: 'Leadership Assessment',
      totalQuestions: 20,
      estimatedTime: 15
    };

    const questions = [
      {
        id: 'q1',
        text: 'Mi sento a mio agio nel parlare in pubblico',
        type: 'likert',
        category: 'Comunicazione',
        options: [
          { text: 'Completamente in disaccordo', value: 1 },
          { text: 'In disaccordo', value: 2 },
          { text: 'Neutrale', value: 3 },
          { text: 'D\'accordo', value: 4 },
          { text: 'Completamente d\'accordo', value: 5 }
        ],
        isRequired: true
      },
      {
        id: 'q2',
        text: 'Preferisco lavorare in team piuttosto che da solo',
        type: 'likert',
        category: 'Lavoro di squadra',
        options: [
          { text: 'Completamente in disaccordo', value: 1 },
          { text: 'In disaccordo', value: 2 },
          { text: 'Neutrale', value: 3 },
          { text: 'D\'accordo', value: 4 },
          { text: 'Completamente d\'accordo', value: 5 }
        ],
        isRequired: true
      }
    ];

    res.json({ instance, questions });

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

    // Calculate soft skills (mock)
    const softSkills = [
      { skill: 'Comunicazione', score: 85 },
      { skill: 'Lavoro di squadra', score: 78 },
      { skill: 'Problem Solving', score: 92 },
      { skill: 'Adattabilità', score: 65 },
      { skill: 'Leadership', score: 70 },
      { skill: 'Gestione tempo', score: 88 }
    ];

    const reportUrl = `/reports/${instanceId}.pdf`;

    res.json({
      success: true,
      softSkills,
      reportUrl
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

    // Get user soft skills
    const softSkills = [
      { skill: 'Comunicazione', score: 85, trend: 'IMPROVING' },
      { skill: 'Lavoro di squadra', score: 78, trend: 'STABLE' },
      { skill: 'Problem Solving', score: 92, trend: 'IMPROVING' },
      { skill: 'Adattabilità', score: 65, trend: 'DECLINING' },
      { skill: 'Leadership', score: 70, trend: 'STABLE' },
      { skill: 'Gestione tempo', score: 88, trend: 'IMPROVING' }
    ];

    // Calculate statistics
    const averageScore = Math.round(
      softSkills.reduce((sum, s) => sum + s.score, 0) / softSkills.length
    );

    // Get top skills and improvements
    const sortedSkills = [...softSkills].sort((a, b) => b.score - a.score);
    const strengths = sortedSkills.slice(0, 3);
    const improvements = sortedSkills.slice(-3).reverse();

    // Generate recommendations
    const recommendations = [
      'Continua a sviluppare le tue competenze di Problem Solving attraverso progetti complessi',
      'Considera di migliorare l\'Adattabilità attraverso formazione specifica',
      'Il tuo punto di forza in Gestione tempo può essere valorizzato in ruoli di coordinamento'
    ];

    // Prepare data for PDF
    const reportData = {
      userId,
      userName: 'Mario Rossi',
      assessmentName: 'Leadership Assessment',
      completedAt: new Date().toISOString(),
      averageScore,
      softSkills,
      strengths,
      improvements,
      recommendations
    };

    // Generate PDF
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