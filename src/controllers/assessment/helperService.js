const prisma = require('../../config/database');

/**
 * Helper Service - Utility functions for assessment operations
 * Giurelli Standards compliant - Max 50 lines per function
 */
class HelperService {
  /**
   * Get assessment statistics
   */
  async getStatistics() {
    try {
      const [
        totalTemplates,
        activeTemplates,
        templatesByType,
        recentTemplates
      ] = await Promise.all([
        prisma.assessmentTemplate.count(),
        prisma.assessmentTemplate.count({ where: { isActive: true } }),
        prisma.assessmentTemplate.groupBy({
          by: ['type'],
          _count: true
        }),
        prisma.assessmentTemplate.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true
          }
        })
      ]);

      return {
        total: totalTemplates,
        active: activeTemplates,
        byType: templatesByType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {}),
        recent: recentTemplates
      };
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Select template for tenant
   */
  async selectTemplateForTenant(templateId, tenantId) {
    try {
      const template = await prisma.assessmentTemplate.findUnique({
        where: { id: templateId },
        include: {
          questions: {
            include: { options: true }
          }
        }
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Create tenant-specific copy of template
      const tenantTemplate = await prisma.tenantAssessmentTemplate.create({
        data: {
          tenantId,
          templateId,
          isActive: true,
          customInstructions: template.instructions
        }
      });

      return tenantTemplate;
    } catch (error) {
      throw new Error(`Failed to select template: ${error.message}`);
    }
  }

  /**
   * Get tenant selections
   */
  async getTenantSelections(tenantId) {
    try {
      const selections = await prisma.tenantAssessmentTemplate.findMany({
        where: { tenantId },
        include: {
          template: {
            include: {
              questions: {
                include: { options: true }
              }
            }
          }
        }
      });

      return selections;
    } catch (error) {
      throw new Error(`Failed to get tenant selections: ${error.message}`);
    }
  }

  /**
   * Format template response
   */
  formatTemplateResponse(template) {
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      description: template.description,
      instructions: template.instructions,
      suggestedRoles: template.suggestedRoles || [],
      suggestedFrequency: template.suggestedFrequency,
      aiPrompt: template.aiPrompt,
      aiModel: template.aiModel,
      isActive: template.isActive,
      questionCount: template.questions ? template.questions.length : 0,
      questions: template.questions || [],
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };
  }

  /**
   * Get default options for question type
   */
  getDefaultOptionsForType(type) {
    const optionsByType = {
      likert: [
        { text: 'Fortemente in disaccordo', value: 1 },
        { text: 'In disaccordo', value: 2 },
        { text: 'Neutrale', value: 3 },
        { text: 'D\'accordo', value: 4 },
        { text: 'Fortemente d\'accordo', value: 5 }
      ],
      rating: [
        { text: '1', value: 1 },
        { text: '2', value: 2 },
        { text: '3', value: 3 },
        { text: '4', value: 4 },
        { text: '5', value: 5 }
      ],
      multiple_choice: [
        { text: 'Opzione 1', value: 1 },
        { text: 'Opzione 2', value: 2 },
        { text: 'Opzione 3', value: 3 },
        { text: 'Opzione 4', value: 4 }
      ]
    };

    return optionsByType[type] || [];
  }

  /**
   * Get question count by assessment type
   */
  getQuestionCountByType(type) {
    const counts = {
      'big_five': 20,
      'disc': 20,
      'belbin': 15
    };

    return counts[type] || 10;
  }

  /**
   * Check if assessment type is valid
   */
  isValidAssessmentType(type) {
    const validTypes = ['big_five', 'disc', 'belbin'];
    return validTypes.includes(type);
  }

  /**
   * Get default instructions by type
   */
  getDefaultInstructions(type) {
    const instructions = {
      'big_five': 'Rispondi a tutte le domande in base a come ti comporti normalmente, non come vorresti comportarti. Utilizza la scala da 1 (Fortemente in disaccordo) a 5 (Fortemente d\'accordo).',
      'disc': 'Scegli le risposte che meglio descrivono il tuo comportamento tipico sul lavoro. Non ci sono risposte giuste o sbagliate.',
      'belbin': 'Indica quanto spesso adotti questi comportamenti quando lavori in team. Sii onesto e spontaneo nelle tue risposte.'
    };

    return instructions[type] || 'Segui le istruzioni fornite per ciascuna domanda.';
  }
}

module.exports = new HelperService();