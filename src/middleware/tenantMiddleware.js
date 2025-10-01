/**
 * Tenant Middleware
 * Determines tenant context for multi-tenant system
 */

const determineTenant = (req, res, next) => {
    // Extract tenant from header or user context
    req.tenant = {
        id: req.headers['x-tenant-id'] || req.user?.tenantId || '1',
        name: 'default'
    };
    next();
};

module.exports = {
    determineTenant
};