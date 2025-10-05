const prisma = require('../../config/database');

/**
 * Template Controller - Handles all template CRUD operations
 * Giurelli Standards compliant - Max 50 lines per function
 */
class TemplateController {
  /**
   * Get all assessment templates
   */
  async getAllTemplates(req, res) {
    try {
      const {
        type,
        isActive,
        page = 1,
        limit = 100, // Aumentato per vedere tutti i template
        sortBy = 'createdAt',
        sortOrder = 'desc',
        status = 'all' // Default: mostra tutti
      } = req.query;

      const skip = (page - 1) * limit;
      const where = {};

      // Allow filtering by type if provided
      if (type) {
        where.type = type;
      }

      // Filter by status - Default mostra tutti
      if (status === 'published') {
        where.isActive = true;
      } else if (status === 'draft') {
        where.isActive = false;
      } else if (status === 'all') {
        // Non applica filtro - mostra tutti
      } else if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const [templates, total] = await Promise.all([
        prisma.assessment_templates.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          include: {
            assessment_questions: {
              orderBy: { order: 'asc' },
              include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
            }
          }
        }),
        prisma.assessment_templates.count({ where })
      ]);

      // Format templates for frontend with both original and expected fields
      const formattedTemplates = templates.map(template => ({
        // Original fields
        ...template,
        // Additional fields expected by frontend
        id: template.id,
        title: template.name,
        type: template.type || 'CUSTOM',
        description: template.description,
        status: template.isActive ? 'published' : 'draft',
        questionsCount: template.assessment_questions?.length || 0,
        questions: template.assessment_questions, // Map snake_case to camelCase for frontend
        template: {
          category: template.type || 'CUSTOM',
          name: template.name,
          duration: template.type === 'BIG_FIVE' ? 30 :
                   template.type === 'DISC' ? 25 :
                   template.type === 'BELBIN' ? 20 : 15,
          job_family_id: template.job_family_id || null
        },
        version: template.version || 1,
        createdBy: { email: template.createdBy || 'System' },
        updatedAt: template.updatedAt,
        _count: {
          questions: template.assessment_questions?.length || 0
        },
        // AI config defaults
        aiProvider: template.aiProvider || 'openai',
        aiModel: template.aiModel || 'gpt-4-turbo',
        aiTemperature: template.aiTemperature !== null && template.aiTemperature !== undefined ? (typeof template.aiTemperature === 'number' ? template.aiTemperature : parseFloat(template.aiTemperature)) : 0.7,
        aiMaxTokens: template.aiMaxTokens || 4000,
        aiLanguage: template.aiLanguage || 'it'
      }));

      res.json({
        success: true,
        data: formattedTemplates,
        metadata: {
          totalCount: total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(total / limit),
          hasPrevPage: parseInt(page) > 1
        },
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(req, res) {
    try {
      const { id } = req.params;

      const template = await prisma.assessment_templates.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
          assessment_questions: {
            orderBy: { order: 'asc' },
            include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
          },
          assessment_template_soft_skill: {
            include: {
              soft_skills: true
            }
          },
          job_family: {
            include: {
              job_family_soft_skills: {
                include: {
                  soft_skills: true
                },
                orderBy: { priority: 'asc' }
              }
            }
          }
        }
      });

      // Get selected soft skills from assessment_template_soft_skill
      let selectedSoftSkills = [];
      if (template && template.assessment_template_soft_skill) {
        selectedSoftSkills = template.assessment_template_soft_skill.map(mapping => ({
          id: mapping.soft_skills.id,
          name: mapping.soft_skills.name,
          category: mapping.soft_skills.category
        }));
      }

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Ensure template has AI config defaults and add questions alias with proper mapping
      const templateWithDefaults = {
        ...template,
        questions: template.assessment_questions?.map(q => ({
          ...q,
          questionText: q.text, // Map text to questionText for frontend compatibility
          questionType: q.type, // Map type to questionType
          orderIndex: q.order, // Map order to orderIndex
          options: q.assessment_options?.map(opt => ({
            ...opt,
            text: opt.text,
            value: opt.value
          }))
        })), // Add alias for frontend compatibility
        selected_soft_skill_ids: selectedSoftSkills.map(s => s.id), // IDs of selected soft skills
        selectedSoftSkills: selectedSoftSkills, // Full soft skill objects
        aiProvider: template.aiProvider || 'openai',
        aiModel: template.aiModel || 'gpt-4-turbo',
        aiTemperature: template.aiTemperature !== null && template.aiTemperature !== undefined ? (typeof template.aiTemperature === 'number' ? template.aiTemperature : parseFloat(template.aiTemperature)) : 0.7,
        aiMaxTokens: template.aiMaxTokens || 4000,
        aiLanguage: template.aiLanguage || 'it'
      };

      res.json({ success: true, data: templateWithDefaults });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create new assessment template
   */
  async createTemplate(req, res) {
    try {
      // Debug log to check what's being received
      console.log('🔍 CREATE TEMPLATE REQUEST BODY:', JSON.stringify({
        jobFamilyId: req.body.jobFamilyId,
        job_family_id: req.body.job_family_id,
        selectedSoftSkillIds: req.body.selectedSoftSkillIds,
        selected_soft_skill_ids: req.body.selected_soft_skill_ids,
        name: req.body.name
      }, null, 2));

      const templateData = this._prepareTemplateData(req.body);
      console.log('📦 PREPARED TEMPLATE DATA:', JSON.stringify(templateData, null, 2));

      const questionsData = req.body.questions || [];

      const template = await prisma.assessment_templates.create({
        data: {
          ...templateData,
          createdAt: new Date(), // Explicitly set createdAt
          updatedAt: new Date(), // Explicitly set updatedAt
          assessment_questions: {
            create: questionsData.map((q, index) => ({
              text: q.text || q.questionText, // Support both text and questionText
              type: q.type || q.questionType || 'likert', // Support both type and questionType
              category: q.category,
              order: q.order ?? q.orderIndex ?? index,
              isRequired: q.isRequired ?? true,
              assessment_options: {
                create: (q.options || []).map((opt, optIndex) => ({
                  text: opt.text,
                  value: opt.value,
                  orderIndex: opt.orderIndex ?? optIndex
                }))
              }
            }))
          }
        },
        include: {
          assessment_questions: {
            orderBy: { order: 'asc' },
            include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
          }
        }
      });

      // Save selected soft skills in assessment_template_soft_skill
      // Support both snake_case and camelCase
      const selectedSoftSkillIds = req.body.selected_soft_skill_ids || req.body.selectedSoftSkillIds;
      if (selectedSoftSkillIds && Array.isArray(selectedSoftSkillIds) && selectedSoftSkillIds.length > 0) {
        const softSkillMappings = selectedSoftSkillIds.map(skillId => ({
          templateId: template.id,
          softSkillId: parseInt(skillId, 10),
          questionMappings: {}, // Empty for now, can be populated later
          updatedAt: new Date()
        }));

        await prisma.assessment_template_soft_skill.createMany({
          data: softSkillMappings
        });
      }

      // Ensure template has AI config defaults in response
      const templateWithDefaults = {
        ...template,
        aiProvider: template.aiProvider || 'openai',
        aiModel: template.aiModel || 'gpt-4-turbo',
        aiTemperature: template.aiTemperature !== null && template.aiTemperature !== undefined ? (typeof template.aiTemperature === 'number' ? template.aiTemperature : parseFloat(template.aiTemperature)) : 0.7,
        aiMaxTokens: template.aiMaxTokens || 4000,
        aiLanguage: template.aiLanguage || 'it'
      };

      res.status(201).json({ success: true, data: templateWithDefaults });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const templateData = this._prepareTemplateData(req.body);

      const template = await prisma.assessment_templates.update({
        where: { id: parseInt(id, 10) },
        data: templateData,
        include: {
          assessment_questions: {
            orderBy: { order: 'asc' },
            include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
          }
        }
      });

      // Update selected soft skills in assessment_template_soft_skill
      // Support both snake_case and camelCase
      const selectedSoftSkillIds = req.body.selected_soft_skill_ids || req.body.selectedSoftSkillIds;
      if (selectedSoftSkillIds !== undefined) {
        // Delete existing mappings
        await prisma.assessment_template_soft_skill.deleteMany({
          where: { templateId: template.id }
        });

        // Create new mappings if soft skills are selected
        if (Array.isArray(selectedSoftSkillIds) && selectedSoftSkillIds.length > 0) {
          const softSkillMappings = selectedSoftSkillIds.map(skillId => ({
            templateId: template.id,
            softSkillId: parseInt(skillId, 10),
            questionMappings: {}, // Empty for now, can be populated later
            updatedAt: new Date()
          }));

          await prisma.assessment_template_soft_skill.createMany({
            data: softSkillMappings
          });
        }
      }

      // Ensure template has AI config defaults in response
      const templateWithDefaults = {
        ...template,
        aiProvider: template.aiProvider || 'openai',
        aiModel: template.aiModel || 'gpt-4-turbo',
        aiTemperature: template.aiTemperature !== null && template.aiTemperature !== undefined ? (typeof template.aiTemperature === 'number' ? template.aiTemperature : parseFloat(template.aiTemperature)) : 0.7,
        aiMaxTokens: template.aiMaxTokens || 4000,
        aiLanguage: template.aiLanguage || 'it'
      };

      res.json({ success: true, data: templateWithDefaults });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const templateId = parseInt(id, 10);

      // Prima elimina tutte le relazioni associate usando una transazione
      await prisma.$transaction(async (tx) => {
        // Elimina prima le opzioni di tutte le domande
        await tx.assessment_options.deleteMany({
          where: {
            assessment_questions: {
              templateId: templateId
            }
          }
        });

        // Poi elimina le domande
        await tx.assessment_questions.deleteMany({
          where: {
            templateId: templateId
          }
        });

        // Elimina le selezioni dei tenant
        await tx.tenant_assessment_selections.deleteMany({
          where: {
            templateId: templateId
          }
        });

        // Infine elimina il template
        await tx.assessment_templates.delete({
          where: { id: templateId }
        });
      });

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const original = await prisma.assessment_templates.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
          assessment_questions: {
            include: { assessment_options: true }
          },
          assessment_template_soft_skill: true
        }
      });

      if (!original) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      const duplicatedName = name || `${original.name} (Copy)`;

      const duplicate = await prisma.assessment_templates.create({
        data: {
          name: duplicatedName,
          type: original.type,
          description: original.description,
          instructions: original.instructions,
          suggestedFrequency: original.suggestedFrequency,
          aiPrompt: original.aiPrompt,
          aiModel: original.aiModel,
          job_family_id: original.job_family_id,
          isActive: false,
          assessment_questions: {
            create: original.assessment_questions.map(q => ({
              text: q.text,
              type: q.type,
              category: q.category,
              order: q.order,
              isRequired: q.isRequired,
              assessment_options: {
                create: q.assessment_options.map(opt => ({
                  text: opt.text,
                  value: opt.value,
                  orderIndex: opt.orderIndex
                }))
              }
            }))
          }
        },
        include: {
          assessment_questions: {
            orderBy: { order: 'asc' },
            include: { assessment_options: { orderBy: { orderIndex: 'asc' } } }
          }
        }
      });

      // Duplicate soft skill mappings
      if (original.assessment_template_soft_skill && original.assessment_template_soft_skill.length > 0) {
        const softSkillMappings = original.assessment_template_soft_skill.map(mapping => ({
          templateId: duplicate.id,
          softSkillId: mapping.softSkillId,
          questionMappings: mapping.questionMappings,
          updatedAt: new Date()
        }));

        await prisma.assessment_template_soft_skill.createMany({
          data: softSkillMappings
        });
      }

      res.status(201).json({ success: true, data: duplicate });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Helper: Prepare template data for create/update
   */
  _prepareTemplateData(body) {
    const {
      name,
      type,
      description,
      instructions,
      suggestedFrequency,
      aiPrompt,
      aiModel,
      aiProvider,
      aiTemperature,
      aiMaxTokens,
      aiLanguage,
      isActive,
      job_family_id,
      jobFamilyId  // Support camelCase from frontend
    } = body;

    const data = {};

    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description;
    if (instructions !== undefined) data.instructions = instructions;
    if (suggestedFrequency !== undefined) data.suggestedFrequency = suggestedFrequency;
    if (aiPrompt !== undefined) data.aiPrompt = aiPrompt;
    if (aiModel !== undefined) data.aiModel = aiModel;
    if (aiProvider !== undefined) data.aiProvider = aiProvider;
    if (aiTemperature !== undefined) data.aiTemperature = aiTemperature;
    if (aiMaxTokens !== undefined) data.aiMaxTokens = aiMaxTokens;
    if (aiLanguage !== undefined) data.aiLanguage = aiLanguage;
    if (isActive !== undefined) data.isActive = isActive;

    // Job Family integration - support both snake_case and camelCase
    const jobFamilyValue = job_family_id !== undefined ? job_family_id : jobFamilyId;
    if (jobFamilyValue !== undefined) {
      data.job_family_id = jobFamilyValue ? parseInt(jobFamilyValue, 10) : null;
    }

    return data;
  }
}

module.exports = new TemplateController();