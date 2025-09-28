const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Service layer per la gestione degli Assessment Templates
 * @module AssessmentTemplateService
 */
class AssessmentTemplateService {
  /**
   * Crea un nuovo assessment template con domande
   * @param {Object} data - Dati del template
   * @returns {Promise<Object>} Template creato
   */
  async createTemplate(data) {
    try {
      return await prisma.assessmentTemplate.create({
        data,
        include: {
          questions: {
            include: {
              options: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Service error creating template:', error);
      throw error;
    }
  }

  /**
   * Ottiene templates con paginazione e filtri
   * @param {Object} params - Parametri di ricerca
   * @returns {Promise<Object>} Lista paginata
   */
  async getTemplates(params = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        isPublic,
        search,
        orderBy = 'createdAt',
        order = 'desc'
      } = params;

      const skip = (page - 1) * limit;
      const where = this.buildWhereClause({ type, isPublic, search });

      const [templates, total] = await Promise.all([
        prisma.assessmentTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderBy]: order },
          include: {
            _count: {
              select: {
                questions: true,
                tenantSelections: true
              }
            }
          }
        }),
        prisma.assessmentTemplate.count({ where })
      ]);

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Service error getting templates:', error);
      throw error;
    }
  }

  /**
   * Ottiene un template specifico con tutte le relazioni
   * @param {string} id - ID del template
   * @returns {Promise<Object>} Template completo
   */
  async getTemplateById(id) {
    try {
      return await prisma.assessmentTemplate.findUnique({
        where: { id },
        include: {
          questions: {
            include: {
              options: {
                orderBy: { orderIndex: 'asc' }
              }
            },
            orderBy: { orderIndex: 'asc' }
          },
          tenantSelections: {
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  domain: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Service error getting template by id:', error);
      throw error;
    }
  }

  /**
   * Aggiorna un template esistente
   * @param {string} id - ID del template
   * @param {Object} data - Dati da aggiornare
   * @returns {Promise<Object>} Template aggiornato
   */
  async updateTemplate(id, data) {
    try {
      // Se ci sono domande da aggiornare, usa una transaction
      if (data.questions) {
        return await prisma.$transaction(async (tx) => {
          // Prima elimina le domande esistenti
          await tx.assessmentQuestion.deleteMany({
            where: { templateId: id }
          });

          // Poi aggiorna il template con le nuove domande
          return await tx.assessmentTemplate.update({
            where: { id },
            data: {
              ...data,
              questions: {
                create: data.questions
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
        });
      }

      // Altrimenti aggiorna solo il template
      return await prisma.assessmentTemplate.update({
        where: { id },
        data,
        include: {
          questions: true
        }
      });
    } catch (error) {
      console.error('Service error updating template:', error);
      throw error;
    }
  }

  /**
   * Elimina un template (soft delete se in uso)
   * @param {string} id - ID del template
   * @returns {Promise<boolean>} Success status
   */
  async deleteTemplate(id) {
    try {
      // Check if template is in use
      const inUse = await prisma.tenantAssessmentSelection.count({
        where: { templateId: id, isActive: true }
      });

      if (inUse > 0) {
        // Soft delete - mark as inactive
        await prisma.assessmentTemplate.update({
          where: { id },
          data: {
            isActive: false,
            isPublic: false,
            updatedAt: new Date()
          }
        });
      } else {
        // Hard delete if not in use
        await prisma.assessmentTemplate.delete({
          where: { id }
        });
      }

      return true;
    } catch (error) {
      console.error('Service error deleting template:', error);
      throw error;
    }
  }

  /**
   * Pubblica un template per tutti i tenant
   * @param {string} id - ID del template
   * @returns {Promise<Object>} Template pubblicato
   */
  async publishTemplate(id) {
    try {
      return await prisma.assessmentTemplate.update({
        where: { id },
        data: {
          isPublic: true,
          isActive: true,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Service error publishing template:', error);
      throw error;
    }
  }

  /**
   * Ritira un template dalla pubblicazione
   * @param {string} id - ID del template
   * @returns {Promise<Object>} Template ritirato
   */
  async unpublishTemplate(id) {
    try {
      return await prisma.assessmentTemplate.update({
        where: { id },
        data: {
          isPublic: false,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Service error unpublishing template:', error);
      throw error;
    }
  }

  /**
   * Duplica un template esistente
   * @param {string} id - ID del template da duplicare
   * @param {string} newName - Nome per il nuovo template
   * @returns {Promise<Object>} Nuovo template
   */
  async duplicateTemplate(id, newName) {
    try {
      const original = await this.getTemplateById(id);
      if (!original) {
        throw new Error('Template not found');
      }

      const { id: _, createdAt, updatedAt, questions, tenantSelections, ...templateData } = original;

      return await prisma.assessmentTemplate.create({
        data: {
          ...templateData,
          name: newName || `${original.name} (Copy)`,
          isPublic: false,
          version: 1,
          usageCount: 0,
          questions: {
            create: questions.map(q => {
              const { id, templateId, createdAt, updatedAt, options, ...questionData } = q;
              return {
                ...questionData,
                options: {
                  create: options.map(o => {
                    const { id, questionId, createdAt, updatedAt, ...optionData } = o;
                    return optionData;
                  })
                }
              };
            })
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
    } catch (error) {
      console.error('Service error duplicating template:', error);
      throw error;
    }
  }

  /**
   * Costruisce la clausola WHERE per i filtri
   * @private
   * @param {Object} filters - Filtri da applicare
   * @returns {Object} Clausola WHERE per Prisma
   */
  buildWhereClause(filters) {
    const where = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    // Default: only active templates
    if (filters.includeInactive !== true) {
      where.isActive = true;
    }

    return where;
  }
}

module.exports = new AssessmentTemplateService();