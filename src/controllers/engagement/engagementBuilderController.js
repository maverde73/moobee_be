/**
 * Engagement Assessment Builder Controller
 * @module controllers/engagement/engagementBuilderController
 * @created 2025-09-29
 * @description Controller for engagement assessment builder functionality
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

/**
 * Get role-based engagement suggestions
 * @route GET /api/engagement/suggestions/role/:roleId
 */
const getRoleSuggestions = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Mock suggestions based on role - in real implementation this would
    // be based on data analysis, AI models, or predefined rules
    const suggestions = [
      {
        moduleId: 'motivazione',
        questionIds: [1, 3, 5, 7, 9],
        reason: 'Essential UWES dimensions for measuring engagement',
        priority: 'high',
        confidence: 0.9
      },
      {
        moduleId: 'leadership',
        questionIds: [17, 18, 20, 21],
        reason: 'Leadership perception critical for this role',
        priority: 'high',
        confidence: 0.85
      },
      {
        moduleId: 'comunicazione',
        questionIds: [10, 12, 14, 16],
        reason: 'Communication effectiveness important for role success',
        priority: 'medium',
        confidence: 0.8
      },
      {
        moduleId: 'crescita',
        questionIds: [38, 39, 41, 44],
        reason: 'Career development focus for advancement opportunities',
        priority: 'medium',
        confidence: 0.75
      }
    ];

    // TODO: Implement actual role-based logic
    // This could involve:
    // 1. Analyzing historical engagement data for similar roles
    // 2. Using AI to determine most relevant questions
    // 3. Consulting predefined role-question mappings
    // 4. Considering industry standards

    logger.info('Generated role suggestions', {
      roleId,
      suggestionsCount: suggestions.length
    });

    res.json({
      success: true,
      data: suggestions,
      metadata: {
        roleId,
        generatedAt: new Date().toISOString(),
        algorithm: 'rule-based-v1'
      }
    });
  } catch (error) {
    logger.error('Error getting role suggestions', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get role suggestions'
    });
  }
};

/**
 * Create engagement template with builder data
 * @route POST /api/engagement/builder/templates
 */
const createBuilderTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
      selectedModules,
      moduleOrder,
      selectedQuestions,
      questionOrder,
      customQuestions,
      roleId,
      frequency = 'monthly',
      status = 'DRAFT'
    } = req.body;

    const tenantId = req.user.tenantId || req.user.tenant_id;
    const createdBy = req.user.userId || req.user.id;

    // Validate required fields
    if (!name || !selectedModules || selectedModules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name and at least one module are required'
      });
    }

    // Count total questions
    const totalQuestions = Object.values(selectedQuestions || {})
      .flat()
      .length;

    if (totalQuestions < 5) {
      return res.status(400).json({
        success: false,
        error: 'At least 5 questions must be selected'
      });
    }

    // Create template
    const template = await prisma.engagement_templates.create({
      data: {
        title: name,
        name: name,
        description: description || '',
        type: 'CUSTOM',
        status: status.toUpperCase(),
        suggested_frequency: frequency,
        tenant_id: tenantId,
        created_by: createdBy,
        is_active: status.toUpperCase() === 'PUBLISHED',
        is_public: false,
        metadata: {
          builderConfig: {
            selectedModules,
            moduleOrder,
            selectedQuestions,
            questionOrder,
            customQuestions,
            roleId,
            totalQuestions,
            createdWith: 'engagement-builder-v1'
          }
        },
        created_at: new Date(),
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

    // TODO: Create questions based on selectedQuestions and customQuestions
    // This would involve:
    // 1. Creating engagement_questions records
    // 2. Setting proper order and metadata
    // 3. Handling custom questions

    logger.info('Created engagement template via builder', {
      templateId: template.id,
      createdBy,
      totalQuestions
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Engagement template created successfully'
    });
  } catch (error) {
    logger.error('Error creating builder template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
};

/**
 * Update engagement template with builder data
 * @route PUT /api/engagement/builder/templates/:id
 */
const updateBuilderTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      selectedModules,
      moduleOrder,
      selectedQuestions,
      questionOrder,
      customQuestions,
      roleId,
      frequency,
      status
    } = req.body;

    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Check if template exists and user has permission
    const where = { id };
    if (req.user.role !== 'super_admin') {
      where.tenant_id = tenantId;
    }

    const existingTemplate = await prisma.engagement_templates.findFirst({
      where
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Count total questions
    const totalQuestions = Object.values(selectedQuestions || {})
      .flat()
      .length;

    // Update template
    const updated = await prisma.engagement_templates.update({
      where: { id },
      data: {
        ...(name && { title: name, name }),
        ...(description !== undefined && { description }),
        ...(frequency && { suggested_frequency: frequency }),
        ...(status && {
          status: status.toUpperCase(),
          is_active: status.toUpperCase() === 'PUBLISHED'
        }),
        metadata: {
          ...existingTemplate.metadata,
          builderConfig: {
            selectedModules,
            moduleOrder,
            selectedQuestions,
            questionOrder,
            customQuestions,
            roleId,
            totalQuestions,
            lastUpdated: new Date().toISOString(),
            updatedWith: 'engagement-builder-v1'
          }
        },
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

    logger.info('Updated engagement template via builder', {
      templateId: id,
      updatedBy: req.user.userId || req.user.id
    });

    res.json({
      success: true,
      data: updated,
      message: 'Template updated successfully'
    });
  } catch (error) {
    logger.error('Error updating builder template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
};

/**
 * Get template builder configuration
 * @route GET /api/engagement/builder/templates/:id
 */
const getBuilderTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    // Check access permissions
    const where = { id };
    if (req.user.role !== 'super_admin') {
      where.tenant_id = tenantId;
    }

    const template = await prisma.engagement_templates.findFirst({
      where,
      include: {
        _count: {
          select: {
            questions: true,
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

    // Extract builder configuration from metadata
    const builderConfig = template.metadata?.builderConfig || {};

    const response = {
      id: template.id,
      name: template.name,
      description: template.description,
      status: template.status,
      frequency: template.suggested_frequency,
      ...builderConfig,
      _count: template._count,
      created_at: template.created_at,
      updated_at: template.updated_at
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Error getting builder template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template'
    });
  }
};

/**
 * Validate template configuration
 * @route POST /api/engagement/builder/validate
 */
const validateTemplate = async (req, res) => {
  try {
    const {
      name,
      selectedModules,
      selectedQuestions
    } = req.body;

    const errors = [];
    const warnings = [];

    // Validate required fields
    if (!name || name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!selectedModules || selectedModules.length === 0) {
      errors.push('At least one module must be selected');
    }

    // Count total questions
    const totalQuestions = Object.values(selectedQuestions || {})
      .flat()
      .length;

    if (totalQuestions < 5) {
      errors.push('At least 5 questions must be selected');
    }

    // Warnings
    if (totalQuestions > 50) {
      warnings.push('Template has many questions, consider reducing for better completion rates');
    }

    if (selectedModules && selectedModules.length > 5) {
      warnings.push('Many modules selected, consider focusing on core areas');
    }

    // Check for balanced question distribution
    if (selectedQuestions) {
      const distributions = Object.entries(selectedQuestions).map(([moduleId, questions]) => ({
        moduleId,
        count: questions.length
      }));

      const maxQuestions = Math.max(...distributions.map(d => d.count));
      const minQuestions = Math.min(...distributions.map(d => d.count));

      if (maxQuestions - minQuestions > 10) {
        warnings.push('Uneven question distribution across modules');
      }
    }

    const isValid = errors.length === 0;

    res.json({
      success: true,
      data: {
        isValid,
        errors,
        warnings,
        stats: {
          totalQuestions,
          moduleCount: selectedModules?.length || 0,
          estimatedTime: Math.ceil(totalQuestions * 1.5) // 1.5 minutes per question
        }
      }
    });
  } catch (error) {
    logger.error('Error validating template', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate template'
    });
  }
};

/**
 * Preview template as it would appear to respondents
 * @route POST /api/engagement/builder/preview
 */
const previewTemplate = async (req, res) => {
  try {
    const {
      selectedModules,
      selectedQuestions,
      questionOrder
    } = req.body;

    // Mock engagement modules data (this would come from a data file or database)
    const engagementModulesData = {
      motivazione: {
        id: 'motivazione',
        titolo: "Motivazione (UWES)",
        icon: "🔥",
        domande: [
          { id: 1, testo: "Nel mio lavoro mi sento pieno/a di energia", dimensione: "Vigore" },
          { id: 2, testo: "Anche quando le cose si fanno difficili, continuo a impegnarmi", dimensione: "Vigore" },
          // ... more questions
        ]
      },
      // ... other modules
    };

    const preview = selectedModules.map(moduleId => {
      const module = engagementModulesData[moduleId];
      if (!module) return null;

      const moduleQuestions = selectedQuestions[moduleId] || [];
      const questions = module.domande
        .filter(q => moduleQuestions.includes(q.id))
        .sort((a, b) => {
          const orderA = questionOrder[moduleId]?.indexOf(a.id) ?? 999;
          const orderB = questionOrder[moduleId]?.indexOf(b.id) ?? 999;
          return orderA - orderB;
        });

      return {
        moduleId,
        title: module.titolo,
        icon: module.icon,
        questions: questions.map((q, index) => ({
          id: q.id,
          text: q.testo,
          dimension: q.dimensione,
          order: index + 1,
          type: 'likert',
          scale: { min: 1, max: 5 }
        }))
      };
    }).filter(Boolean);

    res.json({
      success: true,
      data: {
        preview,
        metadata: {
          totalQuestions: preview.reduce((sum, module) => sum + module.questions.length, 0),
          estimatedTime: preview.reduce((sum, module) => sum + module.questions.length, 0) * 1.5,
          modules: preview.length
        }
      }
    });
  } catch (error) {
    logger.error('Error generating template preview', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
};

module.exports = {
  getRoleSuggestions,
  createBuilderTemplate,
  updateBuilderTemplate,
  getBuilderTemplate,
  validateTemplate,
  previewTemplate
};