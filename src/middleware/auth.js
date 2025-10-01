/**
 * Basic Authentication Middleware
 * Placeholder for testing - replace with actual JWT auth in production
 */

// Basic authentication middleware for testing
const authenticate = (req, res, next) => {
    // For testing, skip authentication
    // In production, implement JWT validation here
    req.user = {
        id: 'test-user',
        tenantId: '1'
    };
    next();
};

// Export middleware
module.exports = {
    authenticate
};