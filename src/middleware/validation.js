/**
 * Input Validation Middleware
 * Provides security validation and sanitization for all API endpoints
 * @module middleware/validation
 */

const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Sanitize HTML input
 */
const sanitizeHtml = (value) => {
  if (typeof value !== 'string') return value;
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

/**
 * Sanitize and escape special characters
 */
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;

  // Remove HTML tags
  let sanitized = sanitizeHtml(value);

  // Remove SQL injection attempts
  sanitized = sanitized.replace(/['";\\]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Common validation chains
 */
const validators = {
  // ID validators
  id: param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
    .toInt(),

  uuid: param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID'),

  // String validators
  requiredString: (field, minLength = 1, maxLength = 255) =>
    body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isString()
      .withMessage(`${field} must be a string`)
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`)
      .customSanitizer(sanitizeInput),

  optionalString: (field, maxLength = 255) =>
    body(field)
      .optional()
      .isString()
      .withMessage(`${field} must be a string`)
      .isLength({ max: maxLength })
      .withMessage(`${field} must not exceed ${maxLength} characters`)
      .customSanitizer(sanitizeInput),

  // Email validator
  email: body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  // Password validator
  password: body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),

  // Boolean validator
  boolean: (field) =>
    body(field)
      .optional()
      .isBoolean()
      .withMessage(`${field} must be a boolean`)
      .toBoolean(),

  // Number validators
  integer: (field, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    body(field)
      .isInt({ min, max })
      .withMessage(`${field} must be an integer between ${min} and ${max}`)
      .toInt(),

  float: (field, min = 0, max = Number.MAX_VALUE) =>
    body(field)
      .isFloat({ min, max })
      .withMessage(`${field} must be a number between ${min} and ${max}`)
      .toFloat(),

  // Array validator
  array: (field, minItems = 0, maxItems = 100) =>
    body(field)
      .isArray({ min: minItems, max: maxItems })
      .withMessage(`${field} must be an array with ${minItems}-${maxItems} items`),

  // Date validators
  date: (field) =>
    body(field)
      .isISO8601()
      .withMessage(`${field} must be a valid date`)
      .toDate(),

  // Phone validator
  phone: body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number format'),

  // URL validator
  url: (field) =>
    body(field)
      .isURL({
        protocols: ['http', 'https'],
        require_protocol: true
      })
      .withMessage(`${field} must be a valid URL`),

  // JSON validator
  json: (field) =>
    body(field)
      .isJSON()
      .withMessage(`${field} must be valid JSON`)
};

/**
 * Validation schemas for different endpoints
 */
const validationSchemas = {
  // Auth validations
  login: [
    validators.email,
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  register: [
    validators.requiredString('name', 2, 100),
    validators.email,
    validators.password,
    validators.optionalString('role', 50)
  ],

  // Tenant validations
  createTenant: [
    validators.requiredString('name', 2, 100),
    validators.requiredString('domain', 3, 100),
    validators.email,
    validators.optionalString('description', 500),
    validators.boolean('isActive')
  ],

  updateTenant: [
    validators.id,
    validators.optionalString('name', 100),
    validators.optionalString('domain', 100),
    body('email').optional().isEmail().normalizeEmail(),
    validators.optionalString('description', 500),
    validators.boolean('isActive')
  ],

  // User validations
  createUser: [
    validators.requiredString('name', 2, 100),
    validators.email,
    validators.password,
    validators.requiredString('role', 20),
    validators.integer('tenantId', 1)
  ],

  updateUser: [
    validators.id,
    validators.optionalString('name', 100),
    body('email').optional().isEmail().normalizeEmail(),
    validators.optionalString('role', 20),
    validators.boolean('isActive')
  ],

  // Assessment validations
  createAssessment: [
    validators.requiredString('name', 2, 200),
    validators.requiredString('type', 50),
    validators.requiredString('description', 10, 1000),
    validators.optionalString('instructions', 2000),
    validators.array('questions', 1, 200),
    body('questions.*.text')
      .notEmpty()
      .withMessage('Question text is required')
      .customSanitizer(sanitizeInput),
    body('questions.*.type')
      .isIn(['multiple_choice', 'likert_scale', 'text', 'ranking'])
      .withMessage('Invalid question type'),
    validators.array('suggestedRoles', 0, 20)
  ],

  // Soft Skills validations
  createSoftSkill: [
    validators.requiredString('code', 2, 50),
    validators.requiredString('name', 2, 100),
    validators.requiredString('category', 50),
    validators.requiredString('description', 10, 500),
    validators.integer('weight', 1, 100),
    validators.array('indicators', 1, 20),
    validators.array('assessmentMethods', 0, 10)
  ],

  updateSoftSkillScore: [
    validators.uuid,
    validators.integer('score', 1, 100),
    validators.integer('confidence', 0, 100),
    validators.optionalString('notes', 500)
  ],

  // Query validations
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('sort')
      .optional()
      .isIn(['asc', 'desc', 'ASC', 'DESC'])
      .withMessage('Sort must be asc or desc'),
    query('orderBy')
      .optional()
      .matches(/^[a-zA-Z_]+$/)
      .withMessage('Invalid orderBy field')
  ],

  search: [
    query('q')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Search query too long')
      .customSanitizer(sanitizeInput)
  ]
};

/**
 * Sanitize all request data
 */
const sanitizeRequest = (req, res, next) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }

  // Sanitize query params
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    });
  }

  next();
};

module.exports = {
  handleValidationErrors,
  sanitizeHtml,
  sanitizeInput,
  sanitizeRequest,
  validators,
  validationSchemas,
  // Export validator functions for custom use
  body,
  param,
  query,
  validationResult
};