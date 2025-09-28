/**
 * Middleware per il controllo dei ruoli utente
 * @module checkRole
 */

/**
 * Verifica se l'utente ha uno dei ruoli consentiti
 * @param {Array<string>} allowedRoles - Array dei ruoli consentiti
 * @returns {Function} Middleware Express
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      // Ottieni i ruoli dell'utente
      const userRoles = user.roles || [user.role] || [];

      // Verifica se l'utente ha almeno uno dei ruoli consentiti
      const hasPermission = allowedRoles.some(role =>
        userRoles.includes(role)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Required roles: ${allowedRoles.join(', ')}`,
          userRoles: userRoles
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        error: 'Authorization check failed'
      });
    }
  };
};

/**
 * Middleware per verificare se l'utente è Super Admin
 */
const checkSuperAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const isSuperAdmin = user.role === 'super_admin' ||
                       user.roles?.includes('super_admin');

  if (!isSuperAdmin) {
    return res.status(403).json({
      error: 'Super Admin access required',
      message: 'This endpoint requires Super Admin privileges'
    });
  }

  next();
};

/**
 * Middleware per verificare se l'utente è Admin (Super Admin o Admin)
 */
const checkAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const isAdmin = ['super_admin', 'admin'].some(role =>
    user.role === role || user.roles?.includes(role)
  );

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'This endpoint requires Admin privileges'
    });
  }

  next();
};

/**
 * Middleware per verificare se l'utente è HR
 */
const checkHR = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const allowedRoles = ['super_admin', 'admin', 'hr', 'hr_manager'];
  const hasHRAccess = allowedRoles.some(role =>
    user.role === role || user.roles?.includes(role)
  );

  if (!hasHRAccess) {
    return res.status(403).json({
      error: 'HR access required',
      message: 'This endpoint requires HR privileges'
    });
  }

  next();
};

module.exports = {
  checkRole,
  checkSuperAdmin,
  checkAdmin,
  checkHR
};