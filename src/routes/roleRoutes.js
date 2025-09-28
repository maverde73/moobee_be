const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middlewares/authMiddleware');
const { query, param, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// GET /api/roles/search - Search roles with simple response
router.get('/search',
  async (req, res) => {
    try {
      const { q } = req.query;

      let roles;
      if (q) {
        roles = await prisma.$queryRaw`
          SELECT DISTINCT
            id::text as id,
            INITCAP("NameKnown_Role") as name
          FROM roles
          WHERE "NameKnown_Role" ILIKE ${`%${q}%`}
          ORDER BY INITCAP("NameKnown_Role") ASC
          LIMIT 100
        `;
      } else {
        roles = await prisma.$queryRaw`
          SELECT DISTINCT
            id::text as id,
            INITCAP("NameKnown_Role") as name
          FROM roles
          WHERE "NameKnown_Role" IS NOT NULL
          ORDER BY INITCAP("NameKnown_Role") ASC
          LIMIT 100
        `;
      }

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Error searching roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching roles',
        error: error.message
      });
    }
  }
);

// GET /api/roles - Get all roles with sub-roles
// Made public to support assessment creation
router.get('/',
  [
    query('search').optional().trim(),
    query('withSubRoles').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { search, withSubRoles } = req.query;

      const where = {};
      if (search) {
        where.OR = [
          { Role: { contains: search, mode: 'insensitive' } },
          { NameKnown_Role: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Since roles table has @@ignore, we use raw SQL
      let roles;
      if (search) {
        roles = await prisma.$queryRaw`
          SELECT
            id::text as id,
            INITCAP("NameKnown_Role") as name
          FROM roles
          WHERE "NameKnown_Role" ILIKE ${`%${search}%`}
            AND "NameKnown_Role" IS NOT NULL
          ORDER BY INITCAP("NameKnown_Role") ASC
        `;
      } else {
        roles = await prisma.$queryRaw`
          SELECT
            id::text as id,
            INITCAP("NameKnown_Role") as name
          FROM roles
          WHERE "NameKnown_Role" IS NOT NULL
          ORDER BY INITCAP("NameKnown_Role") ASC
        `;
      }

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching roles',
        error: error.message
      });
    }
  }
);

// GET /api/roles/:id - Get role by ID with details
router.get('/:id',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const role = await prisma.roles.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          role_sub_role: {
            include: {
              sub_roles: true
            }
          },
          employee_roles: {
            where: { is_current: true },
            include: {
              employees: true
            }
          }
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      res.json({
        success: true,
        data: role
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role',
        error: error.message
      });
    }
  }
);

// GET /api/roles/:id/skills - Get skills associated with a role
router.get('/:id/skills',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const roleId = parseInt(req.params.id);

      // Get role to find its name
      const role = await prisma.roles.findUnique({
        where: { id: roleId }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Query the extended_tech_skills_roles_descriptions_full table
      // Note: This is a view/table without proper foreign keys, so we use raw query
      const skills = await prisma.$queryRaw`
        SELECT DISTINCT 
          s.id as skill_id,
          s."Skill" as skill_name,
          s."NameKnown_Skill" as skill_display_name,
          ets."Hot_Technology" as is_hot,
          ets."In_Demand" as is_in_demand,
          ets."Description" as description
        FROM extended_tech_skills_roles_descriptions_full ets
        LEFT JOIN skills s ON s."Skill" = ets."Skill"
        WHERE ets."Role" = ${role.Role}
        ORDER BY s."Skill"
      `;

      res.json({
        success: true,
        data: {
          role: {
            id: role.id,
            name: role.Role,
            displayName: role.NameKnown_Role
          },
          skills
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role skills',
        error: error.message
      });
    }
  }
);

// GET /api/roles/sub-roles - Get all sub-roles
router.get('/sub-roles/all',
  authenticate,
  async (req, res) => {
    try {
      const subRoles = await prisma.sub_roles.findMany({
        orderBy: { Sub_Role: 'asc' }
      });

      res.json({
        success: true,
        data: subRoles
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching sub-roles',
        error: error.message
      });
    }
  }
);

// GET /api/roles/hierarchy - Get role hierarchy view
router.get('/hierarchy/tree',
  authenticate,
  async (req, res) => {
    try {
      const hierarchy = await prisma.$queryRaw`
        SELECT 
          r.id as role_id,
          r."Role" as role_name,
          r."NameKnown_Role" as role_display_name,
          COUNT(DISTINCT sr.id) as sub_roles_count,
          ARRAY_AGG(
            DISTINCT jsonb_build_object(
              'id', sr.id,
              'name', sr."Sub_Role",
              'displayName', sr."NameKnown_Sub_Role"
            )
          ) FILTER (WHERE sr.id IS NOT NULL) as sub_roles
        FROM roles r
        LEFT JOIN role_sub_role rsr ON r.id = rsr.id_role
        LEFT JOIN sub_roles sr ON rsr.id_sub_role = sr.id
        GROUP BY r.id, r."Role", r."NameKnown_Role"
        ORDER BY sub_roles_count DESC, r."Role"
      `;

      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role hierarchy',
        error: error.message
      });
    }
  }
);

module.exports = router;