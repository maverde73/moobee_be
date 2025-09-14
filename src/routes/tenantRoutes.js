const express = require('express');
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

// GET /api/tenants - Get all tenants (admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenants.findMany({
      where: {
        is_deleted: false
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      tenants
    });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tenants'
    });
  }
});

// GET /api/tenants/:id - Get tenant by ID (admin only)
router.get('/:id',
  authenticateAdmin,
  [
    param('id').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: {
          id: req.params.id
        }
      });

      if (!tenant || tenant.is_deleted) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      res.json({
        success: true,
        tenant
      });
    } catch (error) {
      console.error('Error fetching tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching tenant'
      });
    }
  }
);

// POST /api/tenants - Create new tenant (admin only)
router.post('/',
  authenticateAdmin,
  [
    body('slug').notEmpty().trim().matches(/^[a-z0-9-]+$/),
    body('name').notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('max_employees').optional().isInt({ min: 1 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        slug,
        name,
        domain,
        email,
        phone,
        vat_number,
        tax_code,
        address_street,
        address_city,
        address_state,
        address_zip,
        address_country,
        subscription_plan = 'basic',
        max_employees = 50
      } = req.body;

      // Check if slug already exists
      const existingTenant = await prisma.tenants.findFirst({
        where: { slug }
      });

      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: 'Slug already exists'
        });
      }

      // Create tenant
      const tenant = await prisma.tenants.create({
        data: {
          id: uuidv4(),
          slug,
          name,
          domain,
          email,
          phone,
          vat_number,
          tax_code,
          address_street,
          address_city,
          address_state,
          address_zip,
          address_country,
          subscription_plan,
          subscription_status: 'active',
          max_employees,
          is_active: true,
          created_by: null, // Admin is not a real employee, so set to null
          updated_by: null // Admin is not a real employee, so set to null
        }
      });

      res.status(201).json({
        success: true,
        message: 'Tenant created successfully',
        tenant
      });
    } catch (error) {
      console.error('Error creating tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating tenant',
        error: error.message
      });
    }
  }
);

// PUT /api/tenants/:id - Update tenant (admin only)
router.put('/:id',
  authenticateAdmin,
  [
    param('id').isUUID(),
    body('slug').optional().trim().matches(/^[a-z0-9-]+$/),
    body('name').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('max_employees').optional().isInt({ min: 1 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tenantId = req.params.id;

      // Check if tenant exists
      const existingTenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!existingTenant || existingTenant.is_deleted) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // If slug is being changed, check if new slug is available
      if (req.body.slug && req.body.slug !== existingTenant.slug) {
        const slugExists = await prisma.tenants.findFirst({
          where: {
            slug: req.body.slug,
            id: { not: tenantId }
          }
        });

        if (slugExists) {
          return res.status(400).json({
            success: false,
            message: 'Slug already exists'
          });
        }
      }

      // Build update data
      const updateData = {
        updated_at: new Date(),
        updated_by: null // Admin is not a real employee, so set to null
      };

      // Only include fields that were provided
      const fields = [
        'slug', 'name', 'domain', 'email', 'phone',
        'vat_number', 'tax_code', 'address_street',
        'address_city', 'address_state', 'address_zip',
        'address_country', 'subscription_plan', 'max_employees',
        'is_active'
      ];

      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      // Update tenant
      const tenant = await prisma.tenants.update({
        where: { id: tenantId },
        data: updateData
      });

      res.json({
        success: true,
        message: 'Tenant updated successfully',
        tenant
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating tenant',
        error: error.message
      });
    }
  }
);

// DELETE /api/tenants/:id - Soft delete tenant (admin only)
router.delete('/:id',
  authenticateAdmin,
  [
    param('id').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tenantId = req.params.id;

      // Check if tenant exists
      const existingTenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!existingTenant || existingTenant.is_deleted) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Soft delete (mark as deleted)
      await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
          is_active: false,
          updated_by: req.admin.id
        }
      });

      res.json({
        success: true,
        message: 'Tenant deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting tenant',
        error: error.message
      });
    }
  }
);

module.exports = router;