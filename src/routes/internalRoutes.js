/**
 * Internal API Routes
 *
 * Routes used by Python backend and other internal services.
 * Protected by HMAC-SHA256 signature with timestamp validation.
 *
 * Security: These endpoints require:
 * - X-Internal-Timestamp: Unix timestamp in milliseconds
 * - X-Internal-Signature: HMAC-SHA256 signature
 * - X-Internal-Service: Service identifier (for logging)
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validateInternalRequest } = require('../middleware/internalAuth');

// Apply HMAC validation middleware to all internal routes
router.use(validateInternalRequest);

/**
 * POST /api/internal/llm-usage-log
 *
 * Log LLM usage from Python backend
 * Called after every LLM API call (OpenAI, Anthropic, etc.)
 *
 * Body:
 * {
 *   tenant_id: number (required)
 *   operation_type: string (required) - e.g. "cv_extraction_personal_info"
 *   provider: string (required) - "openai" or "anthropic"
 *   model: string (required) - e.g. "gpt-4", "gpt-4o-mini"
 *   prompt_tokens: number
 *   completion_tokens: number
 *   total_tokens: number
 *   estimated_cost: number (in USD)
 *   status: string - "success", "failed", "timeout", "rate_limited"
 *   response_time_ms: number
 *   entity_type: string (optional) - "employee", "assessment", etc.
 *   entity_id: string (optional)
 *   error_message: string (optional)
 * }
 */
router.post('/llm-usage-log', async (req, res) => {
  try {
    const {
      tenant_id,
      operation_type,
      provider,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      estimated_cost,
      status,
      response_time_ms,
      entity_type,
      entity_id,
      error_message
    } = req.body;

    // Validate required fields
    if (!tenant_id || !operation_type || !provider || !model) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenant_id', 'operation_type', 'provider', 'model']
      });
    }

    // Validate tenant exists (optional check)
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      console.warn(`[Internal API] Warning: tenant_id ${tenant_id} not found`);
      // Continue anyway - don't block logging for invalid tenant
    }

    // Insert into llm_usage_logs
    const log = await prisma.llm_usage_logs.create({
      data: {
        tenant_id,
        operation_type,
        provider,
        model,
        prompt_tokens: prompt_tokens || 0,
        completion_tokens: completion_tokens || 0,
        total_tokens: total_tokens || 0,
        estimated_cost: estimated_cost ? parseFloat(estimated_cost) : 0,
        status: status || 'success',
        response_time_ms: response_time_ms || null,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        error_message: error_message || null
      }
    });

    console.log(`[LLM Audit] Logged ${operation_type} for tenant ${tenant_id}: ${total_tokens} tokens, $${estimated_cost?.toFixed(6)}`);

    res.status(201).json({
      success: true,
      log_id: log.id
    });

  } catch (error) {
    console.error('[Internal API] LLM usage log error:', error);
    res.status(500).json({
      error: 'Failed to log LLM usage',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/employees
 *
 * Search employees for internal services (moobee-ai-bridge, Python backend)
 * Protected by HMAC-SHA256 signature validation.
 *
 * Query params:
 * - tenant_id: string (required) - Moobee tenant UUID
 * - search: string (optional) - Search term (min 2 chars)
 * - limit: number (optional, default 20) - Max results
 */
router.get('/employees', async (req, res) => {
  console.log('[Internal API] ========== EMPLOYEE SEARCH REQUEST ==========');
  console.log('[Internal API] Query params:', JSON.stringify(req.query));
  console.log('[Internal API] Headers:', JSON.stringify({
    'x-internal-service': req.headers['x-internal-service'],
    'x-tenant-id': req.headers['x-tenant-id']
  }));

  try {
    const { tenant_id, search, limit: limitParam } = req.query;
    const limit = parseInt(limitParam) || 20;

    console.log(`[Internal API] Searching: tenant=${tenant_id}, search="${search}", limit=${limit}`);

    // Validate required fields
    if (!tenant_id) {
      console.log('[Internal API] ERROR: Missing tenant_id');
      return res.status(400).json({
        error: 'Missing required field: tenant_id'
      });
    }

    // Find tenant by UUID (id field contains the UUID)
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      console.warn(`[Internal API] Warning: tenant_id ${tenant_id} not found`);
      return res.status(404).json({
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Build where clause
    const whereClause = {
      tenant_id: tenant.id
    };

    // Search by skill first to get employee IDs
    let employeeIdsWithSkill = [];
    if (search && search.length >= 2) {
      // Find skills matching the search term
      const matchingSkills = await prisma.skills.findMany({
        where: {
          OR: [
            { Skill: { contains: search, mode: 'insensitive' } },
            { NameKnown_Skill: { contains: search, mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      });

      if (matchingSkills.length > 0) {
        const skillIds = matchingSkills.map(s => s.id);
        // Find employees with these skills
        const employeesWithSkills = await prisma.employee_skills.findMany({
          where: {
            skill_id: { in: skillIds },
            tenant_id: tenant.id
          },
          select: { employee_id: true }
        });
        employeeIdsWithSkill = [...new Set(employeesWithSkills.map(es => es.employee_id))];
      }
    }

    // Add search filter if search term is provided (minimum 2 characters)
    if (search && search.length >= 2) {
      whereClause.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
      // Also include employees with matching skills
      if (employeeIdsWithSkill.length > 0) {
        whereClause.OR.push({ id: { in: employeeIdsWithSkill } });
      }
    }

    // Get employees with relations
    const employees = await prisma.employees.findMany({
      where: whereClause,
      take: limit,
      include: {
        departments: true,
        employee_roles: true,
        employee_skills: true
      },
      orderBy: { first_name: 'asc' }
    });

    // Get all unique role_ids to fetch role names
    const roleIds = [...new Set(employees.flatMap(e =>
      e.employee_roles?.map(er => er.role_id).filter(Boolean) || []
    ))];

    // Get all unique skill_ids to fetch skill names
    const skillIds = [...new Set(employees.flatMap(e =>
      e.employee_skills?.map(es => es.skill_id).filter(Boolean) || []
    ))];

    // Fetch role names if we have role_ids
    const rolesMap = {};
    if (roleIds.length > 0) {
      const roles = await prisma.roles.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true, Role: true }
      });
      roles.forEach(r => {
        rolesMap[r.id] = r.name || r.Role;
      });
    }

    // Fetch skill names if we have skill_ids
    const skillsMap = {};
    if (skillIds.length > 0) {
      const skills = await prisma.skills.findMany({
        where: { id: { in: skillIds } },
        select: { id: true, Skill: true, NameKnown_Skill: true }
      });
      skills.forEach(s => {
        skillsMap[s.id] = { name: s.Skill || s.NameKnown_Skill, category: null };
      });
    }

    console.log(`[Internal API] Found ${employees.length} employees for tenant ${tenant_id} (search: ${search || 'none'})`);
    console.log('[Internal API] Employee IDs found:', employees.map(e => e.id));

    // Format response for moobee-ai-bridge
    const formattedEmployees = employees.map(emp => {
      const currentRole = emp.employee_roles?.find(er => er.is_current) || emp.employee_roles?.[0];
      return {
        id: emp.id,
        email: emp.email,
        first_name: emp.first_name,
        last_name: emp.last_name,
        department: emp.departments ? {
          id: emp.departments.id,
          name: emp.departments.department_name
        } : null,
        role: currentRole ? {
          id: currentRole.role_id,
          name: rolesMap[currentRole.role_id] || null,
          seniority: currentRole.seniority
        } : null,
        skills: emp.employee_skills?.map(es => ({
          id: es.skill_id,
          name: skillsMap[es.skill_id]?.name,
          proficiency_level: es.proficiency_level,
          category: skillsMap[es.skill_id]?.category
        })).filter(s => s.name) || []
      };
    });

    const response = {
      success: true,
      data: formattedEmployees,
      meta: {
        total: formattedEmployees.length,
        search: search || null,
        tenant_id
      }
    };

    console.log(`[Internal API] Response: ${formattedEmployees.length} employees`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json(response);

  } catch (error) {
    console.error('[Internal API] Employee search error:', error.message);
    res.status(500).json({
      error: 'Failed to search employees',
      details: error.message
    });
  }
});

/**
 * POST /api/internal/employees/search-by-skills
 *
 * Search employees by skills with ranking (score 0-100)
 * Score formula: 70% skill match + 20% value fit + 10% availability
 *
 * Body:
 * {
 *   tenant_id: string (required)
 *   skills: [{ name: string, proficiency_level?: number, years_experience?: number }]
 *   available_from?: string (date)
 *   limit?: number (default 20)
 * }
 */
router.post('/employees/search-by-skills', async (req, res) => {
  console.log('[Internal API] ========== SEARCH BY SKILLS REQUEST ==========');
  console.log('[Internal API] Body:', JSON.stringify(req.body));

  try {
    const { tenant_id, skills, available_from, limit = 20 } = req.body;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid skills array'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Normalize skill names (case-insensitive, trim)
    const normalizedSkillNames = skills.map(s => s.name.trim().toLowerCase());

    // Find matching skills in the database
    const matchingSkills = await prisma.skills.findMany({
      where: {
        OR: [
          { Skill: { in: normalizedSkillNames, mode: 'insensitive' } },
          { NameKnown_Skill: { in: normalizedSkillNames, mode: 'insensitive' } }
        ]
      },
      select: { id: true, Skill: true, NameKnown_Skill: true }
    });

    const skillIdToName = {};
    matchingSkills.forEach(s => {
      skillIdToName[s.id] = (s.Skill || s.NameKnown_Skill || '').toLowerCase();
    });
    const matchingSkillIds = matchingSkills.map(s => s.id);

    if (matchingSkillIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        meta: { total: 0, skills_requested: skills.length, skills_matched: 0 }
      });
    }

    // Find employees with at least one matching skill
    const employeesWithSkills = await prisma.employees.findMany({
      where: {
        tenant_id: tenant_id,
        is_active: true,
        employee_skills: {
          some: {
            skill_id: { in: matchingSkillIds }
          }
        }
      },
      include: {
        departments: true,
        employee_roles: {
          where: { is_current: true },
          include: {
            // No direct relation to roles table in employee_roles
          }
        },
        employee_skills: {
          where: {
            skill_id: { in: matchingSkillIds }
          }
        }
      }
    });

    // Get all skill IDs from matched employees
    const allSkillIds = [...new Set(employeesWithSkills.flatMap(e =>
      e.employee_skills.map(es => es.skill_id)
    ))];

    // Fetch skill names
    const skillsMap = {};
    if (allSkillIds.length > 0) {
      const skillsData = await prisma.skills.findMany({
        where: { id: { in: allSkillIds } },
        select: { id: true, Skill: true, NameKnown_Skill: true }
      });
      skillsData.forEach(s => {
        skillsMap[s.id] = s.Skill || s.NameKnown_Skill;
      });
    }

    // Build requested skills map for scoring
    const requestedSkillsMap = {};
    skills.forEach(s => {
      requestedSkillsMap[s.name.trim().toLowerCase()] = {
        proficiency_level: s.proficiency_level || null,
        years_experience: s.years_experience || null
      };
    });

    // Calculate score for each employee
    const scoredEmployees = employeesWithSkills.map(emp => {
      const R = skills.length; // requested skills count
      let M = 0; // matched skills count
      let valueFitSum = 0;

      // Calculate skill match and value fit
      emp.employee_skills.forEach(es => {
        const skillName = skillIdToName[es.skill_id]?.toLowerCase();
        if (!skillName) return;

        const requested = requestedSkillsMap[skillName];
        if (!requested) return;

        M++;

        // Calculate value fit for this skill
        let pScore = 1;
        if (requested.proficiency_level) {
          if (!es.proficiency_level || es.proficiency_level === 0) {
            pScore = 0.6; // Unknown data
          } else {
            pScore = Math.min(es.proficiency_level / requested.proficiency_level, 1);
          }
        }

        let yScore = 1;
        if (requested.years_experience) {
          const actualYears = es.years_experience ? parseFloat(es.years_experience) : 0;
          if (!actualYears || actualYears === 0) {
            yScore = 0.6; // Unknown data
          } else {
            yScore = Math.min(actualYears / requested.years_experience, 1);
          }
        }

        // Combine proficiency and years scores
        let skillScore;
        if (requested.proficiency_level && requested.years_experience) {
          skillScore = 0.5 * pScore + 0.5 * yScore;
        } else if (requested.proficiency_level) {
          skillScore = pScore;
        } else if (requested.years_experience) {
          skillScore = yScore;
        } else {
          skillScore = 1;
        }

        valueFitSum += skillScore;
      });

      // Calculate component scores
      const skillMatch = R > 0 ? (M / R) * 70 : 0;
      const valueFit = M > 0 ? (valueFitSum / M) * 20 : 0;

      // Availability score (10 points)
      let availabilityScore = 10; // Default: full points if no date requested
      if (available_from) {
        const requestedDate = new Date(available_from);
        // For now, assume employees are always available unless we have availability data
        // In a real system, this would check project assignments or availability fields
        availabilityScore = 10;
      }

      const finalScore = Math.round((skillMatch + valueFit + availabilityScore) * 10) / 10;

      // Get current role for job title
      const currentRole = emp.employee_roles?.[0];

      // Build matched skill names for the breakdown note
      const matchedSkillNames = emp.employee_skills
        .map(es => skillIdToName[es.skill_id])
        .filter(Boolean);
      const requestedSkillNames = skills.map(s => s.name);
      const breakdownNote = M === R
        ? `Match completo: ${M}/${R} skill richieste trovate`
        : `Match parziale: ${M}/${R} skill richieste trovate (solo ${matchedSkillNames.join(', ')})`;

      return {
        employee_id: emp.id,
        full_name: `${emp.first_name} ${emp.last_name}`.trim(),
        email: emp.email,
        department: emp.departments?.department_name || null,
        jobtitle: emp.position || null,
        availability: null, // Would come from availability data
        skills: emp.employee_skills.map(es => ({
          name: skillsMap[es.skill_id] || null,
          proficiency_level: es.proficiency_level || null,
          years_experience: es.years_experience ? parseFloat(es.years_experience) : null
        })).filter(s => s.name),
        score: Math.max(0, Math.min(100, finalScore)),
        score_breakdown: {
          skill_match: Math.round(skillMatch * 10) / 10,
          value_fit: Math.round(valueFit * 10) / 10,
          availability: availabilityScore,
          note: breakdownNote
        }
      };
    });

    // Sort by score DESC, then by name ASC
    scoredEmployees.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.full_name.localeCompare(b.full_name);
    });

    // Apply limit
    const results = scoredEmployees.slice(0, limit);

    console.log(`[Internal API] Found ${results.length} employees matching skills`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        skills_requested: skills.length,
        skills_matched: matchingSkillIds.length
      }
    });

  } catch (error) {
    console.error('[Internal API] Search by skills error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search employees by skills',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/employees/search-by-name
 *
 * Search employees by name/surname (case-insensitive, fuzzy)
 *
 * Query params:
 * - tenant_id: string (required)
 * - query: string (required, min 2 chars)
 * - limit: number (optional, default 20)
 */
router.get('/employees/search-by-name', async (req, res) => {
  console.log('[Internal API] ========== SEARCH BY NAME REQUEST ==========');
  console.log('[Internal API] Query params:', JSON.stringify(req.query));

  try {
    const { tenant_id, query, limit: limitParam } = req.query;
    const limit = parseInt(limitParam) || 20;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Search employees by first_name or last_name
    const employees = await prisma.employees.findMany({
      where: {
        tenant_id: tenant_id,
        is_active: true,
        OR: [
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        departments: true,
        employee_roles: {
          where: { is_current: true }
        },
        employee_skills: true
      },
      orderBy: [
        { first_name: 'asc' },
        { last_name: 'asc' }
      ],
      take: limit
    });

    // Get all skill IDs
    const allSkillIds = [...new Set(employees.flatMap(e =>
      e.employee_skills.map(es => es.skill_id)
    ))];

    // Fetch skill names
    const skillsMap = {};
    if (allSkillIds.length > 0) {
      const skillsData = await prisma.skills.findMany({
        where: { id: { in: allSkillIds } },
        select: { id: true, Skill: true, NameKnown_Skill: true }
      });
      skillsData.forEach(s => {
        skillsMap[s.id] = s.Skill || s.NameKnown_Skill;
      });
    }

    // Format response
    const results = employees.map(emp => ({
      employee_id: emp.id,
      full_name: `${emp.first_name} ${emp.last_name}`.trim(),
      email: emp.email,
      department: emp.departments?.department_name || null,
      jobtitle: emp.position || null,
      availability: null,
      skills: emp.employee_skills.map(es => ({
        name: skillsMap[es.skill_id] || null,
        proficiency_level: es.proficiency_level || null,
        years_experience: es.years_experience ? parseFloat(es.years_experience) : null
      })).filter(s => s.name)
    }));

    console.log(`[Internal API] Found ${results.length} employees by name`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        query
      }
    });

  } catch (error) {
    console.error('[Internal API] Search by name error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search employees by name',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/employees/by-email
 *
 * Get employee by exact email match (case-insensitive)
 *
 * Query params:
 * - tenant_id: string (required)
 * - email: string (required)
 */
router.get('/employees/by-email', async (req, res) => {
  console.log('[Internal API] ========== GET BY EMAIL REQUEST ==========');
  console.log('[Internal API] Query params:', JSON.stringify(req.query));

  try {
    const { tenant_id, email } = req.query;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: email'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Find employee by exact email match (case-insensitive)
    const employee = await prisma.employees.findFirst({
      where: {
        tenant_id: tenant_id,
        email: { equals: email, mode: 'insensitive' }
      },
      include: {
        departments: true,
        employee_roles: {
          where: { is_current: true }
        },
        employee_skills: true
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
        email
      });
    }

    // Get skill names
    const skillIds = employee.employee_skills.map(es => es.skill_id);
    const skillsMap = {};
    if (skillIds.length > 0) {
      const skillsData = await prisma.skills.findMany({
        where: { id: { in: skillIds } },
        select: { id: true, Skill: true, NameKnown_Skill: true }
      });
      skillsData.forEach(s => {
        skillsMap[s.id] = s.Skill || s.NameKnown_Skill;
      });
    }

    // Format response
    const result = {
      employee_id: employee.id,
      full_name: `${employee.first_name} ${employee.last_name}`.trim(),
      email: employee.email,
      department: employee.departments?.department_name || null,
      jobtitle: employee.position || null,
      availability: null,
      skills: employee.employee_skills.map(es => ({
        name: skillsMap[es.skill_id] || null,
        proficiency_level: es.proficiency_level || null,
        years_experience: es.years_experience ? parseFloat(es.years_experience) : null
      })).filter(s => s.name)
    };

    console.log(`[Internal API] Found employee: ${result.full_name}`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Get by email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get employee by email',
      details: error.message
    });
  }
});

/**
 * POST /api/internal/project-roles/:roleId/match
 *
 * Run matching algorithm for a project role (wrapper for matchingController.runMatching)
 * Uses HMAC auth instead of JWT
 *
 * Body:
 * {
 *   tenant_id: string (required)
 *   filters?: { department_id?: string }
 * }
 */
router.post('/project-roles/:roleId/match', async (req, res) => {
  console.log('[Internal API] ========== RUN MATCHING REQUEST ==========');
  console.log('[Internal API] Params:', JSON.stringify(req.params));
  console.log('[Internal API] Body:', JSON.stringify(req.body));

  try {
    const { roleId } = req.params;
    const { tenant_id, filters = {} } = req.body;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Get role with project details
    const role = await prisma.project_roles.findUnique({
      where: { id: roleId },
      include: {
        projects: true
      }
    });

    if (!role || role.projects.tenant_id !== tenant_id) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Import matching controller logic
    const matchingController = require('../controllers/project/matchingController');

    // Get available employees
    const employees = await matchingController.getAvailableEmployees(
      tenant_id,
      role.projects.start_date,
      role.projects.end_date,
      filters
    );

    if (employees.length === 0) {
      return res.json({
        success: true,
        data: {
          role_id: roleId,
          total_candidates: 0,
          qualified_matches: 0,
          top_matches: []
        },
        message: 'No available employees found'
      });
    }

    // Calculate match scores for all employees
    const matches = await Promise.all(
      employees.map(employee =>
        matchingController.calculateMatchScore(employee, role)
      )
    );

    // Filter and sort matches
    const qualifiedMatches = matches
      .filter(m => m.match_score > 30)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 20);

    // Clear previous results
    await prisma.project_matching_results.deleteMany({
      where: { project_role_id: roleId }
    });

    // Save new matching results
    if (qualifiedMatches.length > 0) {
      await prisma.project_matching_results.createMany({
        data: qualifiedMatches.map(match => ({
          project_role_id: roleId,
          employee_id: match.employee_id,
          match_score: match.match_score,
          skills_match: match.skills_match,
          availability_match: match.availability_match,
          experience_match: match.experience_match,
          preference_match: match.preference_match,
          ai_reasoning: match.reasoning,
          suggested_allocation: match.suggested_allocation,
          risk_factors: match.risks,
          growth_potential: match.growth,
          is_shortlisted: match.match_score >= 70
        }))
      });
    }

    // Fetch results with employee details
    const topMatches = await prisma.project_matching_results.findMany({
      where: { project_role_id: roleId },
      include: {
        employees: {
          include: {
            departments: true,
            employee_skills: true
          }
        }
      },
      orderBy: { match_score: 'desc' },
      take: 10
    });

    // Get skill names for all employees
    const allSkillIds = [...new Set(topMatches.flatMap(m =>
      m.employees.employee_skills.map(es => es.skill_id)
    ))];

    const skillsMap = {};
    if (allSkillIds.length > 0) {
      const skillsData = await prisma.skills.findMany({
        where: { id: { in: allSkillIds } },
        select: { id: true, Skill: true, NameKnown_Skill: true }
      });
      skillsData.forEach(s => {
        skillsMap[s.id] = s.Skill || s.NameKnown_Skill;
      });
    }

    // Format response with unified format
    const formattedMatches = topMatches.map(m => ({
      full_name: `${m.employees.first_name} ${m.employees.last_name}`.trim(),
      email: m.employees.email,
      department: m.employees.departments?.department_name || null,
      jobtitle: m.employees.position || null,
      availability: null,
      skills: m.employees.employee_skills.map(es => ({
        name: skillsMap[es.skill_id] || null,
        proficiency_level: es.proficiency_level || null,
        years_experience: es.years_experience ? parseFloat(es.years_experience) : null
      })).filter(s => s.name),
      score: m.match_score,
      match_details: {
        skills_match: m.skills_match,
        availability_match: m.availability_match,
        experience_match: m.experience_match,
        preference_match: m.preference_match,
        reasoning: m.ai_reasoning || {},
        risks: m.risk_factors || [],
        growth_potential: m.growth_potential || {}
      }
    }));

    console.log(`[Internal API] Matching completed: ${qualifiedMatches.length} qualified matches`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: {
        role_id: roleId,
        total_candidates: employees.length,
        qualified_matches: qualifiedMatches.length,
        top_matches: formattedMatches
      }
    });

  } catch (error) {
    console.error('[Internal API] Run matching error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run matching algorithm',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/project-roles/:roleId/matches
 *
 * Get matching results for a project role (wrapper for matchingController.getMatchingResults)
 * Uses HMAC auth instead of JWT
 *
 * Query params:
 * - tenant_id: string (required)
 * - shortlisted_only: boolean (optional)
 */
router.get('/project-roles/:roleId/matches', async (req, res) => {
  console.log('[Internal API] ========== GET MATCHES REQUEST ==========');
  console.log('[Internal API] Params:', JSON.stringify(req.params));
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { roleId } = req.params;
    const { tenant_id, shortlisted_only = 'false' } = req.query;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Verify role belongs to tenant
    const role = await prisma.project_roles.findUnique({
      where: { id: roleId },
      include: {
        projects: true
      }
    });

    if (!role || role.projects.tenant_id !== tenant_id) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Build query
    const where = { project_role_id: roleId };
    if (shortlisted_only === 'true') {
      where.is_shortlisted = true;
    }

    // Fetch results
    const results = await prisma.project_matching_results.findMany({
      where,
      include: {
        employees: {
          include: {
            departments: true,
            employee_skills: true
          }
        }
      },
      orderBy: { match_score: 'desc' }
    });

    // Get skill names for all employees
    const allSkillIds = [...new Set(results.flatMap(m =>
      m.employees.employee_skills.map(es => es.skill_id)
    ))];

    const skillsMap = {};
    if (allSkillIds.length > 0) {
      const skillsData = await prisma.skills.findMany({
        where: { id: { in: allSkillIds } },
        select: { id: true, Skill: true, NameKnown_Skill: true }
      });
      skillsData.forEach(s => {
        skillsMap[s.id] = s.Skill || s.NameKnown_Skill;
      });
    }

    // Format response with unified format
    const formattedResults = results.map(m => ({
      full_name: `${m.employees.first_name} ${m.employees.last_name}`.trim(),
      email: m.employees.email,
      department: m.employees.departments?.department_name || null,
      jobtitle: m.employees.position || null,
      availability: null,
      skills: m.employees.employee_skills.map(es => ({
        name: skillsMap[es.skill_id] || null,
        proficiency_level: es.proficiency_level || null,
        years_experience: es.years_experience ? parseFloat(es.years_experience) : null
      })).filter(s => s.name),
      score: m.match_score,
      match_details: {
        skills_match: m.skills_match,
        availability_match: m.availability_match,
        experience_match: m.experience_match,
        preference_match: m.preference_match,
        reasoning: m.ai_reasoning || {},
        risks: m.risk_factors || [],
        growth_potential: m.growth_potential || {}
      }
    }));

    console.log(`[Internal API] Found ${formattedResults.length} matching results`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: formattedResults,
      count: formattedResults.length
    });

  } catch (error) {
    console.error('[Internal API] Get matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get matching results',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/project-roles
 *
 * Get project roles for Copilot plugin
 * Returns roles with sub_roles and their linked skills (NO project info)
 *
 * Skills come from:
 * 1. project_skills_required - directly assigned to role
 * 2. skills_sub_roles_value - inherited from sub_role
 *
 * Query params:
 * - tenant_id: string (required)
 * - status: 'open' | 'filled' | 'all' (optional, default 'open')
 * - limit: number (optional, default 20)
 */
router.get('/project-roles', async (req, res) => {
  console.log('[Internal API] ========== GET PROJECT ROLES REQUEST ==========');
  console.log('[Internal API] Query params:', JSON.stringify(req.query));

  try {
    const { tenant_id, status = 'open', limit: limitParam } = req.query;
    const limit = parseInt(limitParam) || 20;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        tenant_id
      });
    }

    // Build status filter
    let statusFilter = '';
    if (status === 'open') {
      statusFilter = "AND pr.status = 'OPEN'";
    } else if (status === 'filled') {
      statusFilter = "AND (pr.status = 'FILLED' OR pr.status = 'ASSIGNED')";
    }

    // Get project roles with sub_role info
    const roles = await prisma.$queryRawUnsafe(`
      SELECT
        pr.id,
        pr.title,
        pr.status,
        pr.priority,
        pr.seniority,
        pr.allocation_percentage,
        pr.is_urgent,
        pr.is_critical,
        pr.min_experience_years,
        pr.sub_role_id,
        sr."NameKnown_Sub_Role" as sub_role_name
      FROM project_roles pr
      JOIN projects p ON pr.project_id = p.id
      LEFT JOIN sub_roles sr ON pr.sub_role_id = sr.id
      WHERE p.tenant_id = $1::uuid
      ${statusFilter}
      ORDER BY
        CASE WHEN pr.is_critical THEN 0 WHEN pr.is_urgent THEN 1 WHEN pr.priority = 'HIGH' THEN 2 ELSE 3 END,
        pr.created_at DESC
      LIMIT $2
    `, tenant_id, limit);

    console.log(`[Internal API] Found ${roles.length} project roles for tenant ${tenant_id}`);

    // Format response with roles and sub_roles only (no skills for lighter payload)
    const formattedRoles = roles.map((role) => {
      // Build sub_roles array
      const subRoles = [];
      if (role.sub_role_id && role.sub_role_name) {
        subRoles.push({
          id: role.sub_role_id,
          name: role.sub_role_name
        });
      }

      // Determine priority string
      let priority = 'medium';
      if (role.is_critical) {
        priority = 'critical';
      } else if (role.is_urgent || role.priority === 'HIGH') {
        priority = 'high';
      } else if (role.priority === 'LOW') {
        priority = 'low';
      }

      // Map status to lowercase
      let statusLower = 'open';
      if (role.status) {
        const statusUpper = role.status.toUpperCase();
        if (statusUpper === 'FILLED' || statusUpper === 'ASSIGNED') {
          statusLower = 'filled';
        } else if (statusUpper === 'CANCELLED' || statusUpper === 'CLOSED') {
          statusLower = 'cancelled';
        }
      }

      return {
        role_id: role.id,
        role_name: role.title,
        seniority: role.seniority || null,
        status: statusLower,
        priority: priority,
        allocation_percentage: role.allocation_percentage || 100,
        min_experience_years: role.min_experience_years || null,
        sub_roles: subRoles
      };
    });

    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: formattedRoles,
      meta: {
        total: formattedRoles.length,
        status_filter: status
      }
    });

  } catch (error) {
    console.error('[Internal API] Get project roles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get project roles',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/health
 *
 * Health check for internal services
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'internal-api',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
