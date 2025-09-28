/**
 * Role Soft Skills Controller
 * API per recuperare i soft skills associati ai ruoli
 */

const prisma = require('../config/database');

/**
 * Recupera i soft skills per un ruolo specifico
 * GET /api/roles/:id/soft-skills
 */
const getRoleSoftSkills = async (req, res) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);

    if (isNaN(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID'
      });
    }

    // Recupera il nome del ruolo
    const role = await prisma.$queryRaw`
      SELECT id, "Role" as name
      FROM roles
      WHERE id = ${roleId}
      LIMIT 1
    `;

    if (!role || role.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Recupera i soft skills associati al ruolo
    // Using raw query because the table relationship isn't properly defined in Prisma
    const roleSoftSkills = await prisma.$queryRaw`
      SELECT
        rs.id,
        rs."roleId",
        rs."softSkillId",
        rs.priority,
        rs."minScore",
        rs.weight,
        rs."isRequired",
        s.id as "skillId",
        s.name as "skillName",
        s."nameEn" as "skillNameEn",
        s.category as "skillCategory"
      FROM role_soft_skills rs
      INNER JOIN soft_skills s ON s.id = rs."softSkillId"
      WHERE rs."roleId" = ${roleId}
      ORDER BY rs.priority ASC
    `;

    // Formatta la risposta
    const response = {
      success: true,
      data: {
        roleId: roleId,
        roleName: role[0].name,
        skills: roleSoftSkills.map(rs => ({
          id: rs.skillId,
          softSkillId: rs.softSkillId,
          name: rs.skillName,
          nameEn: rs.skillNameEn,
          skillName: rs.skillName,
          skillNameEn: rs.skillNameEn,
          category: rs.skillCategory || 'general',
          priority: rs.priority,
          minScore: rs.minScore,
          weight: rs.weight || 1.0,
          isRequired: rs.isRequired || false
        }))
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching role soft skills:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Recupera tutti i ruoli con i loro soft skills
 * GET /api/roles/soft-skills
 */
const getAllRolesSoftSkills = async (req, res) => {
  try {
    // Recupera tutti i ruoli che hanno soft skills
    const rolesWithSkills = await prisma.$queryRaw`
      SELECT DISTINCT r.id, r."Role" as name
      FROM roles r
      INNER JOIN role_soft_skills rs ON rs."roleId" = r.id
      ORDER BY r."Role"
    `;

    // Per ogni ruolo, recupera i soft skills
    const results = await Promise.all(
      rolesWithSkills.map(async (role) => {
        const skills = await prisma.$queryRaw`
          SELECT
            rs.id,
            rs."roleId",
            rs."softSkillId",
            rs.priority,
            rs."minScore",
            s.id as "skillId",
            s.name as "skillName"
          FROM role_soft_skills rs
          INNER JOIN soft_skills s ON s.id = rs."softSkillId"
          WHERE rs."roleId" = ${role.id}
          ORDER BY rs.priority ASC
        `;

        return {
          roleId: role.id,
          roleName: role.name,
          skillCount: skills.length,
          skills: skills.map(rs => ({
            id: rs.skillId,
            name: rs.skillName,
            priority: rs.priority,
            minScore: rs.minScore
          }))
        };
      })
    );

    res.json({
      success: true,
      data: results,
      summary: {
        totalRoles: results.length,
        totalMappings: results.reduce((acc, r) => acc + r.skillCount, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching all roles soft skills:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getRoleSoftSkills,
  getAllRolesSoftSkills
};