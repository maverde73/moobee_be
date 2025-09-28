/**
 * Certification Controller
 * @module controllers/certificationController
 * @created 2025-09-27 18:35
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CertificationController {
  /**
   * Get all certifications with filters
   * @route GET /api/certifications
   */
  async getCertifications(req, res) {
    try {
      const {
        category,
        search,
        isActive = 'true',
        level,
        provider,
        page = 1,
        limit = 100
      } = req.query;

      // Build where clause
      const where = {
        is_active: isActive === 'true',
        ...(category && category !== 'ALL' && { category }),
        ...(level && { level }),
        ...(provider && { provider }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { provider: { contains: search, mode: 'insensitive' } }
          ]
        })
      };

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Fetch certifications with pagination
      const [certifications, total] = await Promise.all([
        prisma.certification.findMany({
          where,
          orderBy: [
            { category: 'asc' },
            { name: 'asc' }
          ],
          skip,
          take
        }),
        prisma.certification.count({ where })
      ]);

      res.json({
        success: true,
        data: certifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching certifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch certifications',
        details: error.message
      });
    }
  }

  /**
   * Get single certification by ID
   * @route GET /api/certifications/:id
   */
  async getCertificationById(req, res) {
    try {
      const { id } = req.params;

      const certification = await prisma.certification.findUnique({
        where: { id }
      });

      if (!certification) {
        return res.status(404).json({
          success: false,
          error: 'Certification not found'
        });
      }

      res.json({
        success: true,
        data: certification
      });
    } catch (error) {
      console.error('Error fetching certification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch certification',
        details: error.message
      });
    }
  }

  /**
   * Create new certification
   * @route POST /api/certifications
   */
  async createCertification(req, res) {
    try {
      const {
        code,
        name,
        category = 'CUSTOM',
        level,
        provider,
        description,
        url,
        validity_years
      } = req.body;

      // Validate required fields
      if (!code || !name) {
        return res.status(400).json({
          success: false,
          error: 'Code and name are required'
        });
      }

      // Check if code already exists
      const existing = await prisma.certification.findUnique({
        where: { code }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Certification code already exists'
        });
      }

      // Create certification
      const certification = await prisma.certification.create({
        data: {
          code,
          name,
          category,
          level,
          provider,
          description,
          url,
          validity_years,
          created_by: req.user?.id || null,
          is_active: true
        }
      });

      res.status(201).json({
        success: true,
        data: certification,
        message: 'Certification created successfully'
      });
    } catch (error) {
      console.error('Error creating certification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create certification',
        details: error.message
      });
    }
  }

  /**
   * Update certification
   * @route PUT /api/certifications/:id
   */
  async updateCertification(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated directly
      delete updates.id;
      delete updates.created_at;
      delete updates.created_by;

      // Check if certification exists
      const existing = await prisma.certification.findUnique({
        where: { id }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Certification not found'
        });
      }

      // If changing code, check for duplicates
      if (updates.code && updates.code !== existing.code) {
        const duplicate = await prisma.certification.findUnique({
          where: { code: updates.code }
        });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            error: 'Certification code already exists'
          });
        }
      }

      // Update certification
      const certification = await prisma.certification.update({
        where: { id },
        data: {
          ...updates,
          updated_at: new Date()
        }
      });

      res.json({
        success: true,
        data: certification,
        message: 'Certification updated successfully'
      });
    } catch (error) {
      console.error('Error updating certification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update certification',
        details: error.message
      });
    }
  }

  /**
   * Soft delete certification
   * @route DELETE /api/certifications/:id
   */
  async deleteCertification(req, res) {
    try {
      const { id } = req.params;

      // Check if certification exists
      const existing = await prisma.certification.findUnique({
        where: { id }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Certification not found'
        });
      }

      // Soft delete by setting is_active to false
      await prisma.certification.update({
        where: { id },
        data: {
          is_active: false,
          updated_at: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Certification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting certification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete certification',
        details: error.message
      });
    }
  }

  /**
   * Get certification categories
   * @route GET /api/certifications/categories
   */
  async getCategories(req, res) {
    try {
      const categories = [
        'CLOUD',
        'PROJECT',
        'SECURITY',
        'DEVELOPMENT',
        'DATABASE',
        'BUSINESS',
        'CUSTOM'
      ];

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories'
      });
    }
  }

  /**
   * Get certification levels
   * @route GET /api/certifications/levels
   */
  async getLevels(req, res) {
    try {
      const levels = [
        'FOUNDATION',
        'ASSOCIATE',
        'PROFESSIONAL',
        'EXPERT'
      ];

      res.json({
        success: true,
        data: levels
      });
    } catch (error) {
      console.error('Error fetching levels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch levels'
      });
    }
  }

  /**
   * Get certifications for a specific tenant
   * @route GET /api/certifications/tenant/:tenantId
   */
  async getTenantCertifications(req, res) {
    try {
      const { tenantId } = req.params;

      // Get all active certifications plus tenant-specific customizations
      const [generalCertifications, tenantCertifications] = await Promise.all([
        prisma.certification.findMany({
          where: { is_active: true },
          orderBy: [
            { category: 'asc' },
            { name: 'asc' }
          ]
        }),
        prisma.tenantCertification.findMany({
          where: { tenant_id: tenantId },
          include: {
            certification: true
          }
        })
      ]);

      // Merge tenant customizations with general certifications
      const certificationMap = new Map();

      generalCertifications.forEach(cert => {
        certificationMap.set(cert.id, { ...cert });
      });

      tenantCertifications.forEach(tc => {
        if (certificationMap.has(tc.certification_id)) {
          const cert = certificationMap.get(tc.certification_id);
          cert.customName = tc.custom_name;
          cert.isRequired = tc.is_required;
          cert.priority = tc.priority;
          cert.notes = tc.notes;
        }
      });

      const mergedCertifications = Array.from(certificationMap.values());

      res.json({
        success: true,
        data: mergedCertifications
      });
    } catch (error) {
      console.error('Error fetching tenant certifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tenant certifications',
        details: error.message
      });
    }
  }
}

module.exports = new CertificationController();