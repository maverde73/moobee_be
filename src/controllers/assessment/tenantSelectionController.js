const prisma = require('../../config/database');

/**
 * Controller per gestire le selezioni degli assessment per i tenant
 */
class TenantSelectionController {
  /**
   * Recupera tutte le selezioni di assessment per un tenant
   */
  async getTenantSelections(req, res) {
    try {
      const { tenantId } = req.params;

      const selections = await prisma.tenant_assessment_selections.findMany({
        where: {
          tenant_id: tenantId,
          isActive: true
        },
        include: {
          assessment_templates: {
            include: {
              assessment_questions: {
                include: {
                  assessment_options: true
                }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        data: selections
      });
    } catch (error) {
      console.error('Error fetching tenant selections:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tenant selections'
      });
    }
  }

  /**
   * Aggiunge o aggiorna le selezioni di assessment per un tenant
   */
  async updateTenantSelections(req, res) {
    try {
      const { tenantId } = req.params;
      const { templateIds } = req.body;

      // Recupera le selezioni esistenti
      const existingSelections = await prisma.tenant_assessment_selections.findMany({
        where: { tenant_id: tenantId }
      });

      const existingTemplateIds = existingSelections.map(s => s.templateId);

      // Determina quali template aggiungere
      // NON DISATTIVIAMO MAI e TUTTI I RECORD SONO SEMPRE ATTIVI
      const toAdd = templateIds.filter(id => !existingTemplateIds.includes(id));

      // RIMOSSO: Non serve più riattivare perché tutti i record sono sempre attivi
      // const toReactivate = templateIds.filter(id => {
      //   const existing = existingSelections.find(s => s.templateId === id);
      //   return existing && !existing.isActive;
      // });

      // Esegui le operazioni in una transazione
      const result = await prisma.$transaction(async (tx) => {
        // Aggiungi SOLO nuove selezioni
        if (toAdd.length > 0) {
          await tx.tenant_assessment_selections.createMany({
            data: toAdd.map(templateId => ({
              tenant_id: tenantId,
              templateId: parseInt(templateId, 10), // Converte stringa in intero
              isActive: true, // SEMPRE TRUE
              selectedBy: req.user?.email || 'System',
              updatedAt: new Date() // Aggiungi updatedAt richiesto dallo schema
            })),
            skipDuplicates: true // Ignora duplicati invece di generare errore
          });
        }

        // RIMOSSO: Codice di riattivazione non più necessario
        // Tutti i record sono e rimangono sempre con isActive = true

        // COMMENTATO - Non disattiviamo mai le selezioni
        // Gli assessment una volta selezionati rimangono sempre attivi
        // if (toDeactivate.length > 0) {
        //   await tx.tenant_assessment_selections.updateMany({
        //     where: {
        //       tenant_id: tenantId,
        //       templateId: { in: toDeactivate }
        //     },
        //     data: {
        //       isActive: false
        //     }
        //   });
        // }

        // Recupera tutte le selezioni attive
        return await tx.tenant_assessment_selections.findMany({
          where: {
            tenant_id: tenantId,
            isActive: true
          },
          include: {
            assessment_templates: true
          }
        });
      });

      res.json({
        success: true,
        data: result,
        stats: {
          added: toAdd.length,
          reactivated: 0, // SEMPRE 0 - non riattiviamo perché sono sempre attivi
          deactivated: 0  // SEMPRE 0 - non disattiviamo mai
        }
      });
    } catch (error) {
      console.error('Error updating tenant selections:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tenant selections'
      });
    }
  }

  /**
   * Aggiunge una singola selezione di assessment per un tenant
   */
  async addTenantSelection(req, res) {
    try {
      const { tenantId } = req.params;
      const { templateId } = req.body;

      // Verifica se esiste già
      const existing = await prisma.tenant_assessment_selections.findFirst({
        where: {
          tenant_id: tenantId,
          templateId
        }
      });

      if (existing) {
        // Se esiste già, ritorna il record esistente
        // NON SERVE CONTROLLARE isActive perché è SEMPRE true
        return res.json({
          success: true,
          data: existing,
          message: 'Selection already exists'
        });
      }

      // Crea nuova selezione
      const selection = await prisma.tenant_assessment_selections.create({
        data: {
          tenant_id: tenantId,
          templateId,
          isActive: true,
          selectedBy: req.user?.email || 'System',
          updatedAt: new Date()
        },
        include: {
          assessment_templates: true
        }
      });

      res.status(201).json({
        success: true,
        data: selection
      });
    } catch (error) {
      console.error('Error adding tenant selection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add tenant selection'
      });
    }
  }

  /**
   * FUNZIONE DISABILITATA - Gli assessment una volta selezionati rimangono sempre attivi
   * Non è possibile rimuovere un assessment dal catalogo del tenant
   *
   * @deprecated Questa funzione non deve essere utilizzata
   */
  async removeTenantSelection(req, res) {
    // IMPORTANTE: Questa funzione è stata disabilitata perché
    // la business logic richiede che gli assessment una volta
    // selezionati rimangano sempre nel catalogo del tenant
    return res.status(403).json({
      success: false,
      error: 'La rimozione degli assessment non è permessa. Gli assessment selezionati rimangono permanentemente nel catalogo.'
    });

    // CODICE ORIGINALE COMMENTATO - NON RIATTIVARE
    // try {
    //   const { tenantId, templateId } = req.params;
    //
    //   const selection = await prisma.tenant_assessment_selections.updateMany({
    //     where: {
    //       tenant_id: tenantId,
    //       templateId
    //     },
    //     data: {
    //       isActive: false
    //     }
    //   });
    //
    //   if (selection.count === 0) {
    //     return res.status(404).json({
    //       success: false,
    //       error: 'Selection not found'
    //     });
    //   }
    //
    //   res.json({
    //     success: true,
    //     message: 'Selection removed successfully'
    //   });
    // } catch (error) {
    //   console.error('Error removing tenant selection:', error);
    //   res.status(500).json({
    //     success: false,
    //     error: 'Failed to remove tenant selection'
    //   });
    // }
  }

  /**
   * Recupera tutti gli assessment con lo stato di selezione per il tenant
   * Legge da assessment_templates e controlla tenant_assessment_selections
   */
  async getAssessmentsWithSelectionStatus(req, res) {
    try {
      const { tenantId, page = 1, limit = 100 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build include object conditionally
      const includeObj = {
        assessment_questions: {
          include: {
            assessment_options: true
          }
        }
      };

      // Only add tenantSelections if tenantId is provided and valid
      if (tenantId && tenantId !== 'null' && tenantId !== 'undefined') {
        includeObj.tenant_assessment_selections = {
          where: {
            tenant_id: tenantId,
            isActive: true
          }
        };
      }

      // Recupera TUTTI i template dalla tabella assessment_templates
      const templates = await prisma.assessment_templates.findMany({
        // Non applico filtri per mostrare tutto il catalogo
        skip,
        take: parseInt(limit),
        include: includeObj,
        orderBy: {
          name: 'asc'
        }
      });

      // Conta totale per paginazione
      const totalCount = await prisma.assessment_templates.count();

      // Funzione helper per recuperare soft skills dai ruoli
      const getRoleSoftSkills = async (suggestedRoles) => {
        if (!suggestedRoles || suggestedRoles.length === 0) {
          return [];
        }

        try {
          // Estrai gli ID dei ruoli dalle stringhe "id:name"
          const roleIds = suggestedRoles.map(role => {
            const [id] = role.split(':');
            return parseInt(id);
          }).filter(id => !isNaN(id));

          if (roleIds.length === 0) {
            return [];
          }

          // Recupera i soft skills per i ruoli
          const roleSkills = await prisma.role_soft_skills.findMany({
            where: {
              roleId: { in: roleIds }
            },
            include: {
              soft_skills: true,
              roles: true
            }
          });

          // Raggruppa i soft skills unici
          const skillsMap = new Map();
          roleSkills.forEach(rs => {
            if (!skillsMap.has(rs.softSkillId)) {
              skillsMap.set(rs.softSkillId, {
                id: rs.softSkillId,
                name: rs.soft_skills.name,
                nameEn: rs.soft_skills.nameEn,
                category: rs.soft_skills.category,
                priority: rs.priority,
                roles: [rs.roles.name]
              });
            } else {
              const skill = skillsMap.get(rs.softSkillId);
              skill.priority = Math.min(skill.priority, rs.priority);
              if (!skill.roles.includes(rs.roles.name)) {
                skill.roles.push(rs.roles.name);
              }
            }
          });

          return Array.from(skillsMap.values()).sort((a, b) => a.priority - b.priority);
        } catch (error) {
          console.error('Error fetching role soft skills:', error);
          return [];
        }
      };

      // Formatta la risposta con lo stato di selezione e soft skills
      const assessmentsWithStatus = await Promise.all(templates.map(async template => {
        const roleSoftSkills = await getRoleSoftSkills(template.suggestedRoles);

        return {
          id: template.id,
          title: template.name,
          type: template.type || 'CUSTOM',
          description: template.description,
          questionsCount: template.assessment_questions?.length || 0,
          isSelected: template.tenant_assessment_selections ? template.tenant_assessment_selections.length > 0 : false,
          selectedAt: template.tenant_assessment_selections && template.tenant_assessment_selections[0] ? template.tenant_assessment_selections[0].selectedAt : null,
          status: template.isActive ? 'published' : 'draft',
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          template: {
            category: template.type || 'CUSTOM',
            name: template.name,
            targetRoles: template.suggestedRoles || [],
            skills: template.targetSoftSkillIds || [],
            roleSoftSkills: roleSoftSkills,
            duration: template.type === 'BIG_FIVE' ? 30 :
                     template.type === 'DISC' ? 25 :
                     template.type === 'BELBIN' ? 20 : 15
          },
          createdBy: { email: template.createdBy || 'System' },
          version: template.version || 1
        };
      }));

      res.json({
        success: true,
        data: assessmentsWithStatus,
        metadata: {
          totalCount: totalCount,
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1
        }
      });
    } catch (error) {
      console.error('Error fetching assessments with selection status:', error);
      console.error('Error details:', error.message);
      if (error.stack) console.error('Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assessments',
        details: error.message
      });
    }
  }
}

module.exports = new TenantSelectionController();