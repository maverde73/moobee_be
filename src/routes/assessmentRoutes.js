const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const assessmentAIController = require('../controllers/assessmentAIController');
const { authenticate } = require('../middlewares/authMiddleware');
const { checkSuperAdmin } = require('../middleware/checkRole');

// Tutte le routes richiedono autenticazione
router.use(authenticate);

// Solo Super Admin può gestire il catalogo assessment
router.use(checkSuperAdmin);

// Routes per gestione Assessment Templates
router.post('/api/admin/assessment-catalog',
  assessmentController.createAssessmentTemplate);

router.get('/api/admin/assessment-catalog',
  assessmentController.getAssessmentTemplates);

router.get('/api/admin/assessment-catalog/:id',
  assessmentController.getAssessmentTemplate);

router.put('/api/admin/assessment-catalog/:id',
  assessmentController.updateAssessmentTemplate);

router.delete('/api/admin/assessment-catalog/:id',
  assessmentController.deleteAssessmentTemplate);

router.post('/api/admin/assessment-catalog/:id/publish',
  assessmentController.publishAssessmentTemplate);

router.post('/api/admin/assessment-catalog/:id/unpublish',
  assessmentController.unpublishAssessmentTemplate);

// AI-powered endpoints (usando il controller AI dedicato)
router.post('/api/admin/assessment-catalog/ai/generate-questions',
  assessmentAIController.generateQuestionsWithAI);

router.post('/api/admin/assessment-catalog/ai/evaluate-responses',
  assessmentAIController.evaluateResponsesWithAI);

router.post('/api/admin/assessment-catalog/ai/generate-report',
  assessmentAIController.generateReportWithAI);

router.post('/api/admin/assessment-catalog/ai/improve-questions',
  assessmentAIController.getImprovementSuggestions);

router.post('/api/admin/assessment-catalog/ai/generate-prompt',
  assessmentAIController.generateCustomPrompt);

router.get('/api/admin/assessment-catalog/ai/test-connection',
  assessmentAIController.testAIConnection);

router.post('/api/admin/assessment-catalog/ai/generate-complete',
  assessmentAIController.generateCompleteAssessment);

module.exports = router;