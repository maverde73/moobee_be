const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const assessmentAIController = require('../controllers/assessmentAIController');
const tenantSelectionController = require('../controllers/assessment/tenantSelectionController');
const rolesController = require('../controllers/rolesController');
const employeeAssignmentController = require('../controllers/assessment/employeeAssignmentController');
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * Assessment API Routes
 * Mounted at /api/assessments
 */

// Public routes (no auth required for viewing templates)
router.get('/templates', assessmentController.getAllTemplates);
router.get('/templates/:id', assessmentController.getTemplateById);

// Main assessments endpoint for catalog (compatible with frontend)
router.get('/', assessmentController.getAllTemplates);

// Roles endpoints
router.get('/roles', rolesController.getAllRoles);
router.get('/roles/assessment', rolesController.getAssessmentRoles);

// Tenant selection endpoints (temporarily public for development)
router.get('/catalog', tenantSelectionController.getAssessmentsWithSelectionStatus);
router.get('/tenant/:tenantId/selections', tenantSelectionController.getTenantSelections);
router.put('/tenant/:tenantId/selections', tenantSelectionController.updateTenantSelections);
router.post('/tenant/:tenantId/select', tenantSelectionController.addTenantSelection);
router.delete('/tenant/:tenantId/select/:templateId', tenantSelectionController.removeTenantSelection);

// Employee assignment endpoints (MUST be before /:id route)
router.get('/my-assignments', authenticate, employeeAssignmentController.getMyActiveAssignments);
router.get('/my-latest-result', authenticate, employeeAssignmentController.getMyLatestResult);
router.get('/assignments/:assignmentId', authenticate, employeeAssignmentController.getAssignmentDetails);
router.patch('/assignments/:assignmentId/start', authenticate, employeeAssignmentController.startAssessment);
router.post('/assignments/:assignmentId/submit', authenticate, employeeAssignmentController.submitAssessmentResponses);
router.get('/assignments/:assignmentId/progress', authenticate, employeeAssignmentController.getAssessmentProgress);

router.get('/:id', assessmentController.getTemplateById);

// TEMPORARILY PUBLIC for development/testing
// TODO: Add proper authentication handling in frontend before re-enabling auth
router.post('/templates', assessmentController.createTemplate);
router.put('/templates/:id', assessmentController.updateTemplate);
router.delete('/templates/:id', assessmentController.deleteTemplate);
router.post('/templates/:id/duplicate', assessmentController.duplicateTemplate);

// Protected routes (require authentication)
router.use(authenticate);

// AI endpoints (NOW PROTECTED - auth required for LLM audit logging)
router.post('/ai/generate-questions', (req, res, next) => {
  const fs = require('fs');
  fs.appendFileSync('/tmp/moobee_debug.log', `\n[${new Date().toISOString()}] ROUTER: /ai/generate-questions HIT\n`);
  fs.appendFileSync('/tmp/moobee_debug.log', `  Method: ${req.method}\n`);
  fs.appendFileSync('/tmp/moobee_debug.log', `  Has req.user: ${!!req.user}\n`);
  fs.appendFileSync('/tmp/moobee_debug.log', `  req.user.tenantId: ${req.user?.tenantId || req.user?.tenant_id || 'MISSING'}\n`);
  next();
}, assessmentAIController.generateQuestionsWithAI);
router.get('/ai/providers', assessmentAIController.getAIProviders);
router.get('/ai/prompt-template', assessmentAIController.getPromptTemplate);
router.get('/ai/assessment-types', assessmentAIController.getAssessmentTypes);
router.get('/ai/test-connection', assessmentAIController.testAIConnection);
router.get('/ai/models/:provider/:modelId', assessmentAIController.getModelDetails);
router.post('/templates/:id/regenerate', assessmentAIController.regenerateQuestions);

// Question management
router.post('/templates/:id/questions', assessmentController.addQuestion);
router.put('/questions/:id', assessmentController.updateQuestion);
router.delete('/questions/:id', assessmentController.deleteQuestion);
router.put('/questions/reorder', assessmentController.reorderQuestions);

// Other AI endpoints (still protected)
router.post('/ai/evaluate-responses', assessmentAIController.evaluateResponsesWithAI);
router.post('/ai/generate-report', assessmentAIController.generateReportWithAI);
router.post('/ai/improve-questions', assessmentAIController.getImprovementSuggestions);
router.post('/ai/generate-prompt', assessmentAIController.generateCustomPrompt);
router.post('/ai/generate-complete', assessmentAIController.generateCompleteAssessment);

// Tenant selection
router.post('/select', assessmentController.selectTemplateForTenant);
router.get('/tenant/:tenantId', assessmentController.getTenantSelections);

// Statistics
router.get('/statistics', assessmentController.getStatistics);

module.exports = router;