/**
 * Role-based Authorization Middleware
 */

const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        // For testing, allow all
        // In production, check user roles against allowedRoles
        next();
    };
};

module.exports = {
    authorize
};