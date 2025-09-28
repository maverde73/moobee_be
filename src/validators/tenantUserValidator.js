/**
 * @module TenantUserValidator
 * @description Validatori per le route degli utenti tenant
 * Estratto da tenantUserRoutes.js per rispettare Giurelli Standards
 */

const { body, param, validationResult } = require('express-validator');

/**
 * @description Middleware per gestire errori di validazione
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @description Validazione per tenant ID
 */
const validateTenantId = [
  param('tenantId').isUUID().withMessage('Invalid tenant ID format'),
  handleValidationErrors
];

/**
 * @description Validazione per user ID
 */
const validateUserId = [
  param('userId').isUUID().withMessage('Invalid user ID format'),
  handleValidationErrors
];

/**
 * @description Validazione per creazione utente
 */
const validateUserCreate = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR', 'SALES', 'MANAGER', 'EMPLOYEE', 'VIEWER',
           'super_admin', 'admin', 'hr_manager', 'hr', 'sales', 'manager', 'employee', 'viewer'])
    .withMessage('Invalid role'),
  handleValidationErrors
];

/**
 * @description Validazione per aggiornamento utente
 */
const validateUserUpdate = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('first_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty'),
  body('last_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR', 'SALES', 'MANAGER', 'EMPLOYEE', 'VIEWER',
           'super_admin', 'admin', 'hr_manager', 'hr', 'sales', 'manager', 'employee', 'viewer'])
    .withMessage('Invalid role'),
  handleValidationErrors
];

/**
 * @description Validazione per import utenti
 */
const validateImport = [
  body('users')
    .isArray()
    .withMessage('Users must be an array'),
  body('users.*.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Each user must have a valid email'),
  body('users.*.firstName')
    .trim()
    .notEmpty()
    .withMessage('Each user must have a first name'),
  body('users.*.lastName')
    .trim()
    .notEmpty()
    .withMessage('Each user must have a last name'),
  body('users.*.role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR', 'SALES', 'MANAGER', 'EMPLOYEE', 'VIEWER',
           'super_admin', 'admin', 'hr_manager', 'hr', 'sales', 'manager', 'employee', 'viewer'])
    .withMessage('Invalid role'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateTenantId,
  validateUserId,
  validateUserCreate,
  validateUserUpdate,
  validateImport
};