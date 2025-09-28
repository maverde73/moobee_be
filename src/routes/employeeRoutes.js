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
            employee_roles: {
              where: { is_current: true }
            }
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
            where: { is_current: true },
            select: {
              id: true,
              role_id: true,
              sub_role_id: true,
              start_date: true,
              is_current: true
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
  authorize('hr managers', 'administrators'),
  [
    param('id').isInt(),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
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

      // Build update data
      const updateData = {};
      if (req.body.firstName) updateData.first_name = req.body.firstName;
      if (req.body.lastName) updateData.last_name = req.body.lastName;
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.phone) updateData.phone = req.body.phone;
      if (req.body.departmentId) updateData.department_id = req.body.departmentId;
      if (req.body.position) updateData.position = req.body.position;
      if (req.body.managerId) updateData.manager_id = req.body.managerId;
      if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;
      updateData.updated_at = new Date();

      // Update employee
      const employee = await prisma.employees.update({
        where: { id: employeeId },
        data: updateData,
        include: {
          departments: true,
          employees: true
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

// GET /api/employees/:id/skills - Get employee skills
router.get('/:id/skills',
  authenticate,
  [
    param('id').isInt()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const skills = await prisma.employee_skills.findMany({
        where: { employee_id: parseInt(req.params.id) },
        orderBy: { proficiency_level: 'desc' }
      });

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

// POST /api/employees/:id/skills - Add skill to employee
router.post('/:id/skills',
  authenticate,
  [
    param('id').isInt(),
    body('skillId').isInt(),
    body('proficiencyLevel').isInt({ min: 1, max: 5 }),
    body('yearsExperience').optional().isFloat({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { skillId, proficiencyLevel, yearsExperience, notes } = req.body;

      // Check if skill already exists for employee
      const existingSkill = await prisma.employee_skills.findFirst({
        where: {
          employee_id: employeeId,
          skill_id: skillId
        }
      });

      if (existingSkill) {
        return res.status(400).json({
          success: false,
          message: 'Skill already exists for this employee'
        });
      }

      // Add skill
      const employeeSkill = await prisma.employee_skills.create({
        data: {
          employee_id: employeeId,
          skill_id: skillId,
          proficiency_level: proficiencyLevel,
          years_experience: yearsExperience,
          notes
        }
      });

      res.status(201).json({
        success: true,
        message: 'Skill added successfully',
        data: employeeSkill
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error adding skill',
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