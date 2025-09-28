// Rate Limiter Middleware
// Created: 2025-09-26 16:40
// Purpose: Prevent API abuse and rate limiting

const rateLimit = require('express-rate-limit');

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Too many requests for this resource, please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// Campaign assignments specific limiter
const campaignAssignmentsLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // limit to 10 requests per 10 seconds
  message: {
    success: false,
    message: 'Too many requests for campaign data. Please wait a few seconds.',
    retryAfter: 10
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user + IP combination
    const userId = req.user?.id || req.tenantUser?.id || 'anonymous';
    return `${req.ip}_${userId}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Data is cached for 60 seconds, please use cached data.',
      retryAfter: 10
    });
  }
});

module.exports = {
  generalLimiter,
  strictLimiter,
  campaignAssignmentsLimiter
};