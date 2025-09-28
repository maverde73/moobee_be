/**
 * Assessment Campaign Validators
 * Validation logic for assessment campaign operations
 */

// Validate tenant ID
const validateTenant = (tenantId) => {
  if (!tenantId) {
    return {
      valid: false,
      error: 'Tenant ID not found'
    };
  }
  return { valid: true };
};

// Validate campaign creation data
const validateCampaignData = (data) => {
  const { name, assessmentTemplateId, startDate, endDate } = data;

  if (!name || !assessmentTemplateId || !startDate || !endDate) {
    return {
      valid: false,
      error: 'Missing required fields'
    };
  }

  // Validate date logic
  if (new Date(startDate) > new Date(endDate)) {
    return {
      valid: false,
      error: 'Start date must be before end date'
    };
  }

  return { valid: true };
};

// Validate campaign update data
const validateUpdateData = (data) => {
  const { startDate, endDate } = data;

  if (startDate && endDate) {
    if (new Date(startDate) > new Date(endDate)) {
      return {
        valid: false,
        error: 'Start date must be before end date'
      };
    }
  }

  return { valid: true };
};

// Validate assignment data
const validateAssignments = (assignments) => {
  if (!Array.isArray(assignments)) {
    return {
      valid: false,
      error: 'Assignments must be an array'
    };
  }

  for (const assignment of assignments) {
    if (!assignment.tenantUserId) {
      return {
        valid: false,
        error: 'Each assignment must have a tenantUserId'
      };
    }
  }

  return { valid: true };
};

// Validate campaign status
const validateStatus = (status) => {
  const validStatuses = ['draft', 'active', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return {
      valid: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    };
  }

  return { valid: true };
};

// Validate frequency
const validateFrequency = (frequency) => {
  const validFrequencies = ['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];
  
  if (frequency && !validFrequencies.includes(frequency)) {
    return {
      valid: false,
      error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`
    };
  }

  return { valid: true };
};

module.exports = {
  validateTenant,
  validateCampaignData,
  validateUpdateData,
  validateAssignments,
  validateStatus,
  validateFrequency
};