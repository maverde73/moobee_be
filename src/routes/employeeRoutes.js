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

      // Note: Domain knowledge is now managed via separate endpoint /api/employees/:id/domain-knowledge
      // competenze_trasversali field removed from employees table

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

      // Authorization: HR roles can edit any employee, employees can only edit their own profile
      const userRole = req.user?.role;
      const userEmployeeId = req.user?.employeeId;
      const isHR = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR'].includes(userRole);
      const isSelfEdit = userEmployeeId && userEmployeeId === employeeId;

      if (!isHR && !isSelfEdit) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to edit this employee profile'
        });
      }

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

        // Count how many roles will be marked as current
        const currentRolesInRequest = roles.filter(r => r.is_current === true).length;

        // If setting a role as current, unset all other current roles first
        if (currentRolesInRequest > 0) {
          const roleIdsInRequest = roles.filter(r => r.id).map(r => parseInt(r.id));
          await tx.employee_roles.updateMany({
            where: {
              employee_id: employeeId,
              id: roleIdsInRequest.length > 0 ? { notIn: roleIdsInRequest } : undefined,
              is_current: true
            },
            data: { is_current: false }
          });
        }

        for (const role of roles) {
          // Get role_id from role_sub_role mapping if sub_role_id is provided
          let role_id = parseInt(role.role_id) || null;
          if (role.sub_role_id && (!role_id || role_id === 0)) {
            const mapping = await tx.role_sub_role.findFirst({
              where: { id_sub_role: parseInt(role.sub_role_id) }
            });

            if (!mapping) {
              throw new Error(`Invalid sub_role_id ${role.sub_role_id} - no mapping found`);
            }

            role_id = mapping.id_role;
          }

          const roleData = {
            employee_id: employeeId,
            role_id: role_id,
            sub_role_id: role.sub_role_id ? parseInt(role.sub_role_id) : null,
            tenant_id: tenantId,
            anni_esperienza: parseInt(role.anni_esperienza) || 0,
            seniority: role.seniority || null,
            is_current: role.is_current !== undefined ? role.is_current : false
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

// PUT /api/employees/:id/roles/:roleId - Update a specific employee role
router.put('/:id/roles/:roleId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('roleId').isInt(),
    body('sub_role_id').optional().isInt(),
    body('anni_esperienza').optional().isInt(),
    body('seniority').optional().isString(),
    body('is_current').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const roleId = parseInt(req.params.roleId);
      const { sub_role_id, anni_esperienza, seniority, is_current } = req.body;
      const tenantId = req.tenantId || req.user?.tenantId;

      // Authorization: HR roles can edit any employee, employees can only edit their own profile
      const userRole = req.user?.role;
      const userEmployeeId = req.user?.employeeId;
      const isHR = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR'].includes(userRole);
      const isSelfEdit = userEmployeeId && userEmployeeId === employeeId;

      if (!isHR && !isSelfEdit) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to edit this employee profile'
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      // Get role_id from role_sub_role mapping if sub_role_id is provided
      let role_id;
      if (sub_role_id) {
        const mapping = await prisma.role_sub_role.findFirst({
          where: { id_sub_role: parseInt(sub_role_id) }
        });

        if (!mapping) {
          return res.status(400).json({
            success: false,
            message: 'Invalid sub_role_id - no mapping found'
          });
        }

        role_id = mapping.id_role;
      }

      // Build update data object - only include fields that are being updated
      const updateData = {};

      if (role_id !== undefined) updateData.role_id = role_id;
      if (sub_role_id !== undefined) updateData.sub_role_id = parseInt(sub_role_id);
      if (anni_esperienza !== undefined) updateData.anni_esperienza = parseInt(anni_esperienza);
      if (seniority !== undefined) updateData.seniority = seniority;
      if (is_current !== undefined) updateData.is_current = is_current;

      // Only update tenant_id if provided (shouldn't change usually)
      if (tenantId && Object.keys(updateData).length === 0) {
        // If no other fields to update, at least ensure tenant_id is set
        updateData.tenant_id = tenantId;
      }

      // Use transaction to handle "one current role" constraint
      const updatedRole = await prisma.$transaction(async (tx) => {
        // Only enforce constraint if is_current is being modified
        if (is_current !== undefined) {
          // If setting this role as current, unset all other current roles for this employee
          if (is_current === true) {
            await tx.employee_roles.updateMany({
              where: {
                employee_id: employeeId,
                id: { not: roleId },
                is_current: true
              },
              data: { is_current: false }
            });
          }

          // If unsetting current and this is the only role, prevent the update
          if (is_current === false) {
            const roleCount = await tx.employee_roles.count({
              where: { employee_id: employeeId }
            });

            if (roleCount === 1) {
              throw new Error('Cannot unset current status: employee must have at least one current role');
            }

            // Check if there will be another current role after this update
            const otherCurrentRoles = await tx.employee_roles.count({
              where: {
                employee_id: employeeId,
                id: { not: roleId },
                is_current: true
              }
            });

            if (otherCurrentRoles === 0) {
              throw new Error('Cannot unset current status: employee must have at least one current role');
            }
          }
        }

        // Update the role
        return await tx.employee_roles.update({
          where: { id: roleId },
          data: updateData
        });
      });

      res.json({
        success: true,
        message: 'Role updated successfully',
        data: updatedRole
      });
    } catch (error) {
      console.error('Error updating employee role:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating employee role',
        error: error.message
      });
    }
  }
);

// DELETE /api/employees/:id/roles/:roleId - Delete a specific employee role
router.delete('/:id/roles/:roleId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('roleId').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const roleId = parseInt(req.params.roleId);

      // Authorization: HR roles can edit any employee, employees can only edit their own profile
      const userRole = req.user?.role;
      const userEmployeeId = req.user?.employeeId;
      const isHR = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR'].includes(userRole);
      const isSelfEdit = userEmployeeId && userEmployeeId === employeeId;

      if (!isHR && !isSelfEdit) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to edit this employee profile'
        });
      }

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

      // Get hard skills from employee_skills table
      const hardSkillsRaw = await prisma.$queryRaw`
        SELECT
          es.id,
          es.skill_id,
          es.proficiency_level,
          es.years_experience,
          es.source,
          es.last_used_date,
          s."Skill" as skill_name,
          s."NameKnown_Skill" as name_known_skill
        FROM employee_skills es
        LEFT JOIN skills s ON es.skill_id = s.id
        WHERE es.employee_id = ${employeeId}
        ORDER BY es.proficiency_level DESC
      `;

      // Transform to frontend format
      const hardSkills = hardSkillsRaw.map(skill => ({
        id: skill.skill_id.toString(),
        name: skill.name_known_skill || skill.skill_name || 'Unknown Skill',
        level: skill.proficiency_level || 0,
        category: 'Technical Skills', // Default category since not stored in DB
        source: skill.source || 'manual',
        lastAssessedDate: skill.last_used_date ? skill.last_used_date.toISOString() : null,
        yearsOfExperience: skill.years_experience || 0
      }));

      // Get soft skills from employee_soft_skills table (if it exists)
      let softSkills = [];
      try {
        const softSkillsRaw = await prisma.employee_soft_skills.findMany({
          where: { employee_id: employeeId },
          include: {
            soft_skills: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        softSkills = softSkillsRaw.map(skill => ({
          id: skill.soft_skill_id.toString(),
          name: skill.soft_skills?.name || 'Unknown Soft Skill',
          level: skill.proficiency_level || 0,
          source: skill.source || 'manual',
          lastAssessedDate: skill.assessed_date ? skill.assessed_date.toISOString() : null
        }));
      } catch (error) {
        // Table might not exist yet - return empty array
        console.log('Soft skills table not found or error:', error.message);
      }

      res.json({
        success: true,
        data: {
          hard: hardSkills,
          soft: softSkills
        }
      });
    } catch (error) {
      console.error('Error fetching employee skills:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching employee skills',
        error: error.message
      });
    }
  }
);

// PUT /api/employees/:id/skills - Update employee skills from assessment
router.put('/:id/skills',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    body('hard').isArray(),
    body('soft').optional().isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { hard, soft = [] } = req.body;
      const tenantId = req.tenantId || req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      // Upsert hard skills
      const hardSkillOps = hard.map(skill =>
        prisma.employee_skills.upsert({
          where: {
            employee_id_skill_id: {
              employee_id: employeeId,
              skill_id: parseInt(skill.id)
            }
          },
          update: {
            proficiency_level: skill.level || 0,
            years_experience: skill.yearsOfExperience || 0,
            source: skill.source || 'assessment',
            notes: skill.notes || null,
            last_used_date: skill.lastAssessedDate ? new Date(skill.lastAssessedDate) : new Date(),
            updated_at: new Date()
          },
          create: {
            employee_id: employeeId,
            skill_id: parseInt(skill.id),
            proficiency_level: skill.level || 0,
            years_experience: skill.yearsOfExperience || 0,
            source: skill.source || 'assessment',
            notes: skill.notes || null,
            last_used_date: skill.lastAssessedDate ? new Date(skill.lastAssessedDate) : new Date(),
            tenant_id: tenantId,
            created_at: new Date(),
            updated_at: new Date()
          }
        })
      );

      await Promise.all(hardSkillOps);

      res.json({
        success: true,
        message: 'Skills updated successfully',
        data: {
          hardSkillsUpdated: hard.length,
          softSkillsUpdated: soft.length
        }
      });
    } catch (error) {
      console.error('Error updating employee skills:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating employee skills',
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

// GET /api/employees/:id/domain-knowledge - Get employee domain knowledge
router.get('/:id/domain-knowledge',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      const domainKnowledge = await prisma.employee_domain_knowledge.findMany({
        where: { employee_id: employeeId },
        orderBy: { created_at: 'desc' }
      });

      // Group by domain_type for easier frontend consumption
      const grouped = {
        industry: [],
        standard: [],
        process: [],
        sector: []
      };

      domainKnowledge.forEach(dk => {
        if (grouped[dk.domain_type]) {
          grouped[dk.domain_type].push({
            id: dk.id,
            value: dk.domain_value,
            source: dk.source,
            confidence_score: dk.confidence_score,
            years_experience: dk.years_experience,
            created_at: dk.created_at
          });
        }
      });

      res.json({
        success: true,
        data: {
          raw: domainKnowledge,
          grouped: grouped
        }
      });
    } catch (error) {
      console.error('Error fetching domain knowledge:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching domain knowledge',
        error: error.message
      });
    }
  }
);

// POST /api/employees/:id/domain-knowledge - Save employee domain knowledge
router.post('/:id/domain-knowledge',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    body('domains').isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { domains } = req.body;

      if (!domains || !Array.isArray(domains)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid domains data'
        });
      }

      // Upsert domain knowledge (prevents duplicates via unique constraint)
      const operations = domains.map(domain =>
        prisma.employee_domain_knowledge.upsert({
          where: {
            unique_employee_domain: {
              employee_id: employeeId,
              domain_type: domain.domain_type,
              domain_value: domain.domain_value
            }
          },
          update: {
            confidence_score: domain.confidence_score || null,
            years_experience: domain.years_experience || null,
            source: domain.source || 'manual',
            updated_at: new Date()
          },
          create: {
            employee_id: employeeId,
            domain_type: domain.domain_type,
            domain_value: domain.domain_value,
            confidence_score: domain.confidence_score || null,
            years_experience: domain.years_experience || null,
            source: domain.source || 'manual'
          }
        })
      );

      const result = await prisma.$transaction(operations);

      res.json({
        success: true,
        message: 'Domain knowledge saved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error saving domain knowledge:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving domain knowledge',
        error: error.message
      });
    }
  }
);

// DELETE /api/employees/:id/domain-knowledge/:domainId - Delete domain knowledge
router.delete('/:id/domain-knowledge/:domainId',
  authenticate,
  determineTenant,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  [
    param('id').isInt(),
    param('domainId').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const domainId = parseInt(req.params.domainId);

      await prisma.employee_domain_knowledge.delete({
        where: { id: domainId }
      });

      res.json({
        success: true,
        message: 'Domain knowledge removed successfully'
      });
    } catch (error) {
      console.error('Error deleting domain knowledge:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting domain knowledge',
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

// POST /api/employees/:id/cv - Upload and analyze CV
router.post('/:id/cv',
  authenticate,
  async (req, res) => {
    console.log('[Employee CV Route] Authenticated user:', req.user);
    console.log('[Employee CV Route] Employee ID param:', req.params.id);

    try {
      const multer = require('multer');
      const CVExtractionService = require('../services/cvExtractionService');

      // Configure multer for memory storage
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (req, file, cb) => {
          const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
          if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Only PDF and DOCX files are allowed'));
          }
        }
      }).single('cv');

      // Handle file upload
      upload(req, res, async (err) => {
        if (err) {
          console.error('[Employee CV Upload] Multer error:', err);
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }

        try {
          // Employee ID can be UUID or integer
          const employeeId = req.params.id;
          const tenantId = req.user?.tenant_id || req.user?.tenantId;
          const userId = req.user?.id || req.user?.userId;

          console.log(`[Employee CV Upload] Processing CV for employee ${employeeId}`);

          // Only save the CV file metadata to cv_extractions table (no extraction yet)
          const prisma = require('../config/database');

          // Create a cv_extraction record with file info (extraction will happen separately)
          const cvExtraction = await prisma.cv_extractions.create({
            data: {
              employee_id: parseInt(employeeId),
              tenant_id: tenantId,
              updated_by: userId, // User who uploaded
              original_filename: req.file.originalname,
              file_size_bytes: BigInt(req.file.size),
              file_type: req.file.mimetype,
              file_content: req.file.buffer, // Save binary file (BYTEA)
              status: 'pending', // Pending extraction (allowed by constraint)
              created_at: new Date(),
              updated_at: new Date()
            }
          });

          console.log(`[Employee CV Upload] CV file saved with ID ${cvExtraction.id}`);

          return res.json({
            success: true,
            data: {
              fileName: req.file.originalname,
              uploadDate: new Date().toISOString(),
              cvExtractionId: cvExtraction.id
            }
          });

        } catch (error) {
          console.error('[Employee CV Upload] Extraction error:', error);
          return res.status(500).json({
            success: false,
            message: 'CV extraction failed',
            error: error.message
          });
        }
      });

    } catch (error) {
      console.error('[Employee CV Upload] Route error:', error);
      return res.status(500).json({
        success: false,
        message: 'CV upload failed',
        error: error.message
      });
    }
  }
);

// GET /api/employees/:id/cv-extraction-status - Check CV extraction status
router.get('/:id/cv-extraction-status', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    console.log(`[CV Extraction Status] Checking for employee ${employeeId}`);

    // Get latest cv_extraction record for this employee
    const latestExtraction = await prisma.cv_extractions.findFirst({
      where: { employee_id: employeeId },
      orderBy: { created_at: 'desc' }
    });

    if (!latestExtraction) {
      return res.json({
        status: 'pending',
        message: 'No CV uploaded yet'
      });
    }

    // Map database status to frontend status
    const statusMap = {
      'pending': 'pending',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed'
    };

    const response = {
      status: statusMap[latestExtraction.status] || 'pending',
      extracted_text: latestExtraction.extracted_text,
      error: latestExtraction.error_message,
      created_at: latestExtraction.created_at,
      updated_at: latestExtraction.updated_at
    };

    // If completed, include stats from extraction_result JSON
    if (latestExtraction.status === 'completed' && latestExtraction.extraction_result) {
      const result = latestExtraction.extraction_result;
      response.stats = {
        personal_info: result.personal_info,
        education: result.education,
        work_experience: result.work_experience,
        skills: result.skills,
        languages: result.languages,
        certifications: result.certifications,
        seniority_info: result.seniority_info
      };
    }

    console.log(`[CV Extraction Status] Status: ${response.status}`);
    return res.json(response);

  } catch (error) {
    console.error('[CV Extraction Status] Error:', error);
    return res.status(500).json({
      status: 'failed',
      error: error.message
    });
  }
});

// GET /api/employees/:id/education - Get employee education
router.get('/:id/education', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    const education = await prisma.employee_education.findMany({
      where: { employee_id: employeeId },
      include: {
        education_degrees: true
      },
      orderBy: { start_date: 'desc' }
    });

    res.json({ success: true, data: education });
  } catch (error) {
    console.error('[Employee Education] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/employees/:id/certifications - Get employee certifications
router.get('/:id/certifications', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    const certifications = await prisma.employee_certifications.findMany({
      where: { employee_id: employeeId },
      orderBy: { issue_date: 'desc' }
    });

    res.json({ success: true, data: certifications });
  } catch (error) {
    console.error('[Employee Certifications] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/employees/:id/languages - Get employee languages
router.get('/:id/languages', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    const languages = await prisma.employee_languages.findMany({
      where: { employee_id: employeeId },
      include: {
        languages: {
          select: { name: true, iso_code_639_1: true }
        }
      }
    });

    res.json({ success: true, data: languages });
  } catch (error) {
    console.error('[Employee Languages] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/employees/:id/work-history - Get employee work experiences
router.get('/:id/work-history', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    const workHistory = await prisma.employee_work_experiences.findMany({
      where: { employee_id: employeeId },
      include: {
        companies: {
          select: { id: true, name: true }
        }
      },
      orderBy: { start_date: 'desc' }
    });

    // Transform to frontend format
    const transformedWorkHistory = workHistory.map(exp => ({
      id: exp.id.toString(),
      role: exp.job_title || '',
      company: exp.companies?.name || exp.company_name || '',
      startDate: exp.start_date ? new Date(exp.start_date).toISOString() : '',
      endDate: exp.end_date ? new Date(exp.end_date).toISOString() : null,
      isCurrent: exp.is_current || false,
      description: exp.description || '',
      technologies: [], // TODO: Add technologies extraction if available
      location: exp.location || '',
      type: exp.experience_type || 'client' // internal or client
    }));

    res.json({ success: true, data: transformedWorkHistory });
  } catch (error) {
    console.error('[Employee Work History] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/employees/:id/projects - Get employee projects
router.get('/:id/projects', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    const projects = await prisma.employee_projects.findMany({
      where: { employee_id: employeeId },
      orderBy: { start_date: 'desc' }
    });

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('[Employee Projects] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/employees/:id/preferences - Get employee preferences
router.get('/:id/preferences', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    // Return empty preferences for now (can be implemented later)
    const preferences = {
      remote_work: null,
      willing_to_relocate: null,
      preferred_locations: [],
      contract_type_preferences: []
    };

    res.json({ success: true, data: preferences });
  } catch (error) {
    console.error('[Employee Preferences] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/employees/:id/availability - Get employee availability
router.get('/:id/availability', authenticate, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    // Return empty availability for now (can be implemented later)
    const availability = {
      available_from: null,
      notice_period_days: null,
      availability_status: 'unknown'
    };

    res.json({ success: true, data: availability });
  } catch (error) {
    console.error('[Employee Availability] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EDUCATION ENDPOINTS
// ============================================================================

// GET /api/employees/:id/education - Get employee education
router.get('/:id/education',
  authenticate,
  determineTenant,
  [param('id').isInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      const education = await prisma.employee_education.findMany({
        where: { employee_id: employeeId },
        orderBy: [
          { is_current: 'desc' },
          { end_date: 'desc' }
        ]
      });

      res.json({
        success: true,
        data: education
      });
    } catch (error) {
      console.error('Error fetching education:', error);
      res.status(500).json({ success: false, message: 'Error fetching education', error: error.message });
    }
  }
);

// POST /api/employees/:id/education - Create education
router.post('/:id/education',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    body('degree_name').notEmpty(),
    body('institution_name').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const educationData = { ...req.body, employee_id: employeeId };

      const education = await prisma.employee_education.create({
        data: educationData
      });

      res.json({
        success: true,
        message: 'Education created successfully',
        data: education
      });
    } catch (error) {
      console.error('Error creating education:', error);
      res.status(500).json({ success: false, message: 'Error creating education', error: error.message });
    }
  }
);

// PUT /api/employees/:id/education/:educationId - Update education
router.put('/:id/education/:educationId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('educationId').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const educationId = req.params.educationId;
      const education = await prisma.employee_education.update({
        where: { id: educationId },
        data: req.body
      });

      res.json({
        success: true,
        message: 'Education updated successfully',
        data: education
      });
    } catch (error) {
      console.error('Error updating education:', error);
      res.status(500).json({ success: false, message: 'Error updating education', error: error.message });
    }
  }
);

// DELETE /api/employees/:id/education/:educationId - Delete education
router.delete('/:id/education/:educationId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('educationId').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const educationId = req.params.educationId;
      await prisma.employee_education.delete({
        where: { id: educationId }
      });

      res.json({
        success: true,
        message: 'Education deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting education:', error);
      res.status(500).json({ success: false, message: 'Error deleting education', error: error.message });
    }
  }
);

// ============================================================================
// CERTIFICATIONS ENDPOINTS
// ============================================================================

// GET /api/employees/:id/certifications - Get employee certifications
router.get('/:id/certifications',
  authenticate,
  determineTenant,
  [param('id').isInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      const certifications = await prisma.employee_certifications.findMany({
        where: { employee_id: employeeId },
        orderBy: [
          { is_active: 'desc' },
          { issue_date: 'desc' }
        ]
      });

      res.json({
        success: true,
        data: certifications
      });
    } catch (error) {
      console.error('Error fetching certifications:', error);
      res.status(500).json({ success: false, message: 'Error fetching certifications', error: error.message });
    }
  }
);

// POST /api/employees/:id/certifications - Create certification
router.post('/:id/certifications',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    body('certification_name').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const certData = { ...req.body, employee_id: employeeId };

      const certification = await prisma.employee_certifications.create({
        data: certData
      });

      res.json({
        success: true,
        message: 'Certification created successfully',
        data: certification
      });
    } catch (error) {
      console.error('Error creating certification:', error);
      res.status(500).json({ success: false, message: 'Error creating certification', error: error.message });
    }
  }
);

// PUT /api/employees/:id/certifications/:certId - Update certification
router.put('/:id/certifications/:certId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('certId').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const certId = req.params.certId;
      const certification = await prisma.employee_certifications.update({
        where: { id: certId },
        data: req.body
      });

      res.json({
        success: true,
        message: 'Certification updated successfully',
        data: certification
      });
    } catch (error) {
      console.error('Error updating certification:', error);
      res.status(500).json({ success: false, message: 'Error updating certification', error: error.message });
    }
  }
);

// DELETE /api/employees/:id/certifications/:certId - Delete certification
router.delete('/:id/certifications/:certId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('certId').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const certId = req.params.certId;
      await prisma.employee_certifications.delete({
        where: { id: certId }
      });

      res.json({
        success: true,
        message: 'Certification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting certification:', error);
      res.status(500).json({ success: false, message: 'Error deleting certification', error: error.message });
    }
  }
);

// ============================================================================
// LANGUAGES ENDPOINTS
// ============================================================================

// GET /api/employees/:id/languages - Get employee languages
router.get('/:id/languages',
  authenticate,
  determineTenant,
  [param('id').isInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      const languages = await prisma.employee_languages.findMany({
        where: { employee_id: employeeId },
        include: {
          languages: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { is_native: 'desc' },
          { created_at: 'asc' }
        ]
      });

      // Flatten language_name into main object and remove nested languages object
      const formatted = languages.map(lang => {
        const { languages: langObj, ...rest } = lang;
        return {
          ...rest,
          language_name: langObj?.name
        };
      });

      console.log('[Languages API] Returning data:', JSON.stringify(formatted, null, 2));

      res.json({
        success: true,
        data: formatted
      });
    } catch (error) {
      console.error('Error fetching languages:', error);
      res.status(500).json({ success: false, message: 'Error fetching languages', error: error.message });
    }
  }
);

// POST /api/employees/:id/languages - Create language
router.post('/:id/languages',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    body('language_id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const langData = { ...req.body, employee_id: employeeId };

      const language = await prisma.employee_languages.create({
        data: langData,
        include: {
          languages: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      const { languages: langObj, ...rest } = language;
      res.json({
        success: true,
        message: 'Language created successfully',
        data: {
          ...rest,
          language_name: langObj?.name
        }
      });
    } catch (error) {
      console.error('Error creating language:', error);
      res.status(500).json({ success: false, message: 'Error creating language', error: error.message });
    }
  }
);

// PUT /api/employees/:id/languages/:langId - Update language
router.put('/:id/languages/:langId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('langId').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const langId = req.params.langId;
      const language = await prisma.employee_languages.update({
        where: { id: langId },
        data: req.body,
        include: {
          languages: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      const { languages: langObj, ...rest } = language;
      res.json({
        success: true,
        message: 'Language updated successfully',
        data: {
          ...rest,
          language_name: langObj?.name
        }
      });
    } catch (error) {
      console.error('Error updating language:', error);
      res.status(500).json({ success: false, message: 'Error updating language', error: error.message });
    }
  }
);

// DELETE /api/employees/:id/languages/:langId - Delete language
router.delete('/:id/languages/:langId',
  authenticate,
  determineTenant,
  [
    param('id').isInt(),
    param('langId').notEmpty()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const langId = req.params.langId;
      await prisma.employee_languages.delete({
        where: { id: langId }
      });

      res.json({
        success: true,
        message: 'Language deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting language:', error);
      res.status(500).json({ success: false, message: 'Error deleting language', error: error.message });
    }
  }
);

module.exports = router;