const express = require('express');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { determineTenant, requireTenant } = require('../middlewares/tenantMiddleware');
const { body, param, query, validationResult } = require('express-validator');

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

// GET /api/employees - Get all employees with pagination and search
router.get('/',
  authenticate,
  determineTenant,
  requireTenant,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('department').optional().isInt(),
    query('isActive').optional().isBoolean(),
    query('search').optional().isString()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';

      console.log('=== Employee Route - GET /employees ===');
      console.log('Search term:', search, 'Length:', search.length);

      const where = {
        tenant_id: req.tenantId // Use tenant from middleware
      };

      if (req.query.department) where.department_id = parseInt(req.query.department);
      if (req.query.isActive !== undefined) where.is_active = req.query.isActive === 'true';

      // Add search filter if search term is provided (minimum 3 characters)
      if (search && search.length >= 3) {
        console.log('Adding search filter for:', search);
        where.OR = [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [employees, total] = await Promise.all([
        prisma.employees.findMany({
          where,
          skip,
          take: limit,
          include: {
            departments: true,
            employee_roles: true
          },
          orderBy: { last_name: 'asc' }
        }),
        prisma.employees.count({ where })
      ]);

      console.log(`Found ${employees.length} employees (Total: ${total})`);

      // Add computed 'name' field to each employee
      const employeesWithName = employees.map(emp => ({
        ...emp,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Nome non disponibile'
      }));

      res.json({
        success: true,
        data: {
          employees: employeesWithName,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching employees',
        error: error.message
      });
    }
  }
);

// GET /api/employees/:id - Get employee by ID
router.get('/:id',
  authenticate,
  determineTenant,
  requireTenant,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Find employee with tenant restriction
      const employee = await prisma.employees.findFirst({
        where: {
          id: parseInt(req.params.id),
          tenant_id: req.tenantId // Re-enabled tenant filtering
        },
        include: {
          // Department info - using correct relation name
          departments: {
            select: {
              department_name: true
            }
          },
          // User account info
          tenant_users: {
            select: {
              role: true,
              last_login_at: true,
              login_count: true,
              is_active: true
            }
          },
          // Current roles - simplified without ignored relations
          employee_roles: {
            select: {
              id: true,
              role_id: true,
              sub_role_id: true,
              anni_esperienza: true
            }
          },
          // Comment out non-existent relations for now
          // TODO: Add back when assessments and project_assignments tables are properly set up
          // assessments: {
          //   orderBy: { assessment_date: 'desc' },
          //   take: 5,
          //   select: {
          //     assessment_date: true,
          //     overall_score: true
          //   }
          // },
          // project_assignments: {
          //   where: { is_active: true },
          //   include: {
          //     projects: {
          //       select: {
          //         project_name: true,
          //         status: true,
          //         project_code: true
          //       }
          //     }
          //   }
          // }
        }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Transform response to have simpler property names for frontend
      const transformedEmployee = {
        ...employee,
        department: employee.departments?.department_name || null,
        // Add computed name field
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email || 'Nome non disponibile'
      };

      res.json({
        success: true,
        data: transformedEmployee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching employee',
        error: error.message
      });
    }
  }
);

// POST /api/employees - Create new employee
router.post('/',
  authenticate,
  authorize('hr managers', 'administrators'),
  [
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('hireDate').isISO8601(),
    body('departmentId').optional().isInt(),
    body('position').optional().trim(),
    body('managerId').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        hireDate,
        departmentId,
        position,
        managerId
      } = req.body;

      // Check if email already exists
      const existingEmployee = await prisma.employees.findUnique({
        where: { email }
      });

      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }

      // Create employee
      const employee = await prisma.employees.create({
        data: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          hire_date: new Date(hireDate),
          department_id: departmentId,
          position,
          manager_id: managerId,
          employee_code: `EMP${Date.now()}`
        },
        include: {
          departments: true,
          employees: true
        }
      });

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: employee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating employee',
        error: error.message
      });
    }
  }
);

// PUT /api/employees/:id - Update employee
router.put('/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR', 'hr managers', 'administrators']),
  [
    param('id').isInt(),
    body('first_name').optional().trim(),
    body('last_name').optional().trim(),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('hire_date').optional().isISO8601(),
    body('hireDate').optional().isISO8601(),
    body('departmentId').optional().isInt(),
    body('position').optional().trim(),
    body('managerId').optional().isInt(),
    body('isActive').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      // Check if employee exists
      const existingEmployee = await prisma.employees.findUnique({
        where: { id: employeeId }
      });

      if (!existingEmployee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Build update data - support both snake_case and camelCase
      const updateData = {};
      if (req.body.first_name || req.body.firstName) {
        updateData.first_name = req.body.first_name || req.body.firstName;
      }
      if (req.body.last_name || req.body.lastName) {
        updateData.last_name = req.body.last_name || req.body.lastName;
      }
      if (req.body.hire_date || req.body.hireDate) {
        updateData.hire_date = new Date(req.body.hire_date || req.body.hireDate);
      }
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.phone) updateData.phone = req.body.phone;
      if (req.body.departmentId) updateData.department_id = req.body.departmentId;
      if (req.body.position) updateData.position = req.body.position;
      if (req.body.managerId) updateData.manager_id = req.body.managerId;
      if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;

      // Handle competenze_trasversali (soft skills) - accept both formats
      if (req.body.competenze_trasversali !== undefined) {
        updateData.competenze_trasversali = req.body.competenze_trasversali;
      } else if (req.body.competenzeTrasversali !== undefined) {
        updateData.competenze_trasversali = req.body.competenzeTrasversali;
      }

      updateData.updated_at = new Date();

      // Update employee
      const employee = await prisma.employees.update({
        where: { id: employeeId },
        data: updateData,
        include: {
          departments: true
        }
      });

      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: employee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating employee',
        error: error.message
      });
    }
  }
);

// GET /api/employees/:id/full - Get complete employee data (employees + tenant_users)
router.get('/:id/full',
  authenticate,
  determineTenant,
  requireTenant,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      // Get employee data with tenant_users info
      const employee = await prisma.employees.findFirst({
        where: {
          id: employeeId,
          tenant_id: req.tenantId
        },
        include: {
          tenant_users: {
            select: {
              id: true,
              email: true,
              role: true,
              is_active: true,
              force_password_change: true,
              last_login_at: true,
              login_count: true
            }
          },
          employee_roles: true
        }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Format response to match frontend expectations
      const responseData = {
        // From tenant_users
        tenant_user_id: employee.tenant_users?.id,
        email: employee.tenant_users?.email || employee.email,
        role: employee.tenant_users?.role,
        is_active: employee.tenant_users?.is_active,
        force_password_change: employee.tenant_users?.force_password_change,

        // From employees
        employee_id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        hire_date: employee.hire_date,
        competenze_trasversali: employee.competenze_trasversali || [],

        // Relations
        roles: employee.employee_roles || [],
        skills: []
      };

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('Error fetching employee full data:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching employee full data',
        error: error.message
      });
    }
  }
);

// GET /api/employees/:id/roles - Get employee roles
router.get('/:id/roles',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      // Get employee roles with role names from the roles table
      const rolesData = await prisma.$queryRaw`
        SELECT
          er.*,
          r."NameKnown_Role" as role_name,
          COALESCE(sr."NameKnown_Sub_Role", sr."Sub_Role") as sub_role_name
        FROM employee_roles er
        LEFT JOIN roles r ON er.role_id = r.id
        LEFT JOIN sub_roles sr ON er.sub_role_id = sr.id
        WHERE er.employee_id = ${employeeId}
      `;

      res.json({
        success: true,
        data: rolesData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching employee roles',
        error: error.message
      });
    }
  }
);

// PUT /api/employees/:id/roles - Update employee roles
router.put('/:id/roles',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    body('roles').isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { roles } = req.body;
      const tenantId = req.tenantId || req.user?.tenantId;

      // Validate tenant ID
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      // Validate roles array
      if (!roles || !Array.isArray(roles)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid roles data'
        });
      }

      // Delete all existing roles and create new ones (same logic as POST)
      const result = await prisma.$transaction(async (tx) => {
        // Delete all existing roles for this employee
        await tx.employee_roles.deleteMany({
          where: { employee_id: employeeId }
        });

        // Create new role assignments
        const newRoles = [];
        for (const role of roles) {
          const newRole = await tx.employee_roles.create({
            data: {
              employee_id: employeeId,
              role_id: parseInt(role.role_id),
              sub_role_id: role.sub_role_id ? parseInt(role.sub_role_id) : null,
              tenant_id: tenantId,
              anni_esperienza: parseInt(role.anni_esperienza) || 0
            }
          });
          newRoles.push(newRole);
        }

        return newRoles;
      });

      res.json({
        success: true,
        message: 'Roles updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error updating employee roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating employee roles',
        error: error.message
      });
    }
  }
);

// POST /api/employees/:id/roles - Create/Save employee roles
router.post('/:id/roles',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    body('roles').isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { roles } = req.body;
      const tenantId = req.tenantId || req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      if (!roles || !Array.isArray(roles)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid roles data'
        });
      }

      // Upsert logic: update if id exists, create if not
      // Delete roles not in the list, then upsert the provided ones
      const result = await prisma.$transaction(async (tx) => {
        const savedRoles = [];

        for (const role of roles) {
          const roleData = {
            employee_id: employeeId,
            role_id: parseInt(role.role_id),
            sub_role_id: role.sub_role_id ? parseInt(role.sub_role_id) : null,
            tenant_id: tenantId,
            anni_esperienza: parseInt(role.anni_esperienza) || 0
          };

          let savedRole;

          if (role.id) {
            // Update existing role
            savedRole = await tx.employee_roles.update({
              where: { id: parseInt(role.id) },
              data: roleData
            });
          } else {
            // Create new role (unique constraint will prevent duplicates)
            try {
              savedRole = await tx.employee_roles.create({
                data: roleData
              });
            } catch (error) {
              // If duplicate, find and update the existing one
              if (error.code === 'P2002') { // Unique constraint violation
                const existing = await tx.employee_roles.findFirst({
                  where: {
                    employee_id: employeeId,
                    role_id: parseInt(role.role_id),
                    sub_role_id: role.sub_role_id ? parseInt(role.sub_role_id) : null
                  }
                });
                if (existing) {
                  savedRole = await tx.employee_roles.update({
                    where: { id: existing.id },
                    data: roleData
                  });
                } else {
                  throw error;
                }
              } else {
                throw error;
              }
            }
          }

          savedRoles.push(savedRole);
        }

        // Delete any roles for this employee that are not in the provided list
        const roleIds = roles.filter(r => r.id).map(r => parseInt(r.id));
        if (roleIds.length > 0) {
          await tx.employee_roles.deleteMany({
            where: {
              employee_id: employeeId,
              id: { notIn: roleIds }
            }
          });
        } else {
          // If no existing roles were provided, don't delete anything
          // (user might be adding first role)
        }

        return savedRoles;
      });

      res.json({
        success: true,
        message: 'Roles saved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error saving employee roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving employee roles',
        error: error.message
      });
    }
  }
);

// DELETE /api/employees/:id/roles/:roleId - Delete a specific employee role
router.delete('/:id/roles/:roleId',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    param('roleId').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const roleId = parseInt(req.params.roleId);

      // Hard delete the role
      await prisma.employee_roles.delete({
        where: { id: roleId }
      });

      res.json({
        success: true,
        message: 'Role removed successfully'
      });
    } catch (error) {
      console.error('Error deleting employee role:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting employee role',
        error: error.message
      });
    }
  }
);

// GET /api/employees/:id/skills - Get employee skills
router.get('/:id/skills',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      // Use raw query to join with skills table and get skill names
      const skills = await prisma.$queryRaw`
        SELECT
          es.*,
          s."Skill" as skill_name
        FROM employee_skills es
        LEFT JOIN skills s ON es.skill_id = s.id
        WHERE es.employee_id = ${employeeId}
        ORDER BY es.proficiency_level DESC
      `;

      res.json({
        success: true,
        data: skills
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching employee skills',
        error: error.message
      });
    }
  }
);

// POST /api/employees/:id/skills - Save employee skills (batch upsert)
router.post('/:id/skills',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    body('skills').isArray(),
    body('source').optional().isString()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { skills, source = 'manual' } = req.body;
      const tenantId = req.tenantId || req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      if (!skills || !Array.isArray(skills)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid skills data'
        });
      }

      // Upsert skills (update if exists, create if not)
      const operations = skills.map(skill =>
        prisma.employee_skills.upsert({
          where: {
            employee_id_skill_id: {
              employee_id: employeeId,
              skill_id: parseInt(skill.id)
            }
          },
          update: {
            proficiency_level: skill.grading || skill.proficiency_level || 0,
            years_experience: skill.years_experience || 0,
            source: source,
            notes: skill.notes || null,
            last_used_date: skill.last_used_date ? new Date(skill.last_used_date) : null
          },
          create: {
            employee_id: employeeId,
            skill_id: parseInt(skill.id),
            proficiency_level: skill.grading || skill.proficiency_level || 0,
            years_experience: skill.years_experience || 0,
            source: source,
            notes: skill.notes || null,
            tenant_id: tenantId,
            last_used_date: skill.last_used_date ? new Date(skill.last_used_date) : null
          }
        })
      );

      const result = await prisma.$transaction(operations);

      res.json({
        success: true,
        message: 'Skills saved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error saving employee skills:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving skills',
        error: error.message
      });
    }
  }
);

// GET /api/employees/:id/competenze - Get employee competenze trasversali
router.get('/:id/competenze',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      const competenze = await prisma.employee_competenze_trasversali.findMany({
        where: { employee_id: employeeId },
        orderBy: { created_at: 'desc' }
      });

      res.json({
        success: true,
        data: competenze
      });
    } catch (error) {
      console.error('Error fetching competenze trasversali:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching competenze trasversali',
        error: error.message
      });
    }
  }
);

// POST /api/employees/:id/competenze - Save employee competenze trasversali
router.post('/:id/competenze',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    body('competenze').isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { competenze } = req.body;
      const tenantId = req.tenantId || req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      // Delete existing and insert new
      await prisma.$transaction(async (tx) => {
        // Delete all existing
        await tx.employee_competenze_trasversali.deleteMany({
          where: { employee_id: employeeId }
        });

        // Insert new
        if (competenze && competenze.length > 0) {
          await tx.employee_competenze_trasversali.createMany({
            data: competenze.map(c => ({
              employee_id: employeeId,
              competenza: typeof c === 'string' ? c : c.competenza,
              categoria: typeof c === 'object' ? c.categoria : null,
              anni_esperienza: typeof c === 'object' ? c.anni_esperienza : null,
              livello: typeof c === 'object' ? c.livello : null,
              note: typeof c === 'object' ? c.note : null,
              tenant_id: tenantId
            }))
          });
        }

        // Also update employees.competenze_trasversali JSONB
        const jsonbArray = competenze.map(c =>
          typeof c === 'string' ? c : c.competenza
        );

        await tx.employees.update({
          where: { id: employeeId },
          data: {
            competenze_trasversali: jsonbArray
          }
        });
      });

      res.json({
        success: true,
        message: 'Competenze trasversali saved successfully'
      });
    } catch (error) {
      console.error('Error saving competenze trasversali:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving competenze trasversali',
        error: error.message
      });
    }
  }
);

// DELETE /api/employees/:id/competenze/:competenzaId - Delete competenza trasversale
router.delete('/:id/competenze/:competenzaId',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    param('competenzaId').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const competenzaId = parseInt(req.params.competenzaId);

      await prisma.employee_competenze_trasversali.delete({
        where: { id: competenzaId }
      });

      // Also update JSONB in employees table
      const remaining = await prisma.employee_competenze_trasversali.findMany({
        where: { employee_id: employeeId }
      });

      await prisma.employees.update({
        where: { id: employeeId },
        data: {
          competenze_trasversali: remaining.map(c => c.competenza)
        }
      });

      res.json({
        success: true,
        message: 'Competenza trasversale removed successfully'
      });
    } catch (error) {
      console.error('Error deleting competenza trasversale:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting competenza trasversale',
        error: error.message
      });
    }
  }
);

// DELETE /api/employees/:id/skills/:skillId - Delete employee skill
router.delete('/:id/skills/:skillId',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    param('skillId').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const skillId = parseInt(req.params.skillId);

      await prisma.employee_skills.deleteMany({
        where: {
          employee_id: employeeId,
          skill_id: skillId
        }
      });

      res.json({
        success: true,
        message: 'Skill removed successfully'
      });
    } catch (error) {
      console.error('Error deleting employee skill:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting skill',
        error: error.message
      });
    }
  }
);

// Update employee profile (for logged-in user with unified auth)
router.put('/profile', require('../middlewares/unifiedAuth').authenticateTenantUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const tenantId = req.user.tenantId;
    const {
      firstName,
      lastName,
      phone,
      currentRole,
      education,
      yearsOfExperience,
      seniority
    } = req.body;

    // Find the employee by email and tenant
    const employee = await prisma.employees.findFirst({
      where: {
        email: userEmail,
        tenant_id: tenantId
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Update employee data
    const updatedEmployee = await prisma.employees.update({
      where: { id: employee.id },
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        position: currentRole,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      employee: {
        firstName: updatedEmployee.first_name,
        lastName: updatedEmployee.last_name,
        email: updatedEmployee.email,
        phone: updatedEmployee.phone,
        position: updatedEmployee.position
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

module.exports = router;