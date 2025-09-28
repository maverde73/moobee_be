/**
 * Validation Service - Input validation for assessment operations
 * Giurelli Standards compliant - Max 50 lines per function
 */
class ValidationService {
  /**
   * Validate template creation data
   */
  validateTemplateCreate(data) {
    const errors = [];

    if (!data.name || data.name.trim() === '') {
      errors.push('Template name is required');
    }

    // Type is optional - will default to 'big_five' if not provided
    if (data.type && !['big_five', 'disc', 'belbin'].includes(data.type.toLowerCase())) {
      errors.push('Invalid template type. Must be: big_five, disc, or belbin');
    }

    if (!data.description || data.description.trim() === '') {
      errors.push('Template description is required');
    }

    if (data.suggestedRoles && !Array.isArray(data.suggestedRoles)) {
      errors.push('Suggested roles must be an array');
    }

    if (data.questions && Array.isArray(data.questions)) {
      data.questions.forEach((q, index) => {
        if (!q.text || q.text.trim() === '') {
          errors.push(`Question ${index + 1}: text is required`);
        }
        if (q.type && !['likert', 'multiple_choice', 'text', 'rating'].includes(q.type)) {
          errors.push(`Question ${index + 1}: invalid type`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate template update data
   */
  validateTemplateUpdate(data) {
    const errors = [];

    if (data.name !== undefined && data.name.trim() === '') {
      errors.push('Template name cannot be empty');
    }

    if (data.type !== undefined && !['big_five', 'disc', 'belbin'].includes(data.type.toLowerCase())) {
      errors.push('Invalid template type. Must be: big_five, disc, or belbin');
    }

    if (data.description !== undefined && data.description.trim() === '') {
      errors.push('Template description cannot be empty');
    }

    if (data.suggestedRoles !== undefined && !Array.isArray(data.suggestedRoles)) {
      errors.push('Suggested roles must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate question data
   */
  validateQuestion(data) {
    const errors = [];

    if (!data.text || data.text.trim() === '') {
      errors.push('Question text is required');
    }

    if (data.type && !['likert', 'multiple_choice', 'text', 'rating'].includes(data.type)) {
      errors.push('Invalid question type');
    }

    if (data.options && Array.isArray(data.options)) {
      if (data.options.length === 0) {
        errors.push('At least one option is required');
      }

      data.options.forEach((opt, index) => {
        if (!opt.text || opt.text.trim() === '') {
          errors.push(`Option ${index + 1}: text is required`);
        }
        if (opt.value === undefined || opt.value === null) {
          errors.push(`Option ${index + 1}: value is required`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate reorder request
   */
  validateReorder(data) {
    const errors = [];

    if (!data.templateId) {
      errors.push('Template ID is required');
    }

    if (!data.questionOrders || !Array.isArray(data.questionOrders)) {
      errors.push('Question orders must be an array');
    } else {
      data.questionOrders.forEach((item, index) => {
        if (!item.questionId) {
          errors.push(`Order item ${index + 1}: questionId is required`);
        }
        if (item.orderIndex === undefined || item.orderIndex === null) {
          errors.push(`Order item ${index + 1}: orderIndex is required`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate tenant selection
   */
  validateTenantSelection(data) {
    const errors = [];

    if (!data.templateId) {
      errors.push('Template ID is required');
    }

    if (!data.tenantId) {
      errors.push('Tenant ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize input string
   */
  sanitizeString(str) {
    if (!str) return '';
    return str.toString().trim();
  }

  /**
   * Sanitize array input
   */
  sanitizeArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => item !== null && item !== undefined);
  }
}

module.exports = new ValidationService();