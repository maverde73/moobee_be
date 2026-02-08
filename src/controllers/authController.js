const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authController = {
  // Login
  async login(req, res) {
    process.stderr.write('[AUTH] === Login function called ===\n');
    try {
      const { email, password } = req.body;
      process.stderr.write(`[AUTH] Login attempt for: ${email}\n`);

      // Validate input
      if (!email || !password) {
        console.log('[AUTH] Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email e password sono obbligatori'
        });
      }

      // Prima controlla se è un tenant user (con employee data)
      console.log('[AUTH] Querying tenant_users...');
      const tenantUser = await prisma.tenant_users.findFirst({
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
      console.log('[AUTH] tenantUser found:', tenantUser ? 'YES' : 'NO');

      if (tenantUser) {
        console.log('[AUTH] tenantUser.id:', tenantUser.id);
        console.log('[AUTH] tenantUser.role:', tenantUser.role);
        console.log('[AUTH] tenantUser.tenant_id:', tenantUser.tenant_id);
        console.log('[AUTH] has password:', !!tenantUser.password);
        console.log('[AUTH] has tenants relation:', !!tenantUser.tenants);

        // Gestione login per tenant users
        let validPassword = false;

        if (tenantUser.password) {
          // Se ha una password hashata, confronta
          console.log('[AUTH] Comparing password with bcrypt...');
          validPassword = await bcrypt.compare(password, tenantUser.password);
          console.log('[AUTH] Password valid:', validPassword);
        } else if (email === 'superadmin@moobee.com' && password === 'SuperAdmin123!') {
          // Caso speciale per super admin senza password hashata
          console.log('[AUTH] SuperAdmin special case');
          validPassword = true;
        }

        if (!validPassword) {
          console.log('[AUTH] Invalid password, returning 401');
          return res.status(401).json({
            success: false,
            message: 'Credenziali non valide'
          });
        }
        console.log('[AUTH] Password validated, proceeding...');

        // Get employee data from relation
        const employeeData = tenantUser.employees || {};
        console.log('[AUTH] tenantUser.employee_id:', tenantUser.employee_id);
        console.log('[AUTH] tenantUser.employees:', employeeData);
        console.log('[AUTH] first_name from employee:', employeeData.first_name);

        // Genera token JWT per tenant user (with employee data)
        const token = jwt.sign(
          {
            id: tenantUser.id,
            email: tenantUser.email,
            firstName: employeeData.first_name || '',
            lastName: employeeData.last_name || '',
            role: tenantUser.role,
            tenantId: tenantUser.tenant_id,
            employeeId: employeeData.id || null,
            position: employeeData.position || null,
            departmentId: employeeData.department_id || null,
            userType: 'tenant'
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        // Aggiorna ultimo login
        console.log('[AUTH] Updating last_login_at...');
        await prisma.tenant_users.update({
          where: { id: tenantUser.id },
          data: { last_login_at: new Date() }
        });
        console.log('[AUTH] last_login_at updated successfully');

        console.log('[AUTH] Login successful, returning response');
        return res.status(200).json({
          success: true,
          data: {
            user: {
              id: tenantUser.id,
              email: tenantUser.email,
              firstName: employeeData.first_name || '',
              lastName: employeeData.last_name || '',
              role: tenantUser.role,
              tenantId: tenantUser.tenant_id,
              employeeId: employeeData.id || null,
              position: employeeData.position || null,
              tenantName: tenantUser.tenants?.name || 'Default'
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
      // Use process.stderr.write for immediate output on Railway
      process.stderr.write(`[AUTH] ❌ Login error: ${error.message}\n`);
      process.stderr.write(`[AUTH] ❌ Error name: ${error.name}\n`);
      process.stderr.write(`[AUTH] ❌ Stack: ${error.stack}\n`);
      console.error('[AUTH] ❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      res.status(500).json({
        success: false,
        message: 'Internal server error'
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