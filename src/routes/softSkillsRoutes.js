/**
 * Soft Skills Routes
 * Routes per gestione soft skills utenti
 * @module routes/softSkillsRoutes
 */

const express = require('express');
const router = express.Router();
const softSkillsController = require('../controllers/softSkillsController');

// User soft skills routes
router.get('/user/soft-skills', softSkillsController.getUserSoftSkills);
router.get('/user/soft-skills/radar-data', softSkillsController.getRadarChartData);
router.get('/user/soft-skills/history', softSkillsController.getSkillsHistory);

// User specific routes
router.get('/users/:userId/soft-skills', softSkillsController.getUserSoftSkills);
router.get('/users/:userId/soft-skills/radar-data', softSkillsController.getRadarChartData);
router.get('/users/:userId/soft-skills/history', softSkillsController.getSkillsHistory);

// Benchmarks
router.get('/soft-skills/benchmarks', softSkillsController.getTeamBenchmarks);

// Assessment flow
router.post('/assessments/start', softSkillsController.startAssessment);
router.post('/assessments/:instanceId/complete', softSkillsController.completeAssessment);

// Report generation
router.post('/soft-skills/generate-report', softSkillsController.generateReport);
router.get('/soft-skills/report/:fileName', softSkillsController.downloadReport);

module.exports = router;