const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

/**
 * Get all employees for the current tenant
 * @route GET /api/employees
 */
const getEmployees = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID not found in token'
      });
    }

    const employees = await prisma.employees.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        department: true,
        hire_date: true,
        is_active: true,
        created_at: true
      },
      orderBy: [
        { last_name: 'asc' },
        { first_name: 'asc' }
      ]
    });

    // Format the response to match frontend expectations
    const formattedEmployees = employees.map(emp => ({
      id: emp.id, // This is now an Integer
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      role: emp.role,
      department: emp.department,
      hire_date: emp.hire_date,
      isActive: emp.is_active
    }));

    logger.info('Retrieved employees', {
      tenantId,
      count: formattedEmployees.length
    });

    res.json({
      success: true,
      data: formattedEmployees
    });
  } catch (error) {
    logger.error('Error fetching employees', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees',
      details: error.message
    });
  }
};

/**
 * Get employees with their tenant_users mapping
 * Useful for migration and debugging
 * @route GET /api/employees/with-mapping
 */
const getEmployeesWithMapping = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const employees = await prisma.employees.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true
      },
      include: {
        tenant_users: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    const mappedEmployees = employees.map(emp => ({
      employee_id: emp.id, // Integer
      tenant_user_id: emp.tenant_users?.id || null, // String/UUID
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      email: emp.email,
      role: emp.role,
      has_tenant_user: !!emp.tenant_users
    }));

    res.json({
      success: true,
      data: mappedEmployees,
      stats: {
        total: mappedEmployees.length,
        with_tenant_user: mappedEmployees.filter(e => e.has_tenant_user).length,
        without_tenant_user: mappedEmployees.filter(e => !e.has_tenant_user).length
      }
    });
  } catch (error) {
    logger.error('Error fetching employees with mapping', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees with mapping',
      details: error.message
    });
  }
};

/**
 * Get single employee by ID
 * @route GET /api/employees/:id
 */
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    const employee = await prisma.employees.findFirst({
      where: {
        id: parseInt(id),
        tenant_id: tenantId
      },
      include: {
        tenant_users: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: employee.id,
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        hire_date: employee.hire_date,
        is_active: employee.is_active,
        tenant_user_id: employee.tenant_users?.id || null
      }
    });
  } catch (error) {
    logger.error('Error fetching employee by ID', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee',
      details: error.message
    });
  }
};

module.exports = {
  getEmployees,
  getEmployeesWithMapping,
  getEmployeeById
};