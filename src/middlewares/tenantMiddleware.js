// Middleware to determine and attach tenant to request
const prisma = require("../config/database");

/**
 * Determines the tenant based on user's tenant_id
 * and attaches tenantId to the request
 */
const determineTenant = async (req, res, next) => {
  try {
    // Normalize tenant field to use underscore standard (tenant_id)
    if (req.user && req.user.tenantId && !req.user.tenant_id) {
      req.user.tenant_id = req.user.tenantId;
      console.log('Normalized tenantId to tenant_id for consistency');
    }

    // Check if user has tenant_id (our standard)
    if (req.user && req.user.tenant_id) {
      // Get tenant from database using the user's tenant_id
      const tenant = await prisma.tenants.findFirst({
        where: { id: req.user.tenant_id },
      });

      if (tenant) {
        req.tenantId = tenant.id;
        req.tenant = tenant;
        console.log(
          `User ${req.user?.email} mapped to tenant: ${tenant.name} (from user.tenant_id)`
        );
        next();
        return;
      }
    }

    // Fallback: try to get tenant_id from tenant_users table
    if (req.user && req.user.email) {
      const tenantUser = await prisma.tenant_users.findFirst({
        where: { email: req.user.email },
        include: { tenant: true },
      });

      if (tenantUser && tenantUser.tenant_id) {
        const tenant = await prisma.tenants.findFirst({
          where: { id: tenantUser.tenant_id },
        });

        if (tenant) {
          req.tenantId = tenant.id;
          req.tenant = tenant;
          console.log(
            `User ${req.user?.email} mapped to tenant: ${tenant.name} (from tenant_users)`
          );
          next();
          return;
        }
      }
    }

    // If no tenant found, try default
    const defaultTenant = await prisma.tenants.findFirst({
      where: { slug: "default" },
    });

    if (defaultTenant) {
      req.tenantId = defaultTenant.id;
      req.tenant = defaultTenant;
      console.log(`User ${req.user?.email} mapped to default tenant`);
    } else {
      console.log(`User ${req.user?.email} - no tenant found`);
    }

    next();
  } catch (error) {
    console.error("Error determining tenant:", error);
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
      message: "Unable to determine organization. Please contact support.",
    });
  }
  next();
};

module.exports = {
  determineTenant,
  requireTenant,
};
