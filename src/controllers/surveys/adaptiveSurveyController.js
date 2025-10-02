/**
 * Adaptive Survey Controller
 * @module controllers/surveys/adaptiveSurveyController
 * @created 2025-09-30
 */

const { getCoreItemsForModules } = require('../../utils/coreItems');
const { filterQuestions } = require('../../utils/surveyFilters');
const { adaptiveEngine } = require('../../utils/adaptiveEngine');
const { calculateModuleScores, generateReport } = require('../../utils/surveyScoring');
const questionBank = require('../../data/questionBank.json');
const logger = require('../../utils/logger');

/**
 * Get questions metadata (modules, core items, question bank)
 * GET /api/surveys/questions
 */
exports.getQuestionsMetadata = async (req, res) => {
  try {
    const { modules } = req.query;

    let selectedModules = [];
    if (modules) {
      selectedModules = modules.split(',');
    }

    // Get core items for selected modules
    const coreItems = selectedModules.length > 0
      ? getCoreItemsForModules(selectedModules)
      : [];

    // Get relevant questions from bank
    const bankQuestions = selectedModules.length > 0
      ? questionBank.questions.filter(q => selectedModules.includes(q.moduleId))
      : questionBank.questions;

    res.json({
      success: true,
      data: {
        modules: [
          { id: 'motivation', name: 'Motivazione' },
          { id: 'communication', name: 'Comunicazione' },
          { id: 'leadership', name: 'Leadership' },
          { id: 'wellbeing', name: 'Benessere' },
          { id: 'belonging_psychsafe', name: 'Appartenenza e Sicurezza Psicologica' },
          { id: 'growth_recognition', name: 'Crescita e Riconoscimento' },
          { id: 'motivation_fit', name: 'Motivazione e Fit Organizzativo' }
        ],
        coreItems,
        questionBank: bankQuestions,
        metadata: questionBank.metadata
      }
    });
  } catch (error) {
    logger.error('Error fetching questions metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions metadata'
    });
  }
};

/**
 * Generate adaptive survey
 * POST /api/surveys/generate
 */
exports.generateSurvey = async (req, res) => {
  try {
    const config = req.body;

    // Validate configuration
    const errors = adaptiveEngine.validateConfig(config);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    // Generate survey using adaptive engine
    const generatedSurvey = await adaptiveEngine.generateSurvey(config);

    // Store survey in session or database if needed
    // For now, we'll return it directly

    logger.info('Survey generated successfully', {
      surveyId: generatedSurvey.id,
      totalQuestions: generatedSurvey.questions.length,
      modules: config.selectedModules,
      objective: config.objective,
      role: config.role
    });

    res.json({
      success: true,
      data: generatedSurvey
    });
  } catch (error) {
    logger.error('Error generating survey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate survey'
    });
  }
};

/**
 * Generate report from survey responses
 * POST /api/surveys/report
 */
exports.generateReport = async (req, res) => {
  try {
    const { surveyId, responses } = req.body;

    if (!surveyId || !responses || responses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Survey ID and responses are required'
      });
    }

    // Calculate module scores
    const moduleScores = calculateModuleScores(responses);

    // Generate report with suggestions
    const report = generateReport(surveyId, moduleScores, responses);

    logger.info('Report generated successfully', {
      surveyId,
      overallScore: report.overallScore,
      criticalAreas: report.criticalAreas.length
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
};

/**
 * Safety check for proprietary content
 * POST /api/surveys/safety-check
 */
exports.performSafetyCheck = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for safety check'
      });
    }

    const safetyResult = adaptiveEngine.performSafetyCheck(text);

    res.json({
      success: true,
      data: safetyResult
    });
  } catch (error) {
    logger.error('Error performing safety check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform safety check'
    });
  }
};