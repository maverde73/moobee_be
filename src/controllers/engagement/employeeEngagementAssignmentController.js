/**
 * Employee Engagement Assignment Controller
 * @created 2025-09-26 18:30
 * @description Handles employee engagement assignment operations
 */

const prisma = require('../../config/database');

/**
 * Helper function to get employee.id from tenant_users.id
 * @param {string} tenantUserId - The tenant_users.id from JWT
 * @param {string} tenantId - The tenant_id
 * @returns {number|null} - The employee.id or null if not found
 */
const getEmployeeIdFromTenantUser = async (tenantUserId, tenantId) => {
  // First find the tenant_user to get their email
  const tenantUser = await prisma.tenant_users.findUnique({
    where: {
      id: tenantUserId
    }
  });

  if (!tenantUser) {
    return null;
  }

  // Then find the employee by email and tenant_id
  const employee = await prisma.employees.findFirst({
    where: {
      email: tenantUser.email,
      tenant_id: tenantId
    }
  });

  return employee ? employee.id : null;
};

/**
 * Get current employee's engagement assignments
 */
const getMyEngagementAssignments = async (req, res) => {
  try {
    // Extract user info from JWT token
    const userId = req.user.id; // This is tenant_users.id (String)
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { status, includeExpired } = req.query;

    console.log('Getting engagement assignments for tenant_user:', userId, 'tenant:', tenantId);

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      console.log('No employee found for tenant_user:', userId);
      return res.json({
        success: true,
        data: [],
        total: 0
      });
    }

    console.log('Found employee:', employeeId, 'for tenant_user:', userId);

    // Parse status filter - include COMPLETED by default to show all assignments
    const statusFilter = status
      ? status.split(',').map(s => s.trim())
      : ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

    // Build where clause
    const whereClause = {
      employee_id: employeeId, // Using Integer employee.id
      status: {
        in: statusFilter
      }
    };

    // Fetch assignments with campaign and template details
    const assignments = await prisma.engagement_campaign_assignments.findMany({
      where: whereClause,
      include: {
        campaign: {
          include: {
            template: {
              include: {
                questions: {
                  include: {
                    options: true
                  },
                  orderBy: {
                    order: 'asc'
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        assigned_at: 'desc'
      }
    });

    console.log(`Found ${assignments.length} engagement assignments for employee:`, employeeId);

    // Map to frontend-expected format
    const formattedAssignments = assignments.map(assignment => ({
      id: assignment.id,
      campaign_id: assignment.campaign_id,
      employee_id: assignment.employee_id,
      status: assignment.status,
      assigned_at: assignment.assigned_at,
      started_at: assignment.started_at,
      completed_at: assignment.completed_at,
      campaign: assignment.campaign ? {
        id: assignment.campaign.id,
        name: assignment.campaign.name,
        description: assignment.campaign.description,
        start_date: assignment.campaign.start_date,
        end_date: assignment.campaign.end_date,
        frequency: assignment.campaign.frequency,
        template_id: assignment.campaign.template_id,
        template: assignment.campaign.template ? {
          id: assignment.campaign.template.id,
          name: assignment.campaign.template.title,
          description: assignment.campaign.template.description,
          engagement_type: assignment.campaign.template.type,
          frequency: assignment.campaign.template.suggested_frequency,
          questions: assignment.campaign.template.questions.map(q => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            order_number: q.order,
            required: q.required,
            options: q.options.map(opt => ({
              id: opt.id,
              option_text: opt.option_text,
              value: opt.value
            }))
          }))
        } : null
      } : null
    }));

    res.json({
      success: true,
      data: formattedAssignments,
      total: formattedAssignments.length
    });

  } catch (error) {
    console.error('Error fetching engagement assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch engagement assignments',
      message: error.message
    });
  }
};

/**
 * Start an engagement (mark as IN_PROGRESS)
 */
const startEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;

    // Get employee.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Check if assignment exists and belongs to user
    const assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        id: id,
        employee_id: employeeId,
        status: 'ASSIGNED'
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found or already started'
      });
    }

    // Update status to IN_PROGRESS
    const updated = await prisma.engagement_campaign_assignments.update({
      where: { id: id },
      data: {
        status: 'IN_PROGRESS',
        started_at: new Date()
      }
    });

    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    console.error('Error starting engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start engagement',
      message: error.message
    });
  }
};

/**
 * Submit engagement responses
 */
const submitEngagementResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { responses } = req.body;
    const userId = req.user.id; // tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;

    // Get employee.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Check if assignment exists and belongs to user
    const assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        id: id,
        employee_id: employeeId,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS']
        }
      },
      include: {
        campaign: true
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found or already completed'
      });
    }

    // Start transaction to save responses and update assignment
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Save each response
      if (responses && Array.isArray(responses)) {
        for (const question of responses) {
          if (question.type === 'likert' && question.answer !== null) {
            // Save Likert scale response
            await prisma.engagement_responses.create({
              data: {
                campaign_id: assignment.campaign_id,
                user_id: userId, // tenant_users.id (String)
                question_id: question.id,
                response_value: question.answer,
                responded_at: new Date()
              }
            });
          } else if (question.type === 'chips' && question.answer && question.answer.length > 0) {
            // Save multiple choice response
            await prisma.engagement_responses.create({
              data: {
                campaign_id: assignment.campaign_id,
                user_id: userId,
                question_id: question.id,
                response_text: question.answer.join(', '),
                responded_at: new Date()
              }
            });
          }
        }
      }

      // 2. Mark assignment as completed
      const updated = await prisma.engagement_campaign_assignments.update({
        where: { id: id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          completion_rate: 100
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: result,
      message: 'Engagement responses submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting engagement responses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit engagement responses',
      message: error.message
    });
  }
};

module.exports = {
  getMyEngagementAssignments,
  startEngagement,
  submitEngagementResponse
};