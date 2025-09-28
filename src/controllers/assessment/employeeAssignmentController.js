/**
 * Employee Assignment Controller
 * @created 2025-09-25
 * @description Handles employee assessment assignment operations
 */

const prisma = require('../../config/database');
const { validationResult } = require('express-validator');

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
 * Get current employee's active assignments
 */
const getMyActiveAssignments = async (req, res) => {
  try {
    // Extract user info from JWT token
    const userId = req.user.id; // This is tenant_users.id (String)
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { status } = req.query;

    console.log('Getting assignments for tenant_user:', userId, 'tenant:', tenantId);

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

    // Filter assignments by employee_id (now using Integer employee.id)
    const assignments = await prisma.assessment_campaign_assignments.findMany({
      where: {
        employee_id: employeeId, // Now using Integer employee.id
        status: {
          in: statusFilter
        }
        // tenant filter removed - not in this table
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                assessment_questions: {
                  include: {
                    assessment_options: true
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

    // Format response
    const formattedAssignments = assignments.map(assignment => ({
      id: assignment.id,
      campaign_id: assignment.campaign_id,
      employee_id: assignment.employee_id,
      status: assignment.status,
      assigned_at: assignment.assigned_at,
      started_at: assignment.started_at,
      completed_at: assignment.completed_at,
      score: assignment.score,
      responses: assignment.responses,
      campaign: assignment.campaign ? {
        id: assignment.campaign.id,
        name: assignment.campaign.name,
        description: assignment.campaign.description,
        start_date: assignment.campaign.start_date,
        deadline: assignment.campaign.deadline,
        template: assignment.campaign.template ? {
          id: assignment.campaign.template.id,
          name: assignment.campaign.template.name || assignment.campaign.template.title,
          description: assignment.campaign.template.description,
          questions: assignment.campaign.template.assessment_questions ? assignment.campaign.template.assessment_questions.map(q => ({
            id: q.id,
            question: q.text,  // field is 'text' in database
            type: q.type,
            section: q.category,  // field is 'category' in database
            required: q.isRequired,  // field is 'isRequired' in database
            order: q.order,
            options: q.assessment_options ? q.assessment_options.map(opt => ({
              id: opt.id,
              text: opt.text,
              value: opt.value,
              order: opt.orderIndex  // field is 'orderIndex' in database
            })) : []
          })) : []
        } : null
      } : null
    }));

    res.json({
      success: true,
      data: formattedAssignments
    });
  } catch (error) {
    console.error('Error fetching employee assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignments'
    });
  }
};

/**
 * Get specific assignment details
 */
const getAssignmentDetails = async (req, res) => {
  try {
    const userId = req.user.id; // This is tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { assignmentId } = req.params;

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee record not found'
      });
    }

    const assignment = await prisma.assessment_campaign_assignments.findFirst({
      where: {
        id: assignmentId,
        employee_id: employeeId
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                assessment_questions: {
                  include: {
                    assessment_options: true
                  },
                  orderBy: {
                    order: 'asc'
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Format response
    const formattedAssignment = {
      id: assignment.id,
      campaign_id: assignment.campaign_id,
      employee_id: assignment.employee_id,
      status: assignment.status,
      assigned_at: assignment.assigned_at,
      started_at: assignment.started_at,
      completed_at: assignment.completed_at,
      score: assignment.score,
      responses: assignment.responses,
      campaign: assignment.campaign ? {
        id: assignment.campaign.id,
        name: assignment.campaign.name,
        description: assignment.campaign.description,
        start_date: assignment.campaign.start_date,
        deadline: assignment.campaign.deadline,
        template: assignment.campaign.template ? {
          id: assignment.campaign.template.id,
          name: assignment.campaign.template.name || assignment.campaign.template.title,
          description: assignment.campaign.template.description,
          questions: assignment.campaign.template.assessment_questions ? assignment.campaign.template.assessment_questions.map(q => ({
            id: q.id,
            question: q.text,  // field is 'text' in database
            type: q.type,
            section: q.category,  // field is 'category' in database
            required: q.isRequired,  // field is 'isRequired' in database
            order: q.order,
            options: q.assessment_options ? q.assessment_options.map(opt => ({
              id: opt.id,
              text: opt.text,
              value: opt.value,
              order: opt.orderIndex  // field is 'orderIndex' in database
            })) : []
          })) : []
        } : null
      } : null
    };

    res.json({
      success: true,
      data: formattedAssignment
    });
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignment details'
    });
  }
};

/**
 * Start an assessment
 */
const startAssessment = async (req, res) => {
  try {
    const userId = req.user.id; // This is tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { assignmentId } = req.params;

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee record not found'
      });
    }

    // Check if assignment exists and belongs to user
    const assignment = await prisma.assessment_campaign_assignments.findFirst({
      where: {
        id: assignmentId,
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
    const updatedAssignment = await prisma.assessment_campaign_assignments.update({
      where: { id: assignmentId },
      data: {
        status: 'IN_PROGRESS',
        started_at: new Date()
      }
    });

    res.json({
      success: true,
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Error starting assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start assessment'
    });
  }
};

/**
 * Submit assessment responses
 */
const submitAssessmentResponses = async (req, res) => {
  try {
    const userId = req.user.id; // This is tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { assignmentId } = req.params;
    const { responses, score } = req.body;

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee record not found'
      });
    }

    // Validate input
    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid responses format'
      });
    }

    // Check if assignment exists and is in progress
    const assignment = await prisma.assessment_campaign_assignments.findFirst({
      where: {
        id: assignmentId,
        employee_id: employeeId,
        status: 'IN_PROGRESS'
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                assessment_questions: true
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found or not in progress'
      });
    }

    // Calculate time spent (if started_at is available)
    const timeSpent = assignment.started_at
      ? Math.floor((new Date() - new Date(assignment.started_at)) / 60000) // minutes
      : 0;

    // Create a map of questions for quick lookup
    const questionsMap = {};
    if (assignment.campaign?.template?.assessment_questions) {
      assignment.campaign.template.assessment_questions.forEach(q => {
        questionsMap[q.id] = {
          text: q.text,
          category: q.category || 'General',
          type: q.type
        };
      });
    }

    // Calculate scores by category
    const categoryScores = {};
    let totalScore = 0;
    let questionCount = 0;
    const strengths = [];
    const improvements = [];

    // Analyze responses
    responses.forEach((response) => {
      const value = response.value || 0;
      const questionId = response.questionId;

      // Get question details from the map
      const questionDetails = questionsMap[questionId] || {};
      const category = response.category || questionDetails.category || 'General';
      const questionText = response.question || response.text || questionDetails.text || '';

      // Initialize category if not exists
      if (!categoryScores[category]) {
        categoryScores[category] = {
          total: 0,
          count: 0,
          average: 0
        };
      }

      // Add to category score
      categoryScores[category].total += value;
      categoryScores[category].count++;

      // Track overall score
      if (value > 0) {
        totalScore += value;
        questionCount++;
      }

      // Identify strengths (4-5 values)
      if (value >= 4) {
        strengths.push({
          question: questionText.substring(0, 100),
          category: category,
          score: value
        });
      }

      // Identify improvements (1-2 values)
      if (value <= 2) {
        improvements.push({
          question: questionText.substring(0, 100),
          category: category,
          score: value
        });
      }
    });

    // Calculate average for each category
    Object.keys(categoryScores).forEach(category => {
      const cat = categoryScores[category];
      cat.average = cat.count > 0 ? parseFloat((cat.total / cat.count).toFixed(2)) : 0;
    });

    // Calculate overall score
    const calculatedOverallScore = questionCount > 0
      ? parseFloat((totalScore / questionCount).toFixed(2))
      : 0;

    // Calculate percentile (compare with other results from same assessment template)
    let percentile = null;
    try {
      // Get campaign info to find template
      const campaignInfo = await prisma.assessment_campaigns.findUnique({
        where: { id: assignment.campaign_id }
      });

      if (campaignInfo) {
        // Get all completed results for same template
        const allResults = await prisma.assessment_results.findMany({
          where: {
            campaign: {
              template_id: campaignInfo.template_id
            },
            overall_score: { not: null }
          },
          select: {
            overall_score: true
          }
        });

        if (allResults.length > 0) {
          const scores = allResults.map(r => r.overall_score).filter(s => s !== null);
          const belowCount = scores.filter(s => s < calculatedOverallScore).length;
          percentile = parseFloat(((belowCount / scores.length) * 100).toFixed(1));
        }
      }
    } catch (err) {
      console.error('Error calculating percentile:', err);
    }

    // Generate AI recommendations
    const recommendations = [];

    // Add basic recommendations based on scores
    if (strengths.length > 0) {
      recommendations.push({
        type: 'strength',
        message: `Continua a sviluppare i tuoi punti di forza in: ${strengths.slice(0, 3).map(s => s.category).join(', ')}`
      });
    }

    if (improvements.length > 0) {
      recommendations.push({
        type: 'improvement',
        message: `Focus sullo sviluppo nelle aree: ${improvements.slice(0, 3).map(i => i.category).join(', ')}`
      });
    }

    // Add performance-based recommendation
    if (calculatedOverallScore >= 4) {
      recommendations.push({
        type: 'excellence',
        message: 'Eccellente performance! Considera di mentorare i colleghi nelle tue aree di forza.'
      });
    } else if (calculatedOverallScore >= 3) {
      recommendations.push({
        type: 'good',
        message: 'Buona performance complessiva. Continua il percorso di crescita professionale.'
      });
    } else if (calculatedOverallScore >= 2) {
      recommendations.push({
        type: 'development',
        message: 'Ci sono opportunità di miglioramento. Considera formazione mirata nelle aree critiche.'
      });
    } else {
      recommendations.push({
        type: 'support',
        message: 'Ti consigliamo di richiedere supporto e coaching per migliorare le competenze valutate.'
      });
    }

    // Create assessment result record with all calculated fields
    const assessmentResult = await prisma.assessment_results.create({
      data: {
        campaign_id: assignment.campaign_id,
        employee_id: employeeId,
        assignment_id: assignmentId,
        responses: responses,
        scores: categoryScores,
        overall_score: calculatedOverallScore,
        percentile: percentile,
        strengths: strengths.length > 0 ? strengths : null,
        improvements: improvements.length > 0 ? improvements : null,
        recommendations: recommendations.length > 0 ? recommendations : null,
        completed_at: new Date(),
        time_taken: timeSpent,
        attempt_number: (assignment.current_attempt || 0) + 1
      }
    });

    // Update assignment status to completed
    const updatedAssignment = await prisma.assessment_campaign_assignments.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        score: calculatedOverallScore,
        result_id: assessmentResult.id,
        current_attempt: (assignment.current_attempt || 0) + 1,
        time_spent: timeSpent
      }
    });

    res.json({
      success: true,
      data: {
        assignment: updatedAssignment,
        result: assessmentResult
      }
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit assessment'
    });
  }
};

/**
 * Get assessment progress
 */
const getAssessmentProgress = async (req, res) => {
  try {
    const userId = req.user.id; // This is tenant_users.id
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const { assignmentId } = req.params;

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.status(404).json({
        success: false,
        error: 'Employee record not found'
      });
    }

    const assignment = await prisma.assessment_campaign_assignments.findFirst({
      where: {
        id: assignmentId,
        employee_id: employeeId
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                assessment_questions: true
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    const totalQuestions = assignment.campaign?.template?.assessment_questions?.length || 0;
    const responses = assignment.responses || [];
    const answeredQuestions = Array.isArray(responses) ? responses.length : 0;
    const percentage = totalQuestions > 0
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalQuestions,
        answeredQuestions,
        percentage
      }
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress'
    });
  }
};

/**
 * Get latest assessment result for the logged-in user
 */
const getMyLatestResult = async (req, res) => {
  try {
    const userId = req.user.id; // This is tenant_users.id (String)
    const tenantId = req.user.tenant_id || req.user.tenantId;

    // Get the employee.id from tenant_users.id
    const employeeId = await getEmployeeIdFromTenantUser(userId, tenantId);

    if (!employeeId) {
      return res.json({
        success: true,
        data: null,
        message: 'No employee record found'
      });
    }

    // Get the latest assessment result for this employee (using Integer ID)
    const latestResult = await prisma.assessment_results.findFirst({
      where: {
        employee_id: employeeId // Now using Integer employee.id
      },
      orderBy: {
        completed_at: 'desc'
      },
      include: {
        campaign: {
          include: {
            template: true
          }
        }
      }
    });

    if (!latestResult) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Transform the result for the dashboard
    const transformedResult = {
      id: latestResult.id,
      completedDate: latestResult.completed_at,
      totalScore: latestResult.overall_score ? Math.round(latestResult.overall_score * 20) : 0, // Convert 0-5 to 0-100
      level: getSkillLevel(latestResult.overall_score),
      percentile: latestResult.percentile,
      sectionScores: latestResult.scores || {},
      strengths: latestResult.strengths ? latestResult.strengths.map(s => {
        // If it's an object with question field, use that. Otherwise fallback to category or the whole value
        if (typeof s === 'object' && s.question) {
          return `${s.question} (${s.category})`;
        }
        return s.category || s.question || s;
      }) : [],
      areasForImprovement: latestResult.improvements ? latestResult.improvements.map(i => {
        // If it's an object with question field, use that. Otherwise fallback to category or the whole value
        if (typeof i === 'object' && i.question) {
          return `${i.question} (${i.category})`;
        }
        return i.category || i.question || i;
      }) : [],
      recommendations: latestResult.recommendations || [],
      timeSpent: latestResult.time_taken,
      assessmentName: latestResult.campaign?.template?.name || 'Assessment',
      responses: latestResult.responses
    };

    res.json({
      success: true,
      data: transformedResult
    });
  } catch (error) {
    console.error('Error fetching latest result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest assessment result'
    });
  }
};

// Helper function to determine skill level based on score
function getSkillLevel(score) {
  if (!score) return 'Da sviluppare';
  if (score >= 4.5) return 'Eccezionale';
  if (score >= 3.5) return 'Forte';
  if (score >= 2.5) return 'Adeguato';
  if (score >= 1.5) return 'Da sviluppare';
  return 'Critico';
}

module.exports = {
  getMyActiveAssignments,
  getAssignmentDetails,
  startAssessment,
  submitAssessmentResponses,
  getAssessmentProgress,
  getMyLatestResult
};