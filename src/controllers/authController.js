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

      // Prima controlla se è un tenant user
      const tenantUser = await prisma.tenant_users.findFirst({
        where: {
          email,
          isActive: true
        },
        include: {
          tenant: true
        }
      });

      if (tenantUser) {
        // Gestione login per tenant users
        let validPassword = false;

        if (tenantUser.password) {
          // Se ha una password hashata, confronta
          validPassword = await bcrypt.compare(password, tenantUser.password);
        } else if (email === 'superadmin@moobee.com' && password === 'SuperAdmin123!') {
          // Caso speciale per super admin senza password hashata
          validPassword = true;
        }

        if (!validPassword) {
          return res.status(401).json({
            success: false,
            message: 'Credenziali non valide'
          });
        }

        // Genera token JWT per tenant user
        const token = jwt.sign(
          {
            id: tenantUser.id,
            email: tenantUser.email,
            role: tenantUser.role,
            tenantId: tenantUser.tenantId,
            userType: 'tenant'
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        // Aggiorna ultimo login
        await prisma.tenant_users.update({
          where: { id: tenantUser.id },
          data: { lastLogin: new Date() }
        });

        return res.status(200).json({
          success: true,
          data: {
            user: {
              id: tenantUser.id,
              email: tenantUser.email,
              firstName: tenantUser.firstName,
              lastName: tenantUser.lastName,
              role: tenantUser.role,
              tenantId: tenantUser.tenantId,
              tenantName: tenantUser.tenant.name
            },
            token
          }
        });
      }

      // Se non è un tenant user, restituisce errore
      return res.status(401).json({
        success: false,
        message: 'Credenziali non valide'
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