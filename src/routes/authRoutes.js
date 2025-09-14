const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const result = await authService.login(email, password);
      
      // Return tokens and user in the expected format
      res.json({
        success: true,
        message: 'Login successful',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.employee.id,
          email: result.employee.email,
          firstName: result.employee.firstName,
          lastName: result.employee.lastName,
          position: result.employee.position || result.employee.roles?.[0]?.roleName || 'Employee',
          department: result.employee.department,
          roles: result.employee.roles
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        message: error.message || 'Credenziali non valide'
      });
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh',
  [
    body('refreshToken').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      const result = await authService.refreshTokens(refreshToken);
      
      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }
);

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  // In production, invalidate the refresh token in Redis/database
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET /api/auth/verify
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyAccessToken(token);
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: decoded,
        expiresAt: new Date(decoded.exp * 1000)
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

module.exports = router;