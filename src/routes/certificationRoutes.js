/**
 * Certification Routes
 * @module routes/certificationRoutes
 * @created 2025-09-27 18:40
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const certificationController = require('../controllers/certificationController');

// ========================================
// PUBLIC ROUTES (with authentication)
// ========================================

/**
 * @route GET /api/certifications
 * @desc Get all certifications with filters
 * @access Private (All authenticated users)
 */
router.get(
  '/',
  authenticate,
  certificationController.getCertifications.bind(certificationController)
);

/**
 * @route GET /api/certifications/categories
 * @desc Get certification categories
 * @access Private (All authenticated users)
 */
router.get(
  '/categories',
  authenticate,
  certificationController.getCategories.bind(certificationController)
);

/**
 * @route GET /api/certifications/levels
 * @desc Get certification levels
 * @access Private (All authenticated users)
 */
router.get(
  '/levels',
  authenticate,
  certificationController.getLevels.bind(certificationController)
);

/**
 * @route GET /api/certifications/tenant/:tenantId
 * @desc Get certifications for a specific tenant
 * @access Private (All authenticated users)
 */
router.get(
  '/tenant/:tenantId',
  authenticate,
  certificationController.getTenantCertifications.bind(certificationController)
);

/**
 * @route GET /api/certifications/:id
 * @desc Get single certification by ID
 * @access Private (All authenticated users)
 */
router.get(
  '/:id',
  authenticate,
  certificationController.getCertificationById.bind(certificationController)
);

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * @route POST /api/certifications
 * @desc Create new certification
 * @access Private (HR, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  certificationController.createCertification.bind(certificationController)
);

/**
 * @route PUT /api/certifications/:id
 * @desc Update certification
 * @access Private (HR, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(['HR', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  certificationController.updateCertification.bind(certificationController)
);

/**
 * @route DELETE /api/certifications/:id
 * @desc Delete certification (soft delete)
 * @access Private (Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN']),
  certificationController.deleteCertification.bind(certificationController)
);

module.exports = router;