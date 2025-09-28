/**
 * Matching Routes
 * @module routes/matching
 * @created 2025-09-27 18:40
 */

const router = require('express').Router();
const matchingController = require('../controllers/project/matchingController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Protect all routes
router.use(authenticate);

// Matching routes
router.post(
  '/project-roles/:roleId/match',
  authorize(['hr', 'hr_manager', 'manager', 'admin']),
  matchingController.runMatching
);

router.get(
  '/project-roles/:roleId/matches',
  authorize(['hr', 'hr_manager', 'manager', 'admin']),
  matchingController.getMatchingResults
);

router.patch(
  '/matching-results/:resultId/shortlist',
  authorize(['hr', 'hr_manager', 'manager', 'admin']),
  matchingController.updateShortlist
);

module.exports = router;