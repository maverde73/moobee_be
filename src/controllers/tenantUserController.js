/**
 * @module TenantUserController
 * @description Controller per la gestione degli utenti tenant
 * Separato da tenantUserRoutes.js per rispettare Giurelli Standards (max 500 righe/file)
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const tenantUserService = require('../services/tenantUserService');
const { generateTempPassword, formatUserResponse, generateImportReport } = require('../utils/tenantUserHelpers');

/**
 * @description Ottiene tutti gli utenti di un tenant
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getAllUsers = async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || tenant.is_deleted) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const users = await tenantUserService.getUsersForTenant(tenantId);

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

/**
 * @description Ottiene un singolo utente per ID
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getUserById = async (req, res) => {
  try {
    const { tenantId, userId } = req.params;

    const user = await tenantUserService.getUserById(userId, tenantId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: formatUserResponse(user)
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

/**
 * @description Crea un nuovo utente tenant
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const createUser = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userData = req.body;

    // Prevent HR_MANAGER and HR from creating ADMIN or SUPER_ADMIN users
    const currentUserRole = req.user?.role || req.decoded?.role;
    const restrictedRoles = ['ADMIN', 'SUPER_ADMIN'];

    if (userData.role && restrictedRoles.includes(userData.role.toUpperCase())) {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per creare utenti con ruolo ADMIN o SUPER_ADMIN'
        });
      }
    }

    // Check if user already exists
    const existingUser = await tenantUserService.checkUserExists(userData.email, tenantId);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user with hashed password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = await tenantUserService.createUser({
      ...userData,
      id: uuidv4(),
      tenant_id: tenantId,
      password_hash: hashedPassword
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: formatUserResponse(newUser)
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

/**
 * @description Aggiorna un utente esistente
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateUser = async (req, res) => {
  try {
    const { tenantId, userId } = req.params;
    const updateData = req.body;

    // Prevent HR_MANAGER and HR from updating to ADMIN or SUPER_ADMIN role
    const currentUserRole = req.user?.role || req.decoded?.role;
    const restrictedRoles = ['ADMIN', 'SUPER_ADMIN'];

    if (updateData.role && restrictedRoles.includes(updateData.role.toUpperCase())) {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per assegnare ruolo ADMIN o SUPER_ADMIN'
        });
      }
    }

    // If password is being updated, hash it
    if (updateData.password) {
      updateData.password_hash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }

    // If force password change is set, handle it
    if (updateData.forcePasswordChange) {
      updateData.password_reset_token = uuidv4();
      updateData.password_reset_expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      delete updateData.forcePasswordChange;
    }

    const updatedUser = await tenantUserService.updateUser(userId, tenantId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: formatUserResponse(updatedUser)
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

/**
 * @description Elimina un utente
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const deleteUser = async (req, res) => {
  try {
    const { tenantId, userId } = req.params;

    const deleted = await tenantUserService.deleteUser(userId, tenantId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

/**
 * @description Importa utenti da CSV
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const importUsers = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { users } = req.body;

    console.log('Import request received for tenant:', tenantId);
    console.log('Number of users to import:', users.length);

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || tenant.is_deleted) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const importResult = await tenantUserService.importUsers(tenantId, users);
    const report = await generateImportReport(tenantId, importResult);

    res.json({
      success: true,
      message: `Import completed: ${importResult.created} created, ${importResult.updated} updated, ${importResult.skipped} skipped`,
      summary: importResult.summary,
      detailedReport: importResult.detailedReport,
      reportFile: report.fileName,
      reportPath: report.filePath,
      errors: importResult.errors.length > 0 ? importResult.errors : undefined,
      users: importResult.processedUsers
    });
  } catch (error) {
    console.error('Error importing users:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing users',
      error: error.message
    });
  }
};

/**
 * Update tenant user by ID (direct access without tenantId)
 */
const updateTenantUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('Updating tenant user:', id, updateData);

    // Find the tenant user
    const tenantUser = await prisma.tenant_users.findUnique({
      where: { id: id }
    });

    if (!tenantUser) {
      return res.status(404).json({
        success: false,
        message: 'Tenant user not found'
      });
    }

    // Check role restrictions for non-admin users
    const currentUserRole = req.user.role?.toUpperCase();
    const restrictedRoles = ['ADMIN', 'SUPER_ADMIN'];

    if (updateData.role && restrictedRoles.includes(updateData.role.toUpperCase())) {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per assegnare ruoli ADMIN o SUPER_ADMIN'
        });
      }
    }

    // Update the tenant user
    const updated = await prisma.tenant_users.update({
      where: { id: id },
      data: {
        email: updateData.email || tenantUser.email,
        role: updateData.role?.toUpperCase() || tenantUser.role,
        is_active: updateData.is_active !== undefined ? updateData.is_active : tenantUser.is_active,
        force_password_change: updateData.force_password_change !== undefined ? updateData.force_password_change : tenantUser.force_password_change,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Utente aggiornato con successo',
      data: updated
    });
  } catch (error) {
    console.error('Error updating tenant user by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tenant user',
      error: error.message
    });
  }
};

/**
 * Update tenant user password
 */
const updateTenantUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La password deve essere di almeno 8 caratteri'
      });
    }

    // Find the tenant user
    const tenantUser = await prisma.tenant_users.findUnique({
      where: { id: id }
    });

    if (!tenantUser) {
      return res.status(404).json({
        success: false,
        message: 'Tenant user not found'
      });
    }

    // Hash the password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the password
    await prisma.tenant_users.update({
      where: { id: id },
      data: {
        password: hashedPassword,
        force_password_change: false,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Password aggiornata con successo'
    });
  } catch (error) {
    console.error('Error updating tenant user password:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  importUsers,
  updateTenantUserById,
  updateTenantUserPassword
};