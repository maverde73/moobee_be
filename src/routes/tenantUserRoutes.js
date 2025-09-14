const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticateAdmin } = require('./adminRoutes');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

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

      if (!tenant || tenant.is_deleted) {
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
        select: {
          id: true,
          tenant_id: true,
          email: true,
          first_name: true,
          last_name: true,
          position: true,
          department_id: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          departments_employees_department_idTodepartments: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          first_name: 'asc'
        }
      });

      // Format the response to include department name
      const formattedUsers = users.map(user => ({
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        position: user.position,
        department: user.departments_employees_department_idTodepartments?.name || null,
        department_id: user.department_id,
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
    param('userId').isInt()
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
        select: {
          id: true,
          tenant_id: true,
          email: true,
          first_name: true,
          last_name: true,
          position: true,
          department_id: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          departments_employees_department_idTodepartments: {
            select: {
              name: true
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

      // Format the response to include department name
      const formattedUser = {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        position: user.position,
        department: user.departments_employees_department_idTodepartments?.name || null,
        department_id: user.department_id,
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

// POST /api/tenants/:tenantId/users - Create new user (admin only)
// NOTA: Temporaneamente disabilitato - schema employees non supporta password management
router.post('/tenants/:tenantId/users_disabled',
  authenticateAdmin,
  [
    param('tenantId').isUUID(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('position').optional().trim(),
    body('department').optional().trim(),
    body('role').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const {
        email,
        password,
        first_name,
        last_name,
        position,
        department,
        role,
        is_active = true
      } = req.body;

      // Verify tenant exists
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!tenant || tenant.is_deleted) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Check if email already exists
      const existingUser = await prisma.employees.findFirst({
        where: { 
          email,
          tenant_id: tenantId
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists for this tenant'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.employees.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          email,
          password_hash: hashedPassword,
          first_name,
          last_name,
          position,
          department,
          role,
          is_active,
          created_by: null, // Admin is not a real employee
          updated_by: null
        },
        select: {
          id: true,
          tenant_id: true,
          email: true,
          first_name: true,
          last_name: true,
          position: true,
          department: true,
          role: true,
          is_active: true,
          created_at: true,
          updated_at: true
        }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: error.message
      });
    }
  }
);

// PUT /api/tenants/:tenantId/users/:userId - Update user (admin only)
router.put('/tenants/:tenantId/users/:userId',
  authenticateAdmin,
  [
    param('tenantId').isUUID(),
    param('userId').isUUID(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('first_name').optional().trim(),
    body('last_name').optional().trim(),
    body('position').optional().trim(),
    body('department').optional().trim(),
    body('role').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tenantId, userId } = req.params;

      // Check if user exists
      const existingUser = await prisma.employees.findFirst({
        where: {
          id: userId,
          tenant_id: tenantId,
          is_deleted: false
        }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // If email is being changed, check if new email is available
      if (req.body.email && req.body.email !== existingUser.email) {
        const emailExists = await prisma.employees.findFirst({
          where: {
            email: req.body.email,
            tenant_id: tenantId,
            id: { not: userId }
          }
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists for this tenant'
          });
        }
      }

      // Build update data
      const updateData = {
        updated_at: new Date(),
        updated_by: null // Admin is not a real employee
      };

      // Only include fields that were provided
      const fields = [
        'email', 'first_name', 'last_name', 'position',
        'department', 'role', 'is_active'
      ];

      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      // If password is provided, hash it
      if (req.body.password) {
        updateData.password_hash = await bcrypt.hash(req.body.password, 10);
      }

      // Update user
      const user = await prisma.employees.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          tenant_id: true,
          email: true,
          first_name: true,
          last_name: true,
          position: true,
          department: true,
          role: true,
          is_active: true,
          created_at: true,
          updated_at: true
        }
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user',
        error: error.message
      });
    }
  }
);

// DELETE /api/tenants/:tenantId/users/:userId - Delete user (admin only)
router.delete('/tenants/:tenantId/users/:userId',
  authenticateAdmin,
  [
    param('tenantId').isUUID(),
    param('userId').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tenantId, userId } = req.params;

      // Check if user exists
      const existingUser = await prisma.employees.findFirst({
        where: {
          id: userId,
          tenant_id: tenantId,
          is_deleted: false
        }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Soft delete user
      await prisma.employees.update({
        where: { id: userId },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          updated_by: null // Admin is not a real employee
        }
      });

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error.message
      });
    }
  }
);

module.exports = router;