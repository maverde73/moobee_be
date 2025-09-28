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

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  importUsers
};