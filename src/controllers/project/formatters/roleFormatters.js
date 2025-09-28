/**
 * Role Formatters
 * @module controllers/project/formatters/roleFormatters
 * @created 2025-09-27 19:34
 *
 * Formatting functions for role responses
 */

/**
 * Format a single role for API response
 * @param {Object} role - Raw role from database
 * @returns {Object} Formatted role
 */
function formatRoleResponse(role) {
  if (!role) return null;

  return {
    id: role.id,
    project_id: role.project_id,
    role_code: role.role_code,
    title: role.title,
    seniority: role.seniority,
    quantity: role.quantity,
    priority: role.priority,
    status: role.status,

    // IDs for roles mapping
    role_id: role.role_id,
    sub_role_id: role.sub_role_id,
    sub_role: role.sub_role ? formatSubRole(role.sub_role) : null,

    // Skills
    required_skills: role.required_skills || [],
    hard_skills: role.hard_skills || [],
    soft_skills: role.soft_skills || [],
    competencies: role.competencies || [],

    // Certifications
    certifications: role.certifications || [],
    required_certifications: role.required_certifications || [],
    preferred_certifications: role.preferred_certifications || [],

    // Experience
    min_experience_years: role.min_experience_years,
    preferred_experience_years: role.preferred_experience_years,

    // Languages
    required_languages: role.required_languages || [],
    preferred_languages: role.preferred_languages || [],

    // Work details
    allocation_percentage: role.allocation_percentage,
    availability_required: role.availability_required,
    work_mode: role.work_mode,
    location: role.location,

    // Flags
    is_billable: role.is_billable,
    is_urgent: role.is_urgent,
    is_critical: role.is_critical,

    // Additional data
    budget_range: role.budget_range,
    constraints: role.constraints,
    opportunities: role.opportunities,
    preferences: role.preferences,

    // Relations
    project: role.projects ? formatProject(role.projects) : null,
    matching_results: role.project_matching_results ?
      role.project_matching_results.map(formatMatchingResult) : [],

    // Timestamps
    created_at: role.created_at,
    updated_at: role.updated_at
  };
}

/**
 * Format sub-role data
 * @param {Object} subRole - Sub-role from database
 * @returns {Object} Formatted sub-role
 */
function formatSubRole(subRole) {
  if (!subRole) return null;

  return {
    id: subRole.id,
    name: subRole.Sub_Role || subRole.NameKnown_Sub_Role,
    Sub_Role: subRole.Sub_Role,
    NameKnown_Sub_Role: subRole.NameKnown_Sub_Role,
    synonyms: subRole.Synonyms_Sub_Role
  };
}

/**
 * Format project data
 * @param {Object} project - Project from database
 * @returns {Object} Formatted project
 */
function formatProject(project) {
  if (!project) return null;

  return {
    id: project.id,
    name: project.project_name,
    code: project.project_code,
    status: project.status
  };
}

/**
 * Format assignment data
 * @param {Object} assignment - Assignment from database
 * @returns {Object} Formatted assignment
 */
function formatAssignment(assignment) {
  return {
    id: assignment.id,
    employee_id: assignment.employee_id,
    employee_name: assignment.employees?.name,
    status: assignment.status,
    assigned_at: assignment.assigned_at
  };
}

/**
 * Format matching result
 * @param {Object} result - Matching result from database
 * @returns {Object} Formatted result
 */
function formatMatchingResult(result) {
  return {
    employee_id: result.employee_id,
    match_score: result.match_score,
    skill_match: result.skill_match,
    experience_match: result.experience_match,
    availability_match: result.availability_match
  };
}

/**
 * Format role list response
 * @param {Array} roles - Array of roles
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Formatted list response
 */
function formatRoleListResponse(roles, total, page, limit) {
  return {
    success: true,
    data: roles.map(formatRoleResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
}

/**
 * Format error response
 * @param {string|Array} errors - Error message(s)
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(errors, statusCode = 400) {
  const errorArray = Array.isArray(errors) ? errors : [errors];

  return {
    success: false,
    error: errorArray[0], // Main error message
    errors: errorArray, // All error messages
    statusCode
  };
}

/**
 * Format success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Formatted success response
 */
function formatSuccessResponse(data, message = 'Operation successful') {
  return {
    success: true,
    message,
    data
  };
}

/**
 * Format statistics response
 * @param {Object} stats - Statistics data
 * @returns {Object} Formatted statistics
 */
function formatStatisticsResponse(stats) {
  return {
    success: true,
    data: {
      total_roles: stats.total,
      status_breakdown: stats.byStatus,
      urgent_roles: stats.urgent,
      critical_roles: stats.critical,
      summary: {
        open: stats.byStatus.OPEN || 0,
        in_progress: stats.byStatus.IN_PROGRESS || 0,
        filled: stats.byStatus.FILLED || 0,
        closed: stats.byStatus.CLOSED || 0
      }
    }
  };
}

/**
 * Format skills for response
 * @param {Array} skills - Array of skills
 * @returns {Array} Formatted skills
 */
function formatSkills(skills) {
  if (!Array.isArray(skills)) return [];

  return skills.map(skill => {
    if (typeof skill === 'string') {
      return skill;
    }
    if (typeof skill === 'object') {
      return skill.name || skill.Name || skill.Skill || '';
    }
    return '';
  }).filter(Boolean);
}

/**
 * Format role for dropdown/select
 * @param {Object} role - Role from database
 * @returns {Object} Simplified role format
 */
function formatRoleForSelect(role) {
  return {
    value: role.id,
    label: role.title,
    status: role.status,
    seniority: role.seniority
  };
}

/**
 * Format role for calendar view
 * @param {Object} role - Role from database
 * @returns {Object} Calendar-friendly format
 */
function formatRoleForCalendar(role) {
  return {
    id: role.id,
    title: role.title,
    start: role.availability_required || role.created_at,
    end: role.deadline || null,
    color: getRoleColor(role),
    extendedProps: {
      status: role.status,
      priority: role.priority,
      seniority: role.seniority,
      is_urgent: role.is_urgent,
      is_critical: role.is_critical
    }
  };
}

/**
 * Get color for role based on status/priority
 * @param {Object} role - Role object
 * @returns {string} Color hex code
 */
function getRoleColor(role) {
  if (role.is_critical) return '#dc2626'; // red
  if (role.is_urgent) return '#ea580c'; // orange
  if (role.status === 'FILLED') return '#16a34a'; // green
  if (role.status === 'IN_PROGRESS') return '#2563eb'; // blue
  if (role.status === 'CLOSED') return '#6b7280'; // gray
  return '#8b5cf6'; // purple (default)
}

module.exports = {
  formatRoleResponse,
  formatSubRole,
  formatProject,
  formatAssignment,
  formatMatchingResult,
  formatRoleListResponse,
  formatErrorResponse,
  formatSuccessResponse,
  formatStatisticsResponse,
  formatSkills,
  formatRoleForSelect,
  formatRoleForCalendar,
  getRoleColor
};