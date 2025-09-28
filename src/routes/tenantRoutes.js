const express = require('express');
const prisma = require('../config/database');
const { requireAdmin } = require('../middlewares/unifiedAuth');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== VALIDATION ERRORS ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
    console.log('=========================');

    return res.status(400).json({
      success: false,
      message: `Validation error: ${errors.array().map(e => `${e.param}: ${e.msg}`).join(', ')}`,
      errors: errors.array()
    });
  }
  next();
};

// GET /api/tenants - Get all tenants (admin only)
router.get('/', requireAdmin, async (req, res) => {
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

// GET /api/tenants/:id - Get tenant by ID
// Allow access for admin, super_admin, or users from the same tenant
router.get('/:id',
  [
    param('id').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Extract token to verify user
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      let decoded;
      try {
        decoded = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      const tenantId = req.params.id;

      // Check authorization: either admin/super_admin OR user belongs to this tenant
      const isAdmin = decoded.role === 'admin' || decoded.role === 'super_admin';
      const belongsToTenant = decoded.tenantId === tenantId || decoded.tenant_id === tenantId;

      if (!isAdmin && !belongsToTenant) {
        console.log('Access denied - User:', {
          role: decoded.role,
          userTenant: decoded.tenantId || decoded.tenant_id,
          requestedTenant: tenantId
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const tenant = await prisma.tenants.findUnique({
        where: {
          id: tenantId
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
        data: tenant  // Changed from 'tenant' to 'data' for consistency
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
  requireAdmin,
  [
    body('slug').notEmpty().trim().matches(/^[a-z0-9-]+$/),
    body('name').notEmpty().trim(),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('max_employees').optional().isInt({ min: 1 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Log received payload from frontend
      console.log('=== BACKEND RECEIVED FROM FRONTEND ===');
      console.log('Headers:', req.headers);
      console.log('Body received:', JSON.stringify(req.body, null, 2));
      console.log('======================================');

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
  requireAdmin,
  [
    param('id').isUUID(),
    body('slug').optional().trim().matches(/^[a-z0-9-]+$/),
    body('name').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('max_employees').optional().isInt({ min: 1 }),
    body('logo').optional().isString()
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
        updatedAt: new Date(),
        updated_by: null // Admin is not a real employee, so set to null
      };

      // Only include fields that were provided
      const fields = [
        'slug', 'name', 'domain', 'email', 'phone',
        'vat_number', 'tax_code', 'address_street',
        'address_city', 'address_state', 'address_zip',
        'address_country', 'subscription_plan', 'max_employees',
        'is_active', 'logo'
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

// PUT /api/tenants/:id/logo - Upload logo for tenant (admin only)
router.put('/:id/logo',
  requireAdmin,
  [
    param('id').isUUID(),
    body('logo').notEmpty().withMessage('Logo data is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tenantId = req.params.id;
      const { logo } = req.body;

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

      // Update logo
      const tenant = await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          logo,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Logo uploaded successfully',
        tenant
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading logo',
        error: error.message
      });
    }
  }
);

// DELETE /api/tenants/:id - Soft delete tenant (admin only)
router.delete('/:id',
  requireAdmin,
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

// GET /api/tenants/:id/engagement-selections - Get tenant's selected engagement templates
router.get('/:id/engagement-selections',
  [
    param('id').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Extract token to verify user
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      let decoded;
      try {
        decoded = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      const tenantId = req.params.id;

      // Check authorization: either admin/super_admin OR user belongs to this tenant
      const isAdmin = decoded.role === 'admin' || decoded.role === 'super_admin';
      const belongsToTenant = decoded.tenantId === tenantId || decoded.tenant_id === tenantId;

      if (!isAdmin && !belongsToTenant) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Get tenant's engagement selections
      const selections = await prisma.tenant_engagement_selections.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        include: {
          template: {
            include: {
              questions: true
            }
          }
        },
        orderBy: {
          selected_at: 'desc'
        }
      });

      res.json({
        success: true,
        data: selections
      });
    } catch (error) {
      console.error('Error fetching engagement selections:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching engagement selections'
      });
    }
  }
);

// POST /api/tenants/:id/engagement-selections - Add engagement template to tenant
router.post('/:id/engagement-selections',
  [
    param('id').isUUID(),
    body('template_id').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Extract token to verify user
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      let decoded;
      try {
        decoded = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      const tenantId = req.params.id;
      const { template_id } = req.body;

      // Check authorization: either admin/super_admin OR HR/HR_Manager from this tenant
      const isAdmin = decoded.role === 'admin' || decoded.role === 'super_admin';
      const isHR = ['hr', 'hr_manager', 'manager'].includes(decoded.role?.toLowerCase());
      const belongsToTenant = decoded.tenantId === tenantId || decoded.tenant_id === tenantId;

      if (!isAdmin && !(isHR && belongsToTenant)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if template exists
      const template = await prisma.engagement_templates.findUnique({
        where: { id: template_id }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Check if selection already exists
      const existingSelection = await prisma.tenant_engagement_selections.findUnique({
        where: {
          tenant_id_template_id: {
            tenant_id: tenantId,
            template_id: template_id
          }
        }
      });

      if (existingSelection) {
        // If exists but inactive, reactivate it
        if (!existingSelection.is_active) {
          const updated = await prisma.tenant_engagement_selections.update({
            where: { id: existingSelection.id },
            data: {
              is_active: true,
              selected_at: new Date(),
              selected_by: decoded.id
            }
          });

          return res.json({
            success: true,
            message: 'Engagement template reactivated',
            data: updated
          });
        }

        return res.status(400).json({
          success: false,
          message: 'Template already selected'
        });
      }

      // Create new selection
      const selection = await prisma.tenant_engagement_selections.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          template_id: template_id,
          is_active: true,
          selected_by: decoded.id
        }
      });

      res.status(201).json({
        success: true,
        message: 'Engagement template selected',
        data: selection
      });
    } catch (error) {
      console.error('Error selecting engagement template:', error);
      res.status(500).json({
        success: false,
        message: 'Error selecting engagement template'
      });
    }
  }
);

// DELETE /api/tenants/:id/engagement-selections/:templateId - Remove engagement template from tenant
router.delete('/:id/engagement-selections/:templateId',
  [
    param('id').isUUID(),
    param('templateId').isUUID()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Extract token to verify user
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      let decoded;
      try {
        decoded = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      const tenantId = req.params.id;
      const templateId = req.params.templateId;

      // Check authorization: either admin/super_admin OR HR/HR_Manager from this tenant
      const isAdmin = decoded.role === 'admin' || decoded.role === 'super_admin';
      const isHR = ['hr', 'hr_manager', 'manager'].includes(decoded.role?.toLowerCase());
      const belongsToTenant = decoded.tenantId === tenantId || decoded.tenant_id === tenantId;

      if (!isAdmin && !(isHR && belongsToTenant)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Find and deactivate selection (soft delete)
      const selection = await prisma.tenant_engagement_selections.findUnique({
        where: {
          tenant_id_template_id: {
            tenant_id: tenantId,
            template_id: templateId
          }
        }
      });

      if (!selection) {
        return res.status(404).json({
          success: false,
          message: 'Selection not found'
        });
      }

      // Soft delete by setting is_active to false
      await prisma.tenant_engagement_selections.update({
        where: { id: selection.id },
        data: {
          is_active: false
        }
      });

      res.json({
        success: true,
        message: 'Engagement template deselected'
      });
    } catch (error) {
      console.error('Error deselecting engagement template:', error);
      res.status(500).json({
        success: false,
        message: 'Error deselecting engagement template'
      });
    }
  }
);

module.exports = router;