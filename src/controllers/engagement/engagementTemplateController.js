/**
 * Engagement Template Controller
 * @module controllers/engagement/engagementTemplateController
 * @created 2025-09-22
 * @description Gestione CRUD per i template di engagement
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');
const { validateEngagementTemplate } = require('../../validators/engagementValidator');

/**
 * Get all engagement templates with filters
 * @route GET /api/engagement/templates
 */
const getTemplates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      roleId,
      type,
      search,
      catalog, // New parameter for catalog view
      tenant_only // New parameter to get only tenant's selected templates
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause - but reset it for tenant_only mode
    let where = {};

    if (!tenant_only || tenant_only !== 'true') {
      where = {
        ...(status && { status }),
        ...(type && { type }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        })
      };
    }

    // For catalog view, show ALL templates (no tenant filter)
    // Otherwise, filter by tenant for normal views
    const isCatalogView = catalog === 'true';
    const isTenantOnly = tenant_only === 'true';
    const tenantId = req.user.tenantId || req.user.tenant_id;

    console.log('DEBUG: getTemplates');
    console.log('  req.user:', JSON.stringify(req.user, null, 2));
    console.log('  tenantId:', tenantId);
    console.log('  isCatalogView:', isCatalogView);
    console.log('  isTenantOnly:', isTenantOnly);

    // If tenant_only is true, get only templates that belong to this tenant via selections
    if (isTenantOnly) {
      // Get template IDs from tenant_engagement_selections
      const selections = await prisma.tenant_engagement_selections.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true
        },
        select: {
          template_id: true
        }
      });

      const templateIds = selections.map(s => s.template_id);

      console.log('DEBUG: tenant_only mode');
      console.log('  tenantId:', tenantId);
      console.log('  selections found:', selections.length);
      console.log('  templateIds:', templateIds);
      console.log('  where clause before:', JSON.stringify(where));

      if (templateIds.length > 0) {
        where.id = { in: templateIds };
        console.log('  where clause after:', JSON.stringify(where));
      } else {
        // No templates selected, return empty result
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        });
      }
    } else if (!isCatalogView && !isTenantOnly && req.user.role !== 'super_admin' && req.user.role !== 'SUPER_ADMIN') {
      // Only apply tenant filter if NOT in tenant_only mode
      if (tenantId) {
        where.tenant_id = tenantId;
      }
    }

    // Get templates and count from database
    const [templates, total] = await Promise.all([
      prisma.engagement_templates.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          questions: {
            include: {
              options: true
            }
          },
          _count: {
            select: {
              campaigns: true,
              questions: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      }),
      prisma.engagement_templates.count({ where })
    ]);

    logger.info(`Retrieved ${templates.length} engagement templates`);

    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching engagement templates', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
};

/**
 * Get single engagement template by ID
 * @route GET /api/engagement/templates/:id
 */
const getTemplateById = async (req, res) => {
  console.log('=== getTemplateById called ===');
  console.log('Template ID:', req.params.id);
  console.log('User:', req.user);

  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;
    console.log('Tenant ID:', tenantId);

    // Check if tenant has selected this template
    const tenantSelection = await prisma.tenant_engagement_selections.findFirst({
      where: {
        tenant_id: tenantId,
        template_id: id,
        is_active: true
      }
    });

    // Find the template if:
    // 1. It's a global template (tenant_id = null)
    // 2. It's owned by this tenant
    // 3. It has been selected by this tenant (in tenant_engagement_selections)
    let template;

    if (tenantSelection) {
      // If tenant has selected this template, get it regardless of owner
      template = await prisma.engagement_templates.findFirst({
        where: { id },
        include: {
          questions: {
            include: {
              options: true
            },
            orderBy: {
              order: 'asc'
            }
          },
          campaigns: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      });
    } else {
      // If no tenant selection, check if it's a global template or owned by this tenant
      template = await prisma.engagement_templates.findFirst({
        where: {
          id,
          OR: [
            { tenant_id: null }, // Global template
            { tenant_id: tenantId } // Owned by this tenant
          ]
        },
        include: {
          questions: {
            include: {
              options: true
            },
            orderBy: {
              order: 'asc'
            }
          },
          campaigns: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      });
    }

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error fetching template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
};

/**
 * Create new engagement template
 * @route POST /api/engagement/templates
 */
const createTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId || req.user.tenant_id || req.body.tenantId;

    // Validate input
    const validation = validateEngagementTemplate(req.body);
    if (!validation.valid) {
      console.log('Validation failed:', validation.errors);
      console.log('Request body:', req.body);
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    const {
      name,
      type,
      roleId,
      description,
      instructions,
      suggestedFrequency,
      questions,
      metadata
    } = req.body;

    // Check if template with this name already exists
    const existing = await prisma.engagement_templates.findFirst({
      where: {
        title: name,
        tenant_id: tenantId
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Template with this name already exists'
      });
    }

    // Create template in database
    const template = await prisma.engagement_templates.create({
      data: {
        title: name,
        type: type || 'CUSTOM',
        category: 'ENGAGEMENT',
        description,
        instructions,
        suggested_frequency: suggestedFrequency || 'MONTHLY',
        created_by: String(userId),
        tenant_id: tenantId,
        status: 'DRAFT',
        // Salva i nuovi campi per ruoli multipli e configurazione AI
        suggested_roles: metadata?.suggestedRoles || null,
        ai_prompt: metadata?.promptUsed || null,
        ai_provider: metadata?.aiProvider || null,
        ai_model: metadata?.aiModel || null,
        metadata: metadata || {
          roleId: roleId ? parseInt(roleId) : null
        },
        questions: {
          create: questions ? questions.map((q, index) => ({
            question_text: q.text,
            question_type: q.type || 'LIKERT',
            order: q.orderIndex || index,
            required: q.isRequired !== false,
            metadata: {
              area: q.area,
              weight: q.weight || 1.0,
              scaleMin: q.scaleMin || 1,
              scaleMax: q.scaleMax || 5,
              code: q.code,
              source: q.source || 'AI_GENERATED'
            },
            options: q.options ? {
              create: q.options.map((opt, idx) => ({
                option_text: opt.text,
                value: opt.value || idx + 1,
                order: idx
              }))
            } : undefined
          })) : []
        }
      },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    logger.info('Created engagement template', {
      templateId: template.id,
      tenantId,
      hasMetadata: !!metadata,
      metadataKeys: metadata ? Object.keys(metadata) : [],
      questionsCount: questions?.length || 0
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    logger.error('Error creating template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
};

/**
 * Update engagement template
 * @route PUT /api/engagement/templates/:id
 */
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if template exists and user has access
    const where = { id };

    if (req.user.role !== 'super_admin') {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      where.tenant_id = tenantId;
    }

    const existing = await prisma.engagement_templates.findFirst({ where });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    if (existing.status === 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify published template. Create a new version instead.'
      });
    }

    // Update template in database
    const updated = await prisma.engagement_templates.update({
      where: { id },
      data: {
        title: updates.name,
        description: updates.description,
        instructions: updates.instructions,
        suggested_frequency: updates.suggestedFrequency,
        // Aggiorna i nuovi campi se presenti nel metadata
        suggested_roles: updates.metadata?.suggestedRoles || undefined,
        ai_prompt: updates.metadata?.promptUsed || undefined,
        ai_provider: updates.metadata?.aiProvider || undefined,
        ai_model: updates.metadata?.aiModel || undefined,
        metadata: updates.metadata || undefined,
        updated_at: new Date()
      },
      include: {
        _count: {
          select: {
            questions: true,
            campaigns: true
          }
        }
      }
    });

    logger.info('Updated engagement template', { templateId: id });

    res.json({
      success: true,
      data: updated,
      message: 'Template updated successfully'
    });
  } catch (error) {
    logger.error('Error updating template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
};

/**
 * Delete engagement template
 * @route DELETE /api/engagement/templates/:id
 */
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check template and its usage
    const where = { id };

    if (req.user.role !== 'super_admin') {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      where.tenant_id = tenantId;
    }

    const template = await prisma.engagement_templates.findFirst({
      where,
      include: {
        _count: {
          select: {
            campaigns: true
          }
        }
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Prevent deletion if template has campaigns
    if (template._count.campaigns > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete template with existing campaigns or responses. Archive it instead.'
      });
    }

    // Delete template and its questions from database
    await prisma.engagement_templates.delete({
      where: { id }
    });

    logger.info('Deleted engagement template', { templateId: id });

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template'
    });
  }
};

/**
 * Duplicate engagement template
 * @route POST /api/engagement/templates/:id/duplicate
 */
const duplicateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get original template
    const where = { id };

    if (req.user.role !== 'super_admin') {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      where.tenant_id = tenantId;
    }

    const original = await prisma.engagement_templates.findFirst({
      where,
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    if (!original) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Create duplicate template
    const tenantId = req.user.tenantId || req.user.tenant_id || original.tenantId;

    const duplicate = await prisma.engagement_templates.create({
      data: {
        title: `${original.title} (Copy)`,
        type: original.type,
        category: original.category,
        role_id: original.role_id,
        description: original.description,
        instructions: original.instructions,
        suggested_frequency: original.suggested_frequency,
        estimated_time: original.estimated_time,
        language: original.language,
        tags: original.tags,
        metadata: original.metadata,
        tenant_id: tenantId,
        created_by: String(userId),
        status: 'DRAFT',
        questions: {
          create: original.questions.map(q => ({
            question_text: q.question_text,
            question_type: q.question_type,
            order: q.order,
            required: q.required,
            metadata: q.metadata,
            options: q.options ? {
              create: q.options.map(opt => ({
                option_text: opt.option_text,
                value: opt.value,
                order: opt.order
              }))
            } : undefined
          }))
        }
      },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    logger.info('Duplicated engagement template', {
      originalId: id,
      duplicateId: duplicate.id
    });

    res.status(201).json({
      success: true,
      data: duplicate,
      message: 'Template duplicated successfully'
    });
  } catch (error) {
    logger.error('Error duplicating template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate template'
    });
  }
};

/**
 * Change template status
 * @route PATCH /api/engagement/templates/:id/status
 */
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Check template exists and user has access
    const where = { id };

    if (req.user.role !== 'super_admin') {
      const tenantId = req.user.tenantId || req.user.tenant_id;
      where.tenant_id = tenantId;
    }

    const existing = await prisma.engagement_templates.findFirst({ where });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Update template status
    const template = await prisma.engagement_templates.update({
      where: { id },
      data: {
        status,
        updated_at: new Date()
      }
    });

    logger.info('Changed template status', { templateId: id, status });

    res.json({
      success: true,
      data: template,
      message: `Template ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    logger.error('Error changing template status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change status'
    });
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  changeStatus
};