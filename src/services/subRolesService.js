const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * SubRolesService
 * Service layer for sub-roles search and retrieval
 * Supports synonym search using PostgreSQL unnest function
 */
class SubRolesService {
  /**
   * Search sub-roles by term (searches in Sub_Role, NameKnown_Sub_Role, and Synonyms_Sub_Role)
   * @param {string} searchPattern - SQL LIKE pattern (e.g., "%web%")
   * @param {Object} options - Search options
   * @param {number} options.limit - Max results to return (default 50)
   * @param {number|null} options.parentRoleId - Optional parent role filter
   * @returns {Promise<Array>} Array of sub-roles with parent role info
   */
  async searchSubRoles(searchPattern, options = {}) {
    const { limit = 50, parentRoleId = null, tenantId = null } = options;

    // Build WHERE clause dynamically based on tenantId
    const tenantWhereClause = tenantId
      ? '(sr.tenant_id IS NULL OR sr.tenant_id = $2)'
      : 'sr.tenant_id IS NULL';

    // Build params array dynamically
    let paramIndex = 1;
    const params = [searchPattern]; // $1
    paramIndex++;

    if (tenantId) {
      params.push(tenantId); // $2
      paramIndex++;
    }

    params.push(limit); // $2 or $3
    const limitIndex = paramIndex;
    paramIndex++;

    let parentRoleClause = '';
    if (parentRoleId) {
      parentRoleClause = `AND rsr.id_role = $${paramIndex}`;
      params.push(parentRoleId);
    }

    // Raw SQL query with synonym search support + tenant filtering
    const query = `
      SELECT DISTINCT
          sr.id,
          sr."Sub_Role" as sub_role,
          sr."NameKnown_Sub_Role" as nameknown_sub_role,
          rsr.id_role as parent_role_id,
          r."Role" as parent_role_name,
          sr."Synonyms_Sub_Role" as synonyms,
          sr.is_custom,
          sr.tenant_id,
          CASE
              WHEN LOWER(sr."Sub_Role") LIKE $1 THEN 'name'
              WHEN LOWER(sr."NameKnown_Sub_Role") LIKE $1 THEN 'nameknown'
              ELSE 'synonym'
          END as matched_on,
          CASE WHEN LOWER(sr."Sub_Role") = LOWER(REPLACE($1, '%', '')) THEN 1
               WHEN LOWER(sr."NameKnown_Sub_Role") = LOWER(REPLACE($1, '%', '')) THEN 2
               ELSE 3
          END as sort_priority,
          CASE WHEN sr.is_custom = TRUE THEN 2 ELSE 1 END as custom_priority
      FROM railway.public.sub_roles sr
      LEFT JOIN railway.public.role_sub_role rsr ON sr.id = rsr.id_sub_role
      LEFT JOIN railway.public.roles r ON rsr.id_role = r.id
      WHERE (
          LOWER(sr."Sub_Role") LIKE $1
          OR LOWER(sr."NameKnown_Sub_Role") LIKE $1
          OR (
              sr."Synonyms_Sub_Role" IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM unnest(sr."Synonyms_Sub_Role") syn
                  WHERE LOWER(syn) LIKE $1
              )
          )
      )
      AND ${tenantWhereClause}
      ${parentRoleClause}
      ORDER BY
          sort_priority,
          custom_priority,
          sr."Sub_Role"
      LIMIT $${limitIndex}
    `;

    try {
      const results = await prisma.$queryRawUnsafe(query, ...params);

      return results.map(sr => ({
        id: sr.id,
        sub_role: sr.sub_role,
        nameknown_sub_role: sr.nameknown_sub_role,
        parent_role_id: sr.parent_role_id,
        parent_role_name: sr.parent_role_name,
        synonyms: sr.synonyms || [],
        matched_on: sr.matched_on,
        is_custom: sr.is_custom || false,
        tenant_id: sr.tenant_id
        // Note: No grading field - roles don't have skill levels
      }));
    } catch (error) {
      console.error('Error searching sub-roles:', error);
      throw error;
    }
  }

  /**
   * Get a single sub-role by ID with parent role info
   * @param {number} subRoleId - Sub-role ID
   * @returns {Promise<Object|null>} Sub-role object or null if not found
   */
  async getSubRoleById(subRoleId) {
    try {
      const result = await prisma.$queryRaw`
        SELECT sr.id, sr."Sub_Role" as sub_role,
               sr."NameKnown_Sub_Role" as nameknown_sub_role,
               rsr.id_role as parent_role_id,
               r."Role" as parent_role_name,
               sr."Synonyms_Sub_Role" as synonyms
        FROM railway.public.sub_roles sr
        LEFT JOIN railway.public.role_sub_role rsr ON sr.id = rsr.id_sub_role
        LEFT JOIN railway.public.roles r ON rsr.id_role = r.id
        WHERE sr.id = ${subRoleId}
      `;

      if (result.length === 0) {
        return null;
      }

      const sr = result[0];
      return {
        id: sr.id,
        sub_role: sr.sub_role,
        nameknown_sub_role: sr.nameknown_sub_role,
        parent_role_id: sr.parent_role_id,
        parent_role_name: sr.parent_role_name,
        synonyms: sr.synonyms || []
      };
    } catch (error) {
      console.error('Error getting sub-role by ID:', error);
      throw error;
    }
  }

  /**
   * Get all sub-roles (for dropdown pre-population, if needed)
   * @param {number|null} parentRoleId - Optional parent role filter
   * @param {string|null} tenantId - Optional tenant ID to include custom sub-roles
   * @returns {Promise<Array>} Array of all sub-roles
   */
  async getAllSubRoles(parentRoleId = null, tenantId = null) {
    try {
      // Build WHERE clause dynamically based on tenantId
      const whereClause = tenantId
        ? '(sr.tenant_id IS NULL OR sr.tenant_id = $1)'
        : 'sr.tenant_id IS NULL';

      const query = `
        SELECT DISTINCT
            sr.id,
            sr."Sub_Role" as sub_role,
            sr."NameKnown_Sub_Role" as nameknown_sub_role,
            rsr.id_role as parent_role_id,
            r."Role" as parent_role_name,
            sr."Synonyms_Sub_Role" as synonyms,
            sr.is_custom,
            sr.tenant_id,
            CASE WHEN sr.is_custom = TRUE THEN 2 ELSE 1 END as custom_priority
        FROM railway.public.sub_roles sr
        LEFT JOIN railway.public.role_sub_role rsr ON sr.id = rsr.id_sub_role
        LEFT JOIN railway.public.roles r ON rsr.id_role = r.id
        WHERE ${whereClause}
        ${parentRoleId ? (tenantId ? 'AND rsr.id_role = $2' : 'AND rsr.id_role = $1') : ''}
        ORDER BY
            custom_priority,
            sr."Sub_Role"
      `;

      // Build params array based on what's provided
      let params = [];
      if (tenantId && parentRoleId) {
        params = [tenantId, parentRoleId];
      } else if (tenantId) {
        params = [tenantId];
      } else if (parentRoleId) {
        params = [parentRoleId];
      }

      const results = await prisma.$queryRawUnsafe(query, ...params);

      return results.map(sr => ({
        id: sr.id,
        sub_role: sr.sub_role,
        nameknown_sub_role: sr.nameknown_sub_role,
        parent_role_id: sr.parent_role_id,
        parent_role_name: sr.parent_role_name,
        synonyms: sr.synonyms || [],
        is_custom: sr.is_custom || false,
        tenant_id: sr.tenant_id
      }));
    } catch (error) {
      console.error('Error getting all sub-roles:', error);
      throw error;
    }
  }

  /**
   * Create custom sub-role with AI parent role classification
   * @param {Object} data - { customSubRoleName, tenantId, userId }
   * @returns {Promise<Object>} Created sub-role with AI classification
   */
  async createCustomSubRole(data) {
    const { customSubRoleName, tenantId, userId } = data;
    const { classifySubRole, generateSynonyms } = require('./ai/subRoleClassifier');

    // 1. Check if already exists for this tenant
    const existing = await prisma.sub_roles.findFirst({
      where: {
        Sub_Role: customSubRoleName,
        tenant_id: tenantId
      }
    });

    if (existing) {
      throw new Error('Custom sub-role already exists for this tenant');
    }

    // 2. Load available parent roles (15 roles)
    const parentRoles = await prisma.roles.findMany({
      select: { id: true, Role: true }
    });

    // 3. AI classification - assign parent role
    const aiResult = await classifySubRole(customSubRoleName, parentRoles);

    if (aiResult.confidence < 0.7) {
      console.warn(`Low confidence (${aiResult.confidence}) for "${customSubRoleName}"`);
      console.warn('Alternatives:', aiResult.alternatives);
    }

    // 4. Generate synonyms (optional, non-blocking)
    let synonyms = [];
    try {
      synonyms = await generateSynonyms(customSubRoleName);
    } catch (err) {
      console.warn('Synonym generation failed:', err.message);
    }

    // 5. Create custom sub-role
    const customSubRole = await prisma.sub_roles.create({
      data: {
        Sub_Role: customSubRoleName,
        NameKnown_Sub_Role: customSubRoleName,
        Synonyms_Sub_Role: synonyms,
        tenant_id: tenantId,
        is_custom: true,
        created_by: userId
      }
    });

    // 6. Link to parent role in role_sub_role table
    await prisma.role_sub_role.create({
      data: {
        id_role: aiResult.parentRoleId,
        id_sub_role: customSubRole.id
      }
    });

    return {
      success: true,
      subRole: {
        id: customSubRole.id,
        sub_role: customSubRole.Sub_Role,
        nameknown_sub_role: customSubRole.NameKnown_Sub_Role,
        parent_role_id: aiResult.parentRoleId,
        parent_role_name: aiResult.parentRoleName,
        synonyms: customSubRole.Synonyms_Sub_Role,
        is_custom: true,
        tenant_id: customSubRole.tenant_id
      },
      aiClassification: {
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        alternatives: aiResult.alternatives,
        model: aiResult.aiModel
      }
    };
  }

  /**
   * Delete custom sub-role (only if created by same tenant)
   * @param {number} subRoleId - Sub-role ID to delete
   * @param {string} tenantId - Tenant ID for authorization
   * @returns {Promise<boolean>} Success status
   */
  async deleteCustomSubRole(subRoleId, tenantId) {
    // 1. Check if sub-role exists and is custom
    const subRole = await prisma.sub_roles.findUnique({
      where: { id: subRoleId }
    });

    if (!subRole) {
      throw new Error('Sub-role not found');
    }

    if (!subRole.is_custom) {
      throw new Error('Cannot delete global sub-roles');
    }

    if (subRole.tenant_id !== tenantId) {
      throw new Error('Unauthorized: sub-role belongs to different tenant');
    }

    // 2. Delete role_sub_role mapping first (FK constraint)
    await prisma.role_sub_role.deleteMany({
      where: { id_sub_role: subRoleId }
    });

    // 3. Delete sub-role
    await prisma.sub_roles.delete({
      where: { id: subRoleId }
    });

    return true;
  }
}

module.exports = new SubRolesService();
