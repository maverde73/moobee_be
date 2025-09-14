// Middleware to determine and attach tenant to request
const prisma = require('../config/database');

/**
 * Determines the tenant based on user email domain
 * and attaches tenantId to the request
 */
const determineTenant = async (req, res, next) => {
  try {
    let tenantId = null;
    let tenantSlug = null;

    if (req.user && req.user.email) {
      const email = req.user.email.toLowerCase();
      
      // Map email domains to tenant slugs
      if (email.includes('@nexadata.it')) {
        tenantSlug = 'nexadata';
      } 
      // Add more domain mappings here as needed
      // else if (email.includes('@company2.com')) {
      //   tenantSlug = 'company2';
      // }
      
      // If no specific domain match, use default
      if (!tenantSlug) {
        tenantSlug = 'default';
      }

      // Get tenant from database
      const tenant = await prisma.tenants.findFirst({
        where: { slug: tenantSlug }
      });

      if (tenant) {
        tenantId = tenant.id;
        req.tenantId = tenantId;
        req.tenant = tenant;
      } else {
        // If tenant not found, try default
        const defaultTenant = await prisma.tenants.findFirst({
          where: { slug: 'default' }
        });
        
        if (defaultTenant) {
          req.tenantId = defaultTenant.id;
          req.tenant = defaultTenant;
        }
      }
    }

    // Log for debugging
    console.log(`User ${req.user?.email} mapped to tenant: ${req.tenant?.name || 'none'}`);
    
    next();
  } catch (error) {
    console.error('Error determining tenant:', error);
    // Don't fail the request, just continue without tenant
    next();
  }
};

/**
 * Ensures user has a valid tenant
 * Use this for endpoints that require tenant isolation
 */
const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(403).json({
      success: false,
      message: 'Unable to determine organization. Please contact support.'
    });
  }
  next();
};

module.exports = {
  determineTenant,
  requireTenant
};