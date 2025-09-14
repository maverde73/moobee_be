const express = require('express');
const prisma = require('../config/database');
const { authenticateAdmin } = require('./adminRoutes');
const { param, validationResult } = require('express-validator');

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

// GET /api/tenants/:tenantId/users - Get all users for a tenant (admin only)
router.get('/tenants/:tenantId/users', 
  authenticateAdmin,
  [param('tenantId').isUUID()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Get all employees for this tenant
      const users = await prisma.employees.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        include: {
          departments_employees_department_idTodepartments: {
            select: {
              department_name: true
            }
          }
        },
        orderBy: {
          first_name: 'asc'
        }
      });

      // Format the response
      const formattedUsers = users.map(user => ({
        id: user.id.toString(), // Convert to string for frontend compatibility
        tenant_id: user.tenant_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        position: user.position,
        department: user.departments_employees_department_idTodepartments?.department_name || null,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      }));

      res.json({
        success: true,
        users: formattedUsers
      });
    } catch (error) {
      console.error('Error fetching tenant users:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }
  }
);

// GET /api/tenants/:tenantId/users/:userId - Get single user (admin only)
router.get('/tenants/:tenantId/users/:userId',
  authenticateAdmin,
  [
    param('tenantId').isUUID(),
    param('userId').isNumeric()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tenantId, userId } = req.params;

      const user = await prisma.employees.findFirst({
        where: {
          id: parseInt(userId),
          tenant_id: tenantId,
          is_active: true
        },
        include: {
          departments_employees_department_idTodepartments: {
            select: {
              department_name: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Format the response
      const formattedUser = {
        id: user.id.toString(),
        tenant_id: user.tenant_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        position: user.position,
        department: user.departments_employees_department_idTodepartments?.department_name || null,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      res.json({
        success: true,
        user: formattedUser
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user',
        error: error.message
      });
    }
  }
);

// Placeholder endpoints for create/update/delete
// These would need proper implementation with password management

router.post('/tenants/:tenantId/users', authenticateAdmin, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Create user functionality not yet implemented - requires password management system'
  });
});

router.put('/tenants/:tenantId/users/:userId', authenticateAdmin, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Update user functionality not yet implemented - requires password management system'
  });
});

router.delete('/tenants/:tenantId/users/:userId', authenticateAdmin, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Delete user functionality not yet implemented - requires soft delete system'
  });
});

module.exports = router;