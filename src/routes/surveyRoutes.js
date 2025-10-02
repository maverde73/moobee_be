/**
 * Survey Routes
 * @module routes/surveyRoutes
 * @created 2025-09-30
 */

const express = require('express');
const router = express.Router();
const adaptiveSurveyController = require('../controllers/surveys/adaptiveSurveyController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get questions metadata (modules, core items, question bank)
router.get('/questions', adaptiveSurveyController.getQuestionsMetadata);

// Generate adaptive survey
router.post('/generate', adaptiveSurveyController.generateSurvey);

// Generate report from responses
router.post('/report', adaptiveSurveyController.generateReport);

// Safety check for proprietary content
router.post('/safety-check', adaptiveSurveyController.performSafetyCheck);

module.exports = router;