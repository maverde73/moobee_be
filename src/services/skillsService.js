/**
 * Skills Service
 * @module services/skillsService
 * @created 2025-10-01 22:45
 * @description Service per gestire skills globali e custom per tenant
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SkillsService {
  /**
   * Carica tutte le skills (globali + custom del tenant) con Grading da skills_sub_roles_value
   * @param {string} tenantId - ID del tenant
   * @param {number} subRoleId - ID del sub-role per caricare il Grading
   * @param {object} filters - Filtri opzionali (search, category, limit, employeeRoleIds)
   * @returns {Promise<Array>} Lista skills con grading
   */
  async getSkills(tenantId, subRoleId, filters = {}) {
    const {
      search = '',
      category = '',
      limit = 1000,
      page = 1,
      employeeRoleIds = null  // Nuovo: array di sub_role_id per calcolo max grading
    } = filters;

    const skip = (page - 1) * limit;

    let skills;

    // Se c'è una ricerca, usa raw SQL per cercare anche nei sinonimi (partial match)
    if (search && search.trim()) {
      const searchPattern = `%${search.toLowerCase()}%`;

      // Raw SQL query con LEFT JOIN per Grading e ricerca nei sinonimi
      skills = await prisma.$queryRaw`
        SELECT
          s.id,
          s."Skill",
          s."NameKnown_Skill",
          s."Synonyms_Skill",
          s.tenant_id,
          s.created_by,
          s.is_active,
          ssrv."Grading",
          ssrv."Value"
        FROM railway.public.skills s
        LEFT JOIN railway.public.skills_sub_roles_value ssrv
          ON s.id = ssrv.id_skill AND ssrv.id_sub_role = ${parseInt(subRoleId)}
        WHERE s.is_active = true
          AND (s.tenant_id IS NULL OR s.tenant_id = ${tenantId})
          AND (
            LOWER(s."Skill") LIKE ${searchPattern}
            OR LOWER(s."NameKnown_Skill") LIKE ${searchPattern}
            OR EXISTS (
              SELECT 1 FROM unnest(s."Synonyms_Skill") syn
              WHERE LOWER(syn) LIKE ${searchPattern}
            )
          )
        ORDER BY s.tenant_id ASC NULLS FIRST, s."Skill" ASC
        LIMIT ${parseInt(limit)}
        OFFSET ${skip}
      `;
    } else {
      // Determina quali sub_role_id usare per il grading
      const subRoleIdsToQuery = employeeRoleIds && employeeRoleIds.length > 0
        ? employeeRoleIds.map(id => parseInt(id))
        : [parseInt(subRoleId)];

      // Query normale senza search (usa Prisma ORM)
      skills = await prisma.skills.findMany({
        where: {
          OR: [
            { tenant_id: null },
            { tenant_id: tenantId }
          ],
          is_active: true
        },
        skip,
        take: parseInt(limit),
        include: {
          skills_sub_roles_value: {
            where: {
              id_sub_role: { in: subRoleIdsToQuery }  // ← Query multipli sub-role
            },
            select: {
              Grading: true,
              Value: true,
              id_sub_role: true  // ← Include per sapere la fonte
            }
          }
        },
        orderBy: [
          { tenant_id: 'asc' },
          { Skill: 'asc' }
        ]
      });
    }

    // Formatta risposta (gestisce sia raw SQL che Prisma ORM)
    const formattedSkills = skills.map(skill => {
      // Calcola MAX grading tra tutti i sub-ruoli (se employeeRoleIds fornito)
      let grading = null;
      let value = null;
      let maxGradingSource = null;

      if (skill.Grading !== undefined) {
        // Da raw SQL (search query)
        grading = skill.Grading;
        value = skill.Value;
      } else if (skill.skills_sub_roles_value && skill.skills_sub_roles_value.length > 0) {
        // Da Prisma relation - calcola MAX tra tutti i sub-ruoli
        const gradings = skill.skills_sub_roles_value.map(sr => ({
          grading: sr.Grading || 0,
          value: sr.Value || 0,
          subRoleId: sr.id_sub_role
        }));

        const maxEntry = gradings.reduce((max, curr) =>
          curr.grading > max.grading ? curr : max
        , { grading: 0, value: 0, subRoleId: null });

        grading = maxEntry.grading || null;
        value = maxEntry.value || null;
        maxGradingSource = maxEntry.subRoleId;
      }

      // Determina quale campo ha fatto match per mostrare badge "Sinonimo"
      let matchedField = null;
      let matchedSynonym = null;

      if (search) {
        const searchLower = search.toLowerCase();
        const skillName = (skill.Skill || '').toLowerCase();
        const knownName = (skill.NameKnown_Skill || '').toLowerCase();

        // Check se match su Skill o NameKnown_Skill
        if (skillName.includes(searchLower) || knownName.includes(searchLower)) {
          matchedField = 'name';
        }
        // Altrimenti check se match su sinonimi
        else if (skill.Synonyms_Skill && skill.Synonyms_Skill.length > 0) {
          const matchingSynonym = skill.Synonyms_Skill.find(syn =>
            syn.toLowerCase().includes(searchLower)
          );
          if (matchingSynonym) {
            matchedField = 'synonym';
            matchedSynonym = matchingSynonym;
          }
        }
      }

      return {
        id: skill.id,
        name: skill.Skill || skill.NameKnown_Skill || 'Unknown',
        synonyms: skill.Synonyms_Skill || [],
        tenant_id: skill.tenant_id,
        created_by: skill.created_by,
        is_active: skill.is_active,
        isCustom: skill.tenant_id !== null,
        grading: grading,
        gradingStars: this.gradingToStars(grading),
        value: value,
        maxGradingSource: maxGradingSource,  // Da quale sub_role viene il max grading
        matchedField: matchedField,        // 'name' o 'synonym'
        matchedSynonym: matchedSynonym     // Il sinonimo che ha fatto match
      };
    });

    return formattedSkills;
  }

  /**
   * Converti Grading (0.0-1.0) in stelle (0-5 con percentuale)
   * @param {number|null} grading - Valore grading dal database
   * @returns {object} { fullStars, partialStar, isNull }
   */
  gradingToStars(grading) {
    if (grading === null || grading === undefined) {
      return { fullStars: 0, partialStar: 0, isNull: true };
    }

    if (grading <= 0) {
      return { fullStars: 0, partialStar: 0, isNull: false };
    }

    if (grading >= 1.0) {
      return { fullStars: 5, partialStar: 0, isNull: false };
    }

    const totalStars = grading * 5;

    return {
      fullStars: Math.floor(totalStars),
      partialStar: Math.round((totalStars % 1) * 100),
      isNull: false
    };
  }

  /**
   * Crea una skill custom per il tenant
   * @param {string} tenantId - ID del tenant
   * @param {string} userId - Email dell'utente creatore
   * @param {object} skillData - Dati della skill (name, synonyms)
   * @returns {Promise<object>} Skill creata
   */
  async createCustomSkill(tenantId, userId, skillData) {
    const { name, synonyms = [] } = skillData;

    // Verifica se esiste già (globale o custom dello stesso tenant)
    const existing = await prisma.skills.findFirst({
      where: {
        Skill: name,
        OR: [
          { tenant_id: null },
          { tenant_id: tenantId }
        ]
      }
    });

    if (existing) {
      throw new Error(
        existing.tenant_id === null
          ? `Skill "${name}" esiste già come skill globale`
          : `Skill "${name}" esiste già come custom skill per questo tenant`
      );
    }

    // Crea la skill custom
    const skill = await prisma.skills.create({
      data: {
        Skill: name,
        NameKnown_Skill: name,
        Synonyms_Skill: synonyms,
        tenant_id: tenantId,
        created_by: userId,
        is_active: true
      }
    });

    return {
      id: skill.id,
      name: skill.Skill,
      tenant_id: skill.tenant_id,
      created_by: skill.created_by,
      is_active: skill.is_active,
      isCustom: true
    };
  }

  /**
   * Verifica se una skill esiste (globale o custom)
   * @param {string} name - Nome della skill
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>}
   */
  async skillExists(name, tenantId) {
    const skill = await prisma.skills.findFirst({
      where: {
        Skill: name,
        OR: [
          { tenant_id: null },
          { tenant_id: tenantId }
        ],
        is_active: true
      }
    });

    return !!skill;
  }

  /**
   * Elimina (soft delete) una skill custom
   * @param {number} skillId - ID della skill
   * @param {string} tenantId - ID del tenant (per verifica ownership)
   * @returns {Promise<object>}
   */
  async deleteCustomSkill(skillId, tenantId) {
    // Verifica ownership
    const skill = await prisma.skills.findUnique({
      where: { id: parseInt(skillId) }
    });

    if (!skill) {
      throw new Error('Skill not found');
    }

    if (skill.tenant_id !== tenantId) {
      throw new Error('Not authorized to delete this skill');
    }

    if (skill.tenant_id === null) {
      throw new Error('Cannot delete global skills');
    }

    // Soft delete
    const updated = await prisma.skills.update({
      where: { id: parseInt(skillId) },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    return {
      success: true,
      message: 'Skill deleted successfully',
      skill: {
        id: updated.id,
        name: updated.Skill,
        is_active: updated.is_active
      }
    };
  }

  /**
   * Ottieni il Grading per una skill + sub-role specifico
   * @param {number} skillId - ID della skill
   * @param {number} subRoleId - ID del sub-role
   * @returns {Promise<number|null>} Grading value o null
   */
  async getSkillGrading(skillId, subRoleId) {
    const record = await prisma.skills_sub_roles_value.findUnique({
      where: {
        id_skill_id_sub_role: {
          id_skill: parseInt(skillId),
          id_sub_role: parseInt(subRoleId)
        }
      }
    });

    return record?.Grading || null;
  }
}

module.exports = new SkillsService();
