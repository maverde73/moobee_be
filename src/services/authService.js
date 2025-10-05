const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');

class AuthService {
  // Generate access token (15 minutes)
  generateAccessToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_ACCESS_SECRET,
      { 
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        issuer: 'moobee-api'
      }
    );
  }

  // Generate refresh token (7 days)
  generateRefreshToken(payload) {
    const tokenId = uuidv4();
    const token = jwt.sign(
      { ...payload, tokenId },
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'moobee-api'
      }
    );
    return { token, tokenId };
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Login user
  async login(email, password) {
    // Find employee by email
    const employee = await prisma.employees.findFirst({
      where: { email },
      include: {
        departments: true,
        employee_roles: true
      }
    });

    if (!employee) {
      throw new Error('Invalid credentials');
    }

    // For now, we'll use a simple password check
    // In production, passwords should be stored in a separate auth table
    // This is just for demonstration
    const isValidPassword = await this.validatePassword(password, employee.id);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Create JWT payload
    const payload = {
      id: employee.id,
      email: employee.email,
      firstName: employee.first_name,
      lastName: employee.last_name,
      departmentId: employee.department_id,
      tenant_id: employee.tenant_id, // Add tenant_id to JWT
      roles: employee.employee_roles.map(er => ({
        roleId: er.role_id,
        subRoleId: er.sub_role_id
      }))
    };

    // Generate tokens
    const accessToken = this.generateAccessToken(payload);
    const { token: refreshToken, tokenId } = this.generateRefreshToken({ id: employee.id });

    // Store refresh token (in production, use Redis)
    // For now, we'll store it in a session tracking table or memory

    return {
      accessToken,
      refreshToken,
      employee: {
        id: employee.id,
        email: employee.email,
        firstName: employee.first_name,
        lastName: employee.last_name,
        position: employee.position,
        department: employee.departments?.department_name,
        roles: payload.roles
      }
    };
  }

  // Refresh tokens
  async refreshTokens(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Get employee data
      const employee = await prisma.employees.findFirst({
        where: { id: decoded.id },
        include: {
          departments: true,
          employee_roles: true
        }
      });

      if (!employee) {
        throw new Error('User not found');
      }

      // Create new JWT payload
      const payload = {
        id: employee.id,
        email: employee.email,
        firstName: employee.first_name,
        lastName: employee.last_name,
        departmentId: employee.department_id,
        tenant_id: employee.tenant_id, // Add tenant_id to JWT
        roles: employee.employee_roles.map(er => ({
          roleId: er.role_id,
          subRoleId: er.sub_role_id
        }))
      };

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(payload);
      const { token: newRefreshToken, tokenId } = this.generateRefreshToken({ id: employee.id });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Validate password (simplified for demo)
  async validatePassword(password, employeeId) {
    // In production, passwords should be stored in a separate auth table
    // For demo purposes, we'll accept password = "Password123!" for all users
    return password === 'Password123!';
  }

  // Hash password
  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  // Compare password
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

module.exports = new AuthService();