const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authController = {
  // Login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email e password sono obbligatori'
        });
      }

      // Find employee by email
      const employee = await prisma.employees.findUnique({
        where: { email },
        include: {
          departments: true,
          employee_roles: {
            include: {
              roles: true
            }
          }
        }
      });

      if (!employee) {
        return res.status(401).json({
          success: false,
          message: 'Credenziali non valide'
        });
      }

      // For demo, check if password matches the demo password
      // In production, you would hash and compare passwords
      const validPassword = password === 'Password123!';
      
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: 'Credenziali non valide'
        });
      }

      // Generate tokens
      const accessToken = jwt.sign(
        {
          id: employee.id,
          email: employee.email,
          tenantId: employee.tenant_id
        },
        process.env.JWT_ACCESS_SECRET || 'your-access-secret',
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        {
          id: employee.id,
          email: employee.email,
          tenantId: employee.tenant_id
        },
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        { expiresIn: '7d' }
      );

      // Return user data and tokens
      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: employee.id,
          email: employee.email,
          firstName: employee.first_name,
          lastName: employee.last_name,
          position: employee.position,
          department: employee.departments?.department_name,
          employeeCode: employee.employee_code,
          isActive: employee.is_active
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Errore interno del server'
      });
    }
  },

  // Refresh token
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token mancante'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
      );

      // Generate new access token
      const accessToken = jwt.sign(
        {
          id: decoded.id,
          email: decoded.email,
          tenantId: decoded.tenantId
        },
        process.env.JWT_ACCESS_SECRET || 'your-access-secret',
        { expiresIn: '15m' }
      );

      res.json({
        success: true,
        accessToken
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        message: 'Token non valido o scaduto'
      });
    }
  },

  // Verify token
  async verify(req, res) {
    try {
      // The auth middleware has already verified the token
      const employee = await prisma.employees.findUnique({
        where: { id: req.user.id },
        include: {
          departments: true
        }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      res.json({
        success: true,
        user: {
          id: employee.id,
          email: employee.email,
          firstName: employee.first_name,
          lastName: employee.last_name,
          position: employee.position,
          department: employee.departments?.department_name
        }
      });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({
        success: false,
        message: 'Errore interno del server'
      });
    }
  },

  // Logout (optional - mainly for cleanup)
  async logout(req, res) {
    // In a JWT system, logout is typically handled client-side
    // by removing the tokens from storage
    res.json({
      success: true,
      message: 'Logout effettuato con successo'
    });
  }
};

module.exports = authController;