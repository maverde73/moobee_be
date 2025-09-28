const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getEmployees,
  getEmployeesWithMapping,
  getEmployeeById
} = require('../controllers/employeesController');

// All routes require authentication
router.use(authenticateToken);

// Get all employees for the tenant
router.get('/', getEmployees);

// Get employees with tenant_users mapping (for debugging)
router.get('/with-mapping', getEmployeesWithMapping);

// Get single employee by ID
router.get('/:id', getEmployeeById);

module.exports = router;