const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Unified login endpoint
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password } = req.body;

      // Find user in tenant_users table (now unified for all users)
      const user = await prisma.tenant_users.findFirst({
        where: {
          email,
          is_active: true
        },
        include: {
          tenants: true,
          employees: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              position: true,
              department_id: true
            }
          }
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.locked_until && user.locked_until > new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Account is locked. Please try again later.'
        });
      }

      // Verify password
      let validPassword = false;

      if (user.password_hash) {
        validPassword = await bcrypt.compare(password, user.password_hash);
      } else if (user.password) {
        // Fallback su campo password se password_hash non presente
        validPassword = await bcrypt.compare(password, user.password);
      } else if (email === 'superadmin@moobee.com' && password === 'SuperAdmin123!') {
        // Caso speciale per super admin temporaneo
        validPassword = true;
      }

      if (!validPassword) {
        // Increment failed login count
        await prisma.tenant_users.update({
          where: { id: user.id },
          data: {
            failed_login_count: (user.failed_login_count || 0) + 1,
            locked_until: (user.failed_login_count || 0) >= 4
              ? new Date(Date.now() + 30 * 60 * 1000)
              : null
          }
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user must change password (has password_reset_token)
      const mustChangePassword = !!user.password_reset_token;

      // Reset failed login count on successful login
      await prisma.tenant_users.update({
        where: { id: user.id },
        data: {
          failed_login_count: 0,
          last_login_at: new Date(),
          last_login_ip: req.ip,
          login_count: (user.login_count || 0) + 1
        }
      });

      // Determine redirect based on role and password change requirement
      const getRedirectUrl = (role, mustChangePassword) => {
        if (mustChangePassword) {
          // All users must go to password change page first
          return role === 'super_admin' || role === 'admin'
            ? 'http://localhost:5174/change-password'
            : 'http://localhost:5173/change-password';
        }

        switch(role) {
          case 'super_admin':
          case 'admin':
            return 'http://localhost:5174'; // FE_tenant
          case 'hr':
          case 'employee':
          case 'viewer':
          default:
            return 'http://localhost:5173'; // FE_moobee
        }
      };

      // Generate tokens with comprehensive payload
      // IMPORTANT: Exclude logo from tenant to avoid JWT size issues (431 error)
      const { logo, ...tenantWithoutLogo } = user.tenants || {};

      // Get employee data from relation (Prisma returns single object, not array)
      const employeeData = user.employees || {};
      console.log('[UNIFIED_AUTH] employee_id:', user.employee_id);
      console.log('[UNIFIED_AUTH] employees relation:', employeeData);
      console.log('[UNIFIED_AUTH] first_name:', employeeData.first_name);

      const payload = {
        id: user.id,
        email: user.email,
        // Prioritize employee data (single source of truth)
        firstName: employeeData.first_name || user.first_name || '',
        lastName: employeeData.last_name || user.last_name || '',
        role: user.role,
        tenantId: user.tenant_id,
        tenant: tenantWithoutLogo, // Tenant without logo to keep JWT small
        employeeId: employeeData.id || user.employee_id || null,
        position: employeeData.position || null,
        departmentId: employeeData.department_id || null
      };

      const accessToken = jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h', issuer: 'moobee-unified' }
      );

      const refreshToken = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d', issuer: 'moobee-unified' }
      );

      // Store refresh token
      await prisma.tenant_users.update({
        where: { id: user.id },
        data: {
          refresh_token: refreshToken,
          refresh_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        redirectTo: getRedirectUrl(user.role, mustChangePassword),
        userType: user.role,
        mustChangePassword, // Aggiungi flag per indicare cambio password obbligatorio
        user: {
          id: user.id,
          email: user.email,
          firstName: employeeData.first_name || '',
          lastName: employeeData.last_name || '',
          role: user.role,
          tenantId: user.tenant_id,
          tenant: tenantWithoutLogo, // Use tenant without logo
          employeeId: employeeData.id || user.employee_id || null,
          position: employeeData.position || null,
          departmentId: employeeData.department_id || null
        }
      });
    } catch (error) {
      console.error('Unified login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Refresh token endpoint
router.post('/refresh',
  [
    body('refreshToken').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { refreshToken } = req.body;

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Find user and verify stored refresh token
      const user = await prisma.tenant_users.findUnique({
        where: { id: decoded.id },
        include: {
          tenants: true,
          employees: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              position: true,
              department_id: true
            }
          }
        }
      });

      if (!user || user.refresh_token !== refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Check if refresh token is expired
      if (user.refresh_token_expires_at && user.refresh_token_expires_at < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token expired'
        });
      }

      // Generate new access token
      // IMPORTANT: Exclude logo from tenant to avoid JWT size issues (431 error)
      const { logo, ...tenantWithoutLogo } = user.tenants || {};

      // Get employee data from relation
      const employeeData = user.employees || {};

      const payload = {
        id: user.id,
        email: user.email,
        firstName: employeeData.first_name || '',
        lastName: employeeData.last_name || '',
        role: user.role,
        tenantId: user.tenant_id,
        tenant: tenantWithoutLogo, // Tenant without logo to keep JWT small
        employeeId: employeeData.id || user.employee_id || null,
        position: employeeData.position || null,
        departmentId: employeeData.department_id || null
      };

      const newAccessToken = jwt.sign(
        payload,
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h', issuer: 'moobee-unified' }
      );

      res.json({
        success: true,
        message: 'Token refreshed',
        accessToken: newAccessToken
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        // Clear refresh token
        await prisma.tenant_users.update({
          where: { id: decoded.id },
          data: {
            refresh_token: null,
            refresh_token_expires_at: null
          }
        });
      } catch (error) {
        // Token might be invalid, but we still want to logout
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change password endpoint (for first login or password reset)
router.post('/change-password',
  [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }

      const token = authHeader.substring(7);

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      const { newPassword } = req.body;

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password and clear reset token
      const updatedUser = await prisma.tenant_users.update({
        where: { id: decoded.id },
        data: {
          password_hash: hashedPassword,
          password_reset_token: null,
          password_reset_expires_at: null,
          updated_at: new Date()
        }
      });

      // Note: password is only stored in tenant_users table
      // employees table doesn't have password_hash field

      console.log(`Password changed for user: ${updatedUser.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Verify token endpoint
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
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

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