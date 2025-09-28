/**
 * Role Validators
 * @module controllers/project/validators/roleValidators
 * @created 2025-09-27 19:30
 *
 * Validation functions for role operations
 */

/**
 * Validate role input for create/update
 * @param {Object} body - Request body
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validation result {isValid, errors}
 */
function validateRoleInput(body, isUpdate = false) {
  const errors = [];

  // Required fields for creation
  if (!isUpdate) {
    if (!body.title) {
      errors.push('Title is required');
    }
  }

  // Validate title length
  if (body.title && body.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  // Validate seniority enum
  const validSeniorities = ['JUNIOR', 'MIDDLE', 'SENIOR', 'EXPERT', 'LEAD'];
  if (body.seniority && !validSeniorities.includes(body.seniority)) {
    errors.push(`Seniority must be one of: ${validSeniorities.join(', ')}`);
  }

  // Validate priority enum
  const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];
  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  // Validate status enum
  const validStatuses = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FILLED', 'CLOSED', 'CANCELLED'];
  if (body.status && !validStatuses.includes(body.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate work_mode enum
  const validWorkModes = ['ONSITE', 'REMOTE', 'HYBRID'];
  if (body.work_mode && !validWorkModes.includes(body.work_mode)) {
    errors.push(`Work mode must be one of: ${validWorkModes.join(', ')}`);
  }

  // Validate numeric fields
  if (body.quantity !== undefined && (body.quantity < 1 || body.quantity > 100)) {
    errors.push('Quantity must be between 1 and 100');
  }

  if (body.allocation_percentage !== undefined &&
      (body.allocation_percentage < 0 || body.allocation_percentage > 100)) {
    errors.push('Allocation percentage must be between 0 and 100');
  }

  if (body.min_experience_years !== undefined && body.min_experience_years < 0) {
    errors.push('Minimum experience years cannot be negative');
  }

  // Validate arrays
  if (body.hard_skills && !Array.isArray(body.hard_skills)) {
    errors.push('Hard skills must be an array');
  }

  if (body.soft_skills && !Array.isArray(body.soft_skills)) {
    errors.push('Soft skills must be an array');
  }

  // Certifications can be either an array or an object with required/preferred fields
  if (body.certifications) {
    if (!Array.isArray(body.certifications) && typeof body.certifications !== 'object') {
      errors.push('Certifications must be an array or object');
    }
    // If it's an object, validate its structure
    if (typeof body.certifications === 'object' && !Array.isArray(body.certifications)) {
      if (body.certifications.required && !Array.isArray(body.certifications.required)) {
        errors.push('Certifications.required must be an array');
      }
      if (body.certifications.preferred && !Array.isArray(body.certifications.preferred)) {
        errors.push('Certifications.preferred must be an array');
      }
    }
  }

  if (body.required_certifications && !Array.isArray(body.required_certifications)) {
    errors.push('Required certifications must be an array');
  }

  if (body.preferred_certifications && !Array.isArray(body.preferred_certifications)) {
    errors.push('Preferred certifications must be an array');
  }

  if (body.required_languages && !Array.isArray(body.required_languages)) {
    errors.push('Required languages must be an array');
  }

  if (body.preferred_languages && !Array.isArray(body.preferred_languages)) {
    errors.push('Preferred languages must be an array');
  }

  // Validate role_id and sub_role_id are numbers if provided
  if (body.role_id && isNaN(parseInt(body.role_id))) {
    errors.push('role_id must be a valid number');
  }

  if (body.sub_role_id && isNaN(parseInt(body.sub_role_id))) {
    errors.push('sub_role_id must be a valid number');
  }

  // Skills array size limits
  const MAX_SKILLS = 50;
  if (body.hard_skills && body.hard_skills.length > MAX_SKILLS) {
    errors.push(`Hard skills cannot exceed ${MAX_SKILLS} items`);
  }

  if (body.soft_skills && body.soft_skills.length > MAX_SKILLS) {
    errors.push(`Soft skills cannot exceed ${MAX_SKILLS} items`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate project ID parameter
 * @param {string} projectId - Project ID from params
 * @returns {Object} Validation result
 */
function validateProjectId(projectId) {
  if (!projectId) {
    return { isValid: false, error: 'Project ID is required' };
  }

  const id = parseInt(projectId);
  if (isNaN(id) || id <= 0) {
    return { isValid: false, error: 'Invalid project ID' };
  }

  return { isValid: true, id };
}

/**
 * Validate role ID parameter
 * @param {string} roleId - Role ID from params
 * @returns {Object} Validation result
 */
function validateRoleId(roleId) {
  if (!roleId) {
    return { isValid: false, error: 'Role ID is required' };
  }

  // Role IDs are strings (UUIDs)
  if (typeof roleId !== 'string' || roleId.length === 0) {
    return { isValid: false, error: 'Invalid role ID format' };
  }

  return { isValid: true, id: roleId };
}

/**
 * Validate pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Validated pagination params
 */
function validatePagination(query) {
  const DEFAULT_PAGE = 1;
  const DEFAULT_LIMIT = 10;
  const MAX_LIMIT = 100;

  let page = parseInt(query.page) || DEFAULT_PAGE;
  let limit = parseInt(query.limit) || DEFAULT_LIMIT;

  // Ensure valid ranges
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

/**
 * Validate search parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Validated search params
 */
function validateSearchParams(query) {
  const params = {};

  // Search string
  if (query.search && typeof query.search === 'string') {
    params.search = query.search.trim();
  }

  // Status filter
  const validStatuses = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'FILLED', 'CLOSED', 'CANCELLED'];
  if (query.status && validStatuses.includes(query.status)) {
    params.status = query.status;
  }

  // Priority filter
  const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];
  if (query.priority && validPriorities.includes(query.priority)) {
    params.priority = query.priority;
  }

  // Seniority filter
  const validSeniorities = ['JUNIOR', 'MIDDLE', 'SENIOR', 'EXPERT', 'LEAD'];
  if (query.seniority && validSeniorities.includes(query.seniority)) {
    params.seniority = query.seniority;
  }

  // Work mode filter
  const validWorkModes = ['ONSITE', 'REMOTE', 'HYBRID'];
  if (query.work_mode && validWorkModes.includes(query.work_mode)) {
    params.work_mode = query.work_mode;
  }

  // Boolean filters
  if (query.is_urgent !== undefined) {
    params.is_urgent = query.is_urgent === 'true';
  }

  if (query.is_critical !== undefined) {
    params.is_critical = query.is_critical === 'true';
  }

  if (query.is_billable !== undefined) {
    params.is_billable = query.is_billable === 'true';
  }

  return params;
}

/**
 * Validate skills input
 * @param {Array} skills - Skills array
 * @param {string} type - 'hard' or 'soft'
 * @returns {Object} Validation result
 */
function validateSkills(skills, type = 'hard') {
  if (!Array.isArray(skills)) {
    return { isValid: false, error: `${type} skills must be an array` };
  }

  const MAX_SKILLS = 50;
  if (skills.length > MAX_SKILLS) {
    return { isValid: false, error: `Cannot exceed ${MAX_SKILLS} ${type} skills` };
  }

  // Check each skill is a valid string
  for (const skill of skills) {
    if (typeof skill !== 'string' && typeof skill !== 'object') {
      return { isValid: false, error: `Each ${type} skill must be a string or object` };
    }
  }

  return { isValid: true };
}

/**
 * Sanitize input data
 * @param {Object} data - Input data
 * @returns {Object} Sanitized data
 */
function sanitizeInput(data) {
  const sanitized = {};

  // Copy allowed fields
  const allowedFields = [
    'title', 'seniority', 'quantity', 'priority', 'status',
    'hard_skills', 'soft_skills', 'certifications',
    'required_certifications', 'preferred_certifications',
    'min_experience_years', 'preferred_experience_years',
    'required_languages', 'preferred_languages',
    'allocation_percentage', 'availability_required',
    'work_mode', 'location', 'is_billable', 'is_urgent', 'is_critical',
    'budget_range', 'constraints', 'opportunities', 'preferences',
    'competencies', 'role_id', 'sub_role_id', 'required_skills'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  }

  // Sanitize strings
  if (sanitized.title) {
    sanitized.title = sanitized.title.trim();
  }

  if (sanitized.location) {
    sanitized.location = sanitized.location.trim();
  }

  return sanitized;
}

module.exports = {
  validateRoleInput,
  validateProjectId,
  validateRoleId,
  validatePagination,
  validateSearchParams,
  validateSkills,
  sanitizeInput
};