/**
 * Engagement Validator
 * @module validators/engagementValidator
 * @created 2025-09-22
 * @description Validation rules for engagement system
 */

const Joi = require('joi');

// Engagement areas enum
const ENGAGEMENT_AREAS = [
  'MOTIVATION',
  'LEADERSHIP',
  'COMMUNICATION',
  'WORK_LIFE_BALANCE',
  'BELONGING',
  'GROWTH'
];

// Template types enum
const TEMPLATE_TYPES = ['UWES', 'GALLUP_Q12', 'CUSTOM'];

// Frequency options
const FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL'];

// Question types
const QUESTION_TYPES = ['LIKERT', 'MULTIPLE_CHOICE', 'OPEN_TEXT'];

/**
 * Validate engagement template creation/update
 */
const validateEngagementTemplate = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(200).required(),
    type: Joi.string().valid(...TEMPLATE_TYPES).required(),
    roleId: Joi.number().integer().positive().optional().allow(null), // Made optional for multi-role support
    description: Joi.string().max(1000).optional(),
    instructions: Joi.string().max(2000).optional().allow(''),
    suggestedFrequency: Joi.string().valid(...FREQUENCIES).optional(),
    questions: Joi.array().items(
      Joi.object({
        code: Joi.string().max(50).optional(),
        text: Joi.string().min(10).max(500).required(),
        area: Joi.string().valid(...ENGAGEMENT_AREAS).optional(), // Made optional for AI-generated questions
        type: Joi.string().valid(...QUESTION_TYPES).default('LIKERT'),
        scaleMin: Joi.number().integer().min(0).max(1).default(1),
        scaleMax: Joi.number().integer().min(3).max(10).default(5),
        weight: Joi.number().min(0).max(10).default(1.0),
        orderIndex: Joi.number().integer().min(0).optional(),
        isRequired: Joi.boolean().default(true),
        metadata: Joi.object().optional()
      })
    ).optional(),
    metadata: Joi.object().optional() // Added metadata field for AI generation data
  });

  const result = schema.validate(data);

  return {
    valid: !result.error,
    errors: result.error?.details?.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) || []
  };
};

/**
 * Validate AI generation request
 */
const validateAIGenerationRequest = (data) => {
  const schema = Joi.object({
    type: Joi.string().valid(...TEMPLATE_TYPES).required(),
    roleId: Joi.number().integer().positive().required(),
    roleName: Joi.string().min(2).max(100).required(),
    numberOfQuestions: Joi.number().integer().min(5).max(50).default(10),
    areas: Joi.array().items(
      Joi.string().valid(...ENGAGEMENT_AREAS)
    ).min(1).default(ENGAGEMENT_AREAS),
    language: Joi.string().valid('it', 'en').default('it')
  });

  const result = schema.validate(data);

  return {
    valid: !result.error,
    errors: result.error?.details?.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) || []
  };
};

/**
 * Validate campaign creation
 */
const validateCampaign = (data) => {
  const schema = Joi.object({
    templateId: Joi.string().uuid().required(),
    name: Joi.string().min(3).max(200).required(),
    startDate: Joi.date().iso().min('now').required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
    frequency: Joi.string().valid('ONCE', 'RECURRING', 'PULSE').required(),
    rrule: Joi.string().when('frequency', {
      is: 'RECURRING',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    targetFilters: Joi.object({
      departments: Joi.array().items(Joi.string()).optional(),
      seniority: Joi.array().items(Joi.string()).optional(),
      projects: Joi.array().items(Joi.string()).optional()
    }).optional(),
    channels: Joi.array().items(
      Joi.string().valid('email', 'webapp', 'slack')
    ).min(1).default(['webapp']),
    reminderConfig: Joi.object({
      enabled: Joi.boolean().default(true),
      intervals: Joi.array().items(Joi.number().integer().positive()).default([3, 7])
    }).optional()
  });

  const result = schema.validate(data);

  return {
    valid: !result.error,
    errors: result.error?.details?.map(d => ({
      field: d.path.join('.'),
      message: d.message
    })) || []
  };
};

/**
 * Sanitize search input
 */
const sanitizeSearchInput = (search) => {
  if (!search || typeof search !== 'string') {
    return '';
  }

  // Remove special characters that could be used for SQL injection
  // Even though Prisma parameterizes, this is an extra safety layer
  return search
    .replace(/[%_]/g, '\\$&')  // Escape SQL wildcards
    .replace(/[<>'"]/g, '')     // Remove potential HTML/SQL chars
    .trim()
    .substring(0, 100);         // Limit length
};

/**
 * Validate pagination parameters
 */
const validatePagination = (query) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('created_at', 'name', 'status', 'updated_at').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  });

  const result = schema.validate(query);
  return result.value; // Returns validated and defaulted values
};

/**
 * Express middleware for validation
 */
const validateRequest = (validationFn) => {
  return (req, res, next) => {
    const validation = validationFn(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    next();
  };
};

module.exports = {
  validateEngagementTemplate,
  validateAIGenerationRequest,
  validateCampaign,
  sanitizeSearchInput,
  validatePagination,
  validateRequest,
  ENGAGEMENT_AREAS,
  TEMPLATE_TYPES,
  FREQUENCIES,
  QUESTION_TYPES
};