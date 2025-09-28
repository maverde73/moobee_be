/**
 * Role Helper Functions
 * @module controllers/project/helpers/roleHelpers
 * @created 2025-09-27 19:25
 *
 * Funzioni di supporto per il roleController
 */

const prisma = require('../../../config/database');

/**
 * Build role data for create/update operations
 * @param {Object} body - Request body
 * @param {number} projectId - Project ID
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Formatted role data
 */
function buildRoleData(body, projectId = null, isUpdate = false) {
  const roleData = {};

  if (!isUpdate) {
    roleData.project_id = parseInt(projectId);
    roleData.role_code = body.role_code || `ROLE_${Date.now()}`;
  }

  // Basic fields
  if (body.title !== undefined) roleData.title = body.title;
  if (body.seniority !== undefined) roleData.seniority = body.seniority || 'MIDDLE';
  if (body.quantity !== undefined) roleData.quantity = body.quantity || 1;
  if (body.priority !== undefined) roleData.priority = body.priority || 'NORMAL';
  if (body.status !== undefined) roleData.status = body.status || 'OPEN';

  // Skills - handle both nested and direct formats
  if (body.required_skills !== undefined || body.hard_skills !== undefined || body.soft_skills !== undefined) {
    roleData.required_skills = body.required_skills || [];
    roleData.hard_skills = body.required_skills?.hard_skills || body.hard_skills || [];
    roleData.soft_skills = body.required_skills?.soft_skills || body.soft_skills || [];
  }

  // Certifications - ensure they're simple arrays of strings
  if (body.certifications !== undefined) {
    roleData.certifications = Array.isArray(body.certifications) ? body.certifications : [];
  }
  if (body.required_certifications !== undefined) {
    roleData.required_certifications = Array.isArray(body.required_certifications) ? body.required_certifications : [];
  }
  if (body.preferred_certifications !== undefined) {
    roleData.preferred_certifications = Array.isArray(body.preferred_certifications) ? body.preferred_certifications : [];
  }

  // Experience
  if (body.min_experience_years !== undefined) {
    roleData.min_experience_years = body.min_experience_years || 0;
  }
  if (body.preferred_experience_years !== undefined) {
    roleData.preferred_experience_years = body.preferred_experience_years;
  }

  // Languages
  if (body.required_languages !== undefined) {
    roleData.required_languages = body.required_languages || [];
  }
  if (body.preferred_languages !== undefined) {
    roleData.preferred_languages = body.preferred_languages || [];
  }

  // Work details
  if (body.allocation_percentage !== undefined) {
    roleData.allocation_percentage = body.allocation_percentage || 100;
  }
  if (body.availability_required !== undefined) {
    roleData.availability_required = body.availability_required;
  }
  if (body.work_mode !== undefined) {
    roleData.work_mode = body.work_mode;
  }
  if (body.location !== undefined) {
    roleData.location = body.location;
  }

  // Flags
  if (body.is_billable !== undefined) {
    roleData.is_billable = body.is_billable !== false;
  }
  if (body.is_urgent !== undefined) {
    roleData.is_urgent = body.is_urgent || false;
  }
  if (body.is_critical !== undefined) {
    roleData.is_critical = body.is_critical || false;
  }

  // Additional data
  if (body.budget_range !== undefined) {
    roleData.budget_range = body.budget_range;
  }
  if (body.constraints !== undefined) {
    roleData.constraints = body.constraints;
  }
  if (body.opportunities !== undefined) {
    roleData.opportunities = body.opportunities;
  }
  if (body.preferences !== undefined) {
    roleData.preferences = body.preferences;
  }
  if (body.competencies !== undefined) {
    roleData.competencies = body.competencies;
  }

  // role_id and sub_role_id are now integer fields
  if (body.role_id !== undefined) {
    roleData.role_id = body.role_id ? parseInt(body.role_id) : null;
  }
  if (body.sub_role_id !== undefined) {
    roleData.sub_role_id = body.sub_role_id ? parseInt(body.sub_role_id) : null;
  }

  return roleData;
}

/**
 * Enrich role with sub_role data
 * @param {Object} role - Role object
 * @returns {Promise<Object>} Enriched role
 */
async function enrichRoleWithSubRole(role) {
  if (!role.sub_role_id) return role;

  try {
    // Get sub_role details
    const subRole = await prisma.sub_roles.findUnique({
      where: { id: role.sub_role_id }
    });

    // Get associated skills
    const skills = await prisma.skills_sub_roles_value.findMany({
      where: { id_sub_role: role.sub_role_id },
      include: {
        skills: true
      },
      orderBy: { Value: 'desc' },
      take: 10
    });

    return {
      ...role,
      sub_role: subRole,
      suggested_skills: skills.map(s => ({
        id: s.id_skill,
        name: s.skills.Skill,
        value: s.Value,
        grading: s.Grading
      }))
    };
  } catch (error) {
    console.error('Error fetching sub_role data:', error);
    return role;
  }
}

/**
 * Log activity to project_activity_logs
 * @param {Object} params - Activity parameters
 */
async function logActivity(params) {
  const { project_id, activity_type, description, user_id, metadata } = params;

  try {
    await prisma.project_activity_logs.create({
      data: {
        project_id,
        activity_type,
        description,
        user_id: String(user_id),
        metadata
      }
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Trigger matching for a role (async)
 * @param {string} roleId - Role ID
 */
async function triggerMatching(roleId) {
  try {
    console.log(`Matching triggered for role ${roleId}`);
    // In production, this would:
    // 1. Queue a job for matching
    // 2. Calculate scores for all employees
    // 3. Save results to project_matching_results
  } catch (error) {
    console.error('Error triggering matching:', error);
  }
}

/**
 * Debug log for role IDs
 * @param {Object} body - Request body
 */
function debugRoleIds(body) {
  console.log('=== DEBUG ROLE IDs ===');
  console.log('Received role_id:', body.role_id);
  console.log('role_id type:', typeof body.role_id);
  console.log('Received sub_role_id:', body.sub_role_id);
  console.log('sub_role_id type:', typeof body.sub_role_id);
  console.log('Full request body:', JSON.stringify(body, null, 2));
}

/**
 * Debug log after role creation
 * @param {Object} role - Created role
 */
function debugCreatedRole(role) {
  console.log('=== ROLE CREATED ===');
  console.log('Created role_id:', role.role_id);
  console.log('Created sub_role_id:', role.sub_role_id);
  console.log('Created sub_role details:', role.sub_role);
}

module.exports = {
  buildRoleData,
  enrichRoleWithSubRole,
  logActivity,
  triggerMatching,
  debugRoleIds,
  debugCreatedRole
};