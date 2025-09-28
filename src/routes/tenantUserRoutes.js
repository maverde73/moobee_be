/**
 * @module TenantUserRoutes
 * @description Route per la gestione degli utenti tenant
 * Refactored: da 963 righe a <200 righe per rispettare Giurelli Standards
 * La logica business è stata spostata in controller, service, validator e helpers
 */

const express = require('express');
const router = express.Router();

// Controllers
const tenantUserController = require('../controllers/tenantUserController');

// Middlewares
const { requireAdmin } = require('../middlewares/unifiedAuth');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Validators
const {
  validateTenantId,
  validateUserId,
  validateUserCreate,
  validateUserUpdate,
  validateImport
} = require('../validators/tenantUserValidator');

/**
 * @route GET /api/tenants/:tenantId/users
 * @description Ottiene tutti gli utenti di un tenant
 * @access Private - Admin, HR, HR Manager
 */
router.get('/tenants/:tenantId/users',
  authenticate,
  authorize(['admin', 'super_admin', 'hr', 'hr_manager', 'HR', 'HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
  validateTenantId,
  tenantUserController.getAllUsers
);

/**
 * @route GET /api/tenants/:tenantId/users/:userId
 * @description Ottiene un singolo utente per ID
 * @access Private - Admin only
 */
router.get('/tenants/:tenantId/users/:userId',
  requireAdmin,
  validateTenantId,
  validateUserId,
  tenantUserController.getUserById
);

/**
 * @route POST /api/tenants/:tenantId/users
 * @description Crea un nuovo utente tenant
 * @access Private - Admin, HR_MANAGER, HR
 */
router.post('/tenants/:tenantId/users',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  validateTenantId,
  validateUserCreate,
  tenantUserController.createUser
);

/**
 * @route PUT /api/tenants/:tenantId/users/:userId
 * @description Aggiorna un utente esistente
 * @access Private - Admin, HR_MANAGER, HR
 */
router.put('/tenants/:tenantId/users/:userId',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  validateTenantId,
  validateUserId,
  validateUserUpdate,
  tenantUserController.updateUser
);

/**
 * @route DELETE /api/tenants/:tenantId/users/:userId
 * @description Elimina un utente (soft delete)
 * @access Private - Admin only
 */
router.delete('/tenants/:tenantId/users/:userId',
  requireAdmin,
  validateTenantId,
  validateUserId,
  tenantUserController.deleteUser
);

/**
 * @route POST /api/tenants/:tenantId/users/import
 * @description Importa utenti da CSV
 * @access Private - Admin only
 */
router.post('/tenants/:tenantId/users/import',
  requireAdmin,
  validateTenantId,
  validateImport,
  tenantUserController.importUsers
);

/**
 * @route PUT /api/tenant-users/:id
 * @description Update tenant user by ID (direct access without tenantId)
 * @access Private - Admin, HR_MANAGER, HR
 */
router.put('/tenant-users/:id',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  tenantUserController.updateTenantUserById
);

/**
 * @route PUT /api/tenant-users/:id/password
 * @description Update tenant user password
 * @access Private - Admin, HR_MANAGER, HR
 */
router.put('/tenant-users/:id/password',
  authenticate,
  authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
  tenantUserController.updateTenantUserPassword
);

module.exports = router;