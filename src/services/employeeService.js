const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

class EmployeeService {
  // Create employee with automatic tenant_user creation
  async createEmployee(data) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Create employee record
        const employee = await tx.employees.create({
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone,
            hire_date: new Date(data.hireDate),
            department_id: data.departmentId,
            position: data.position,
            manager_id: data.managerId,
            employee_code: data.employeeCode,
            tenant_id: data.tenantId,
            is_active: true
          }
        });

        // 2. Create corresponding tenant_user for authentication
        const defaultPassword = data.password || 'Welcome123!';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const tenantUser = await tx.tenant_users.create({
          data: {
            tenant_id: data.tenantId,
            email: data.email,
            password_hash: hashedPassword,
            first_name: data.firstName,
            last_name: data.lastName,
            role: data.role || 'employee', // Default to employee, can be 'hr', 'admin', etc.
            employee_id: employee.id, // Link to employee
            is_active: true
          }
        });

        return {
          employee,
          tenantUser,
          temporaryPassword: defaultPassword
        };
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  // Update employee (also updates tenant_user if needed)
  async updateEmployee(id, data) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Update employee
        const employee = await tx.employees.update({
          where: { id },
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone,
            department_id: data.departmentId,
            position: data.position,
            manager_id: data.managerId,
            is_active: data.isActive
          }
        });

        // Update corresponding tenant_user if exists
        const tenantUser = await tx.tenant_users.findFirst({
          where: { employee_id: id }
        });

        if (tenantUser) {
          await tx.tenant_users.update({
            where: { id: tenantUser.id },
            data: {
              email: data.email,
              first_name: data.firstName,
              last_name: data.lastName,
              role: data.role || tenantUser.role,
              is_active: data.isActive
            }
          });
        }

        return employee;
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  }

  // Delete employee (soft delete)
  async deleteEmployee(id) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Soft delete employee
        const employee = await tx.employees.update({
          where: { id },
          data: { is_active: false }
        });

        // Deactivate corresponding tenant_user
        await tx.tenant_users.updateMany({
          where: { employee_id: id },
          data: { is_active: false }
        });

        return employee;
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }

  // Change employee role/permissions
  async changeEmployeeRole(employeeId, newRole, permissions = {}) {
    try {
      const tenantUser = await prisma.tenant_users.findFirst({
        where: { employee_id: employeeId }
      });

      if (!tenantUser) {
        throw new Error('No authentication record found for this employee');
      }

      return await prisma.tenant_users.update({
        where: { id: tenantUser.id },
        data: {
          role: newRole,
          permissions: permissions
        }
      });
    } catch (error) {
      console.error('Error changing employee role:', error);
      throw error;
    }
  }

  // Reset employee password
  async resetEmployeePassword(employeeId, newPassword) {
    try {
      const tenantUser = await prisma.tenant_users.findFirst({
        where: { employee_id: employeeId }
      });

      if (!tenantUser) {
        throw new Error('No authentication record found for this employee');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      return await prisma.tenant_users.update({
        where: { id: tenantUser.id },
        data: {
          password_hash: hashedPassword,
          password_reset_token: null,
          password_reset_expires_at: null
        }
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  // Get employee with authentication info
  async getEmployeeWithAuth(id) {
    try {
      return await prisma.employees.findUnique({
        where: { id },
        include: {
          tenant_user: {
            select: {
              id: true,
              email: true,
              role: true,
              permissions: true,
              last_login_at: true,
              is_active: true,
              two_factor_enabled: true
            }
          },
          departments_employees_department_idTodepartments: true,
          employee_roles: true
        }
      });
    } catch (error) {
      console.error('Error getting employee:', error);
      throw error;
    }
  }

  // Bulk create employees from CSV/Excel import
  async bulkCreateEmployees(employeesData, tenantId) {
    const results = {
      success: [],
      errors: []
    };

    for (const data of employeesData) {
      try {
        const result = await this.createEmployee({
          ...data,
          tenantId
        });
        results.success.push({
          email: data.email,
          employee: result.employee,
          temporaryPassword: result.temporaryPassword
        });
      } catch (error) {
        results.errors.push({
          email: data.email,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new EmployeeService();