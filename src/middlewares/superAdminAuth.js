/**
 * Super Admin Authorization Middleware
 * Date: 10 October 2025
 *
 * Purpose: Restrict access to endpoints that should only be accessible by super admins
 * with cross-tenant visibility
 */

/**
 * Require Super Admin role
 * Must be used AFTER authenticate middleware
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
const requireSuperAdmin = (req, res, next) => {
  // Check if user is authenticated (should have req.user from authenticate middleware)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { role, isSuperAdmin } = req.user;

  // Check for super admin role
  // Support both direct role check and isSuperAdmin flag
  const isSuperAdminRole = role === 'SUPER_ADMIN' || role === 'super_admin';

  if (!isSuperAdminRole && !isSuperAdmin) {
    console.warn(`[Super Admin Auth] Access denied for user: ${req.user.email} (role: ${role})`);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super admin role required.'
    });
  }

  console.log(`[Super Admin Auth] ✅ Access granted for super admin: ${req.user.email}`);
  next();
};

module.exports = { requireSuperAdmin };
