/**
 * Validation Middleware
 * Created: September 25, 2025
 *
 * Middleware for request validation using express-validator
 */

const { validationResult } = require('express-validator');

/**
 * Validate request and return errors if any
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }

  next();
};

module.exports = {
  validateRequest
};