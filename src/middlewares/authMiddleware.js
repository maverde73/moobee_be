const authService = require('../services/authService');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  console.log('=== Authenticate middleware ===');
  console.log('Path:', req.path);
  console.log('Headers:', req.headers.authorization ? 'Has Authorization header' : 'No Authorization header');

  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Bearer token in header');
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Extract token
    const token = authHeader.substring(7);
    console.log('Token extracted, attempting to verify...');

    try {
      // Verify token
      const decoded = authService.verifyAccessToken(token);
      console.log('Token verified successfully. User:', decoded.email, 'Role:', decoded.role);

      // Add user info to request
      req.user = decoded;

      next();
    } catch (error) {
      console.log('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

// Middleware to check specific roles
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Support both formats:
    // 1. Simple role string (from unified auth)
    // 2. Array of role objects (legacy format)
    let hasRole = false;

    if (req.user.role) {
      // Unified auth format: role as string
      const userRole = req.user.role.toUpperCase();
      hasRole = allowedRoles.some(allowed => {
        // Check if allowed is a string before calling toUpperCase
        if (typeof allowed === 'string') {
          return allowed.toUpperCase() === userRole;
        }
        return false;
      });
    } else if (req.user.roles && Array.isArray(req.user.roles)) {
      // Legacy format: roles as array
      hasRole = req.user.roles.some(role =>
        allowedRoles.includes(role.roleName)
      );
    }

    if (!hasRole && allowedRoles.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role || req.user.roles
      });
    }

    next();
  };
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = authService.verifyAccessToken(token);
        req.user = decoded;
      } catch (error) {
        // Token is invalid but we continue anyway
        req.user = null;
      }
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};