const prisma = require('../config/database');

class EmployeeController {
  // Get all employees for the tenant
  async getEmployees(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';

      // Debug logs
      console.log('=== Employee Controller - getEmployees ===');
      console.log('Query params:', req.query);
      console.log('Search term:', search, 'Length:', search.length);
      console.log('Page:', page, 'Limit:', limit, 'Skip:', skip);

      // Use tenantId from middleware
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      // Build where clause
      const whereClause = {
        tenant_id: tenantId
      };

      // Add search filter if search term is provided (minimum 3 characters)
      if (search && search.length >= 3) {
        console.log('Adding search filter for:', search);
        whereClause.OR = [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      } else {
        console.log('No search filter applied (search too short or empty)');
      }

      console.log('Final where clause:', JSON.stringify(whereClause, null, 2));

      // Get total count for pagination with search
      const totalCount = await prisma.employees.count({
        where: whereClause
      });

      // Get employees for this tenant with search
      const employees = await prisma.employees.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          departments: true,
          employee_roles: {
            where: { is_current: true },
            include: {
              roles: true,
              sub_roles: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      console.log(`Found ${employees.length} employees (Total: ${totalCount})`);

      // Format response
      const formattedEmployees = employees.map(emp => ({
        id: emp.id,
        email: emp.email,
        firstName: emp.first_name,
        lastName: emp.last_name,
        position: emp.position,
        department: emp.departments?.department_name,
        departmentId: emp.department_id,
        phone: emp.phone,
        createdAt: emp.created_at,
        updatedAt: emp.updated_at,
        roles: emp.employee_roles.map(er => ({
          roleId: er.role_id,
          roleName: er.roles?.role_name,
          subRoleId: er.sub_role_id,
          subRoleName: er.sub_roles?.sub_role_name
        }))
      }));

      res.json({
        success: true,
        data: formattedEmployees,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employees',
        error: error.message
      });
    }
  }

  // Get single employee by ID
  async getEmployee(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      const employee = await prisma.employees.findFirst({
        where: {
          id: parseInt(id),
          tenant_id: tenantId
        },
        include: {
          departments: true,
          employee_roles: {
            where: { is_current: true },
            include: {
              roles: true,
              sub_roles: true
            }
          }
        }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const formattedEmployee = {
        id: employee.id,
        email: employee.email,
        firstName: employee.first_name,
        lastName: employee.last_name,
        position: employee.position,
        department: employee.departments?.department_name,
        departmentId: employee.department_id,
        phone: employee.phone,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
        roles: employee.employee_roles.map(er => ({
          roleId: er.role_id,
          roleName: er.roles?.role_name,
          subRoleId: er.sub_role_id,
          subRoleName: er.sub_roles?.sub_role_name
        }))
      };

      res.json({
        success: true,
        data: formattedEmployee
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee',
        error: error.message
      });
    }
  }

  // Create new employee
  async createEmployee(req, res) {
    try {
      const tenantId = req.tenantId;
      const {
        email,
        firstName,
        lastName,
        position,
        departmentId,
        phone
      } = req.body;

      // Check if employee with this email already exists for this tenant
      const existingEmployee = await prisma.employees.findFirst({
        where: {
          email,
          tenant_id: tenantId
        }
      });

      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Employee with this email already exists'
        });
      }

      const newEmployee = await prisma.employees.create({
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          position,
          department_id: departmentId,
          phone,
          tenant_id: tenantId,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      res.status(201).json({
        success: true,
        data: newEmployee,
        message: 'Employee created successfully'
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create employee',
        error: error.message
      });
    }
  }

  // Update employee
  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      const {
        email,
        firstName,
        lastName,
        position,
        departmentId,
        phone
      } = req.body;

      // Check if employee exists and belongs to this tenant
      const employee = await prisma.employees.findFirst({
        where: {
          id: parseInt(id),
          tenant_id: tenantId
        }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const updatedEmployee = await prisma.employees.update({
        where: { id: parseInt(id) },
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          position,
          department_id: departmentId,
          phone,
          updated_at: new Date()
        }
      });

      res.json({
        success: true,
        data: updatedEmployee,
        message: 'Employee updated successfully'
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update employee',
        error: error.message
      });
    }
  }

  // Delete employee
  async deleteEmployee(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      // Check if employee exists and belongs to this tenant
      const employee = await prisma.employees.findFirst({
        where: {
          id: parseInt(id),
          tenant_id: tenantId
        }
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      await prisma.employees.delete({
        where: { id: parseInt(id) }
      });

      res.json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete employee',
        error: error.message
      });
    }
  }
}

module.exports = new EmployeeController();