const jwt = require('jsonwebtoken');

// Unified authentication middleware for tenant users
const authenticateTenantUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Store user info in request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Middleware to check if user is admin or super_admin
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('No token provided in requireAdmin');
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    console.log('Token received in requireAdmin:', token.substring(0, 20) + '...');
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    console.log('Decoded token:', { id: decoded.id, role: decoded.role, tenant_id: decoded.tenant_id });

    // Check if user has admin or super_admin role
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      console.log('Access denied - role:', decoded.role);
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    req.user = decoded;
    req.admin = decoded; // For backward compatibility
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Middleware to check if user is super_admin only
const requireSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Check if user is super_admin
    if (decoded.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    req.user = decoded;
    req.admin = decoded; // For backward compatibility
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Middleware to check if user belongs to a specific tenant
const requireTenantAccess = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Super admin can access all tenants
    if (decoded.role === 'super_admin') {
      req.user = decoded;
      return next();
    }

    // Check if user belongs to the requested tenant
    const requestedTenantId = req.params.tenantId || req.params.id;
    if (requestedTenantId && decoded.tenantId !== requestedTenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this tenant'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

module.exports = {
  authenticateTenantUser,
  requireAdmin,
  requireSuperAdmin,
  requireTenantAccess
};