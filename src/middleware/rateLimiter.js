/**
 * Rate Limiting Middleware
 * Prevents abuse and DDoS attacks by limiting request rates
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');

/**
 * Create rate limiter with custom configuration
 */
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: options.message || defaults.message,
        retryAfter: req.rateLimit.resetTime
      });
    }
  };

  return rateLimit({ ...defaults, ...options });
};

/**
 * Different rate limiters for different endpoints
 */
const limiters = {
  // Strict limit for auth endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: false
  }),

  // Moderate limit for creation endpoints
  create: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many creation requests, please slow down.'
  }),

  // Standard API limit
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many API requests, please try again later.'
  }),

  // Loose limit for read operations
  read: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests, please try again later.'
  }),

  // Very strict for password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: 'Too many password reset attempts, please try again later.'
  }),

  // File upload limiter
  upload: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many file uploads, please try again later.'
  }),

  // AI/LLM endpoints (expensive operations)
  ai: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 AI requests per hour
    message: 'AI generation limit reached, please try again later.'
  })
};

/**
 * Dynamic rate limiter based on user role
 */
const dynamicRateLimiter = (req, res, next) => {
  // Get user role from JWT or session
  const userRole = req.user?.role || 'guest';

  // Different limits based on role
  const limits = {
    admin: 1000,
    superadmin: 1000,
    manager: 500,
    user: 200,
    guest: 50
  };

  const limiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: limits[userRole] || limits.guest,
    message: `Rate limit exceeded for ${userRole} role.`,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?.id || req.ip;
    }
  });

  limiter(req, res, next);
};

/**
 * Skip rate limiting for certain conditions
 */
const skipRateLimitForWhitelist = (req) => {
  // Whitelist certain IPs (e.g., monitoring services)
  const whitelistedIPs = process.env.WHITELISTED_IPS?.split(',') || [];
  if (whitelistedIPs.includes(req.ip)) {
    return true;
  }

  // Skip for certain user agents (e.g., health checks)
  const userAgent = req.get('User-Agent') || '';
  if (userAgent.includes('HealthCheck') || userAgent.includes('Monitoring')) {
    return true;
  }

  return false;
};

/**
 * Conditional rate limiter
 */
const conditionalRateLimiter = (limiterType = 'api') => {
  const limiter = limiters[limiterType] || limiters.api;

  return (req, res, next) => {
    if (skipRateLimitForWhitelist(req)) {
      return next();
    }
    limiter(req, res, next);
  };
};

/**
 * Reset rate limit for a specific key
 */
const resetRateLimit = async (key) => {
  // This would need Redis or another store implementation
  // For now, it's a placeholder
  console.log(`Rate limit reset requested for key: ${key}`);
};

module.exports = {
  createRateLimiter,
  limiters,
  dynamicRateLimiter,
  conditionalRateLimiter,
  resetRateLimit,
  // Export specific limiters for direct use
  authLimiter: limiters.auth,
  apiLimiter: limiters.api,
  createLimiter: limiters.create,
  readLimiter: limiters.read,
  uploadLimiter: limiters.upload,
  aiLimiter: limiters.ai,
  passwordResetLimiter: limiters.passwordReset
};