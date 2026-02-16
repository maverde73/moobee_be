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

    // Find matching skills in the database (exact match on Skill, NameKnown_Skill, or contains match on Synonyms_Skill)
    const matchingSkills = await prisma.skills.findMany({
      where: {
        OR: [
          { Skill: { in: normalizedSkillNames, mode: 'insensitive' } },
          { NameKnown_Skill: { in: normalizedSkillNames, mode: 'insensitive' } },
          { Synonyms_Skill: { hasSome: normalizedSkillNames } }
        ]
      },
      select: { id: true, Skill: true, NameKnown_Skill: true }
    });

    const skillIdToName = {};
    // Map each matched skill ID back to the requested skill name for scoring
    // This handles synonym matching: e.g., user asks "dotnet" -> matches "microsoft .net framework"
    // We need skillIdToRequestedName so scoring can find the entry in requestedSkillsMap
    const skillIdToRequestedName = {};
    matchingSkills.forEach(s => {
      const dbName = (s.Skill || s.NameKnown_Skill || '').toLowerCase();
      skillIdToName[s.id] = dbName;
      // Find which requested skill name matched this DB skill
      const matchedRequestedName = normalizedSkillNames.find(reqName =>
        reqName === dbName ||
        reqName === (s.NameKnown_Skill || '').toLowerCase()
      );
      skillIdToRequestedName[s.id] = matchedRequestedName || dbName;
    });
    // For synonym matches: if no direct name match was found, the skill was matched via synonym
    // Re-check against synonyms for those without a direct match
    if (matchingSkills.length > 0) {
      const skillsWithSynonyms = await prisma.skills.findMany({
        where: { id: { in: matchingSkills.map(s => s.id) } },
        select: { id: true, Synonyms_Skill: true }
      });
      skillsWithSynonyms.forEach(s => {
        if (!normalizedSkillNames.includes(skillIdToRequestedName[s.id])) {
          // Check if any requested name appears in synonyms
          const synonymMatch = normalizedSkillNames.find(reqName =>
            (s.Synonyms_Skill || []).map(syn => syn.toLowerCase()).includes(reqName)
          );
          if (synonymMatch) {
            skillIdToRequestedName[s.id] = synonymMatch;
          }
        }
      });
    }
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
        // Use the requested name mapping (handles synonyms: "dotnet" -> skill id 970)
        const requestedName = skillIdToRequestedName[es.skill_id];
        if (!requestedName) return;

        const requested = requestedSkillsMap[requestedName];
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
    // Split query into words to support "Marco Esposito" matching first_name=Marco AND last_name=Esposito
    const words = query.trim().split(/\s+/);
    let searchFilter;
    if (words.length >= 2) {
      // Multi-word: try first+last combination in both orders, plus individual word matches
      searchFilter = {
        OR: [
          { AND: [{ first_name: { contains: words[0], mode: 'insensitive' } }, { last_name: { contains: words.slice(1).join(' '), mode: 'insensitive' } }] },
          { AND: [{ first_name: { contains: words.slice(1).join(' '), mode: 'insensitive' } }, { last_name: { contains: words[0], mode: 'insensitive' } }] },
          ...words.map(w => ({ first_name: { contains: w, mode: 'insensitive' } })),
          ...words.map(w => ({ last_name: { contains: w, mode: 'insensitive' } }))
        ]
      };
    } else {
      searchFilter = {
        OR: [
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } }
        ]
      };
    }

    const employees = await prisma.employees.findMany({
      where: {
        tenant_id: tenant_id,
        is_active: true,
        ...searchFilter
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
        pr.project_id,
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
        project_id: role.project_id,
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
 * POST /api/internal/employees/check-profiles-freshness
 *
 * Check how up-to-date employee profiles are (skills, CV extractions)
 * Used by Copilot to verify if candidate profiles need updating before
 * sending them to a client.
 *
 * Body:
 * {
 *   tenant_id: string (required) - Moobee tenant UUID
 *   employee_ids: string (required) - Comma-separated employee IDs, e.g. "260,261,262"
 * }
 */
router.post('/employees/check-profiles-freshness', async (req, res) => {
  console.log('[Internal API] ========== CHECK PROFILES FRESHNESS REQUEST ==========');
  console.log('[Internal API] Body:', JSON.stringify(req.body));

  try {
    const { tenant_id, employee_ids } = req.body;

    // Validate required fields
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    if (!employee_ids || typeof employee_ids !== 'string' || employee_ids.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid employee_ids. Expected comma-separated IDs, e.g. "260,261,262"'
      });
    }

    // Parse employee_ids into array of integers
    const idArray = employee_ids.split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);

    if (idArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid employee IDs provided'
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

    // Get employees with their skills and CV extractions
    const employees = await prisma.employees.findMany({
      where: {
        id: { in: idArray },
        tenant_id: tenant_id
      },
      include: {
        employee_skills: {
          select: {
            updated_at: true,
            source: true
          }
        },
        cv_extractions: {
          where: { status: 'completed' },
          select: {
            created_at: true
          },
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });

    const now = new Date();

    const results = employees.map(emp => {
      // Find the most recent skill update
      const skillUpdates = emp.employee_skills
        .map(es => es.updated_at)
        .filter(Boolean);
      const lastSkillsUpdate = skillUpdates.length > 0
        ? new Date(Math.max(...skillUpdates.map(d => new Date(d).getTime())))
        : null;

      // Determine predominant source
      const sources = emp.employee_skills.map(es => es.source).filter(Boolean);
      const sourceCount = {};
      sources.forEach(s => { sourceCount[s] = (sourceCount[s] || 0) + 1; });
      const skillsSource = Object.entries(sourceCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'manual';

      // Latest CV extraction
      const lastCvExtraction = emp.cv_extractions[0]?.created_at || null;

      // Most recent timestamp across all sources
      const timestamps = [
        lastSkillsUpdate,
        lastCvExtraction,
        emp.updated_at
      ].filter(Boolean).map(d => new Date(d).getTime());

      const mostRecent = timestamps.length > 0
        ? new Date(Math.max(...timestamps))
        : emp.created_at;

      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine freshness status
      let freshnessStatus;
      if (daysSinceUpdate < 90) {
        freshnessStatus = 'current';
      } else if (daysSinceUpdate <= 180) {
        freshnessStatus = 'aging';
      } else {
        freshnessStatus = 'stale';
      }

      return {
        employee_id: emp.id,
        full_name: `${emp.first_name} ${emp.last_name}`.trim(),
        email: emp.email,
        last_skills_update: lastSkillsUpdate ? lastSkillsUpdate.toISOString() : null,
        skills_source: skillsSource,
        last_cv_extraction: lastCvExtraction ? new Date(lastCvExtraction).toISOString() : null,
        days_since_update: daysSinceUpdate,
        freshness_status: freshnessStatus,
        total_skills: emp.employee_skills.length
      };
    });

    // Sort by days_since_update descending (most stale first)
    results.sort((a, b) => b.days_since_update - a.days_since_update);

    // Calculate meta counts
    const meta = {
      total: results.length,
      current: results.filter(r => r.freshness_status === 'current').length,
      aging: results.filter(r => r.freshness_status === 'aging').length,
      stale: results.filter(r => r.freshness_status === 'stale').length
    };

    console.log(`[Internal API] Profiles freshness: ${meta.current} current, ${meta.aging} aging, ${meta.stale} stale`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: results,
      meta
    });

  } catch (error) {
    console.error('[Internal API] Check profiles freshness error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check profiles freshness',
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

// ============================================
// L2 Tactical Endpoints
// ============================================

/**
 * GET /api/internal/employees/:employeeId/skill-gaps
 *
 * Skill gap analysis for an employee, optionally filtered by target role.
 *
 * Query params:
 * - tenant_id: string (required)
 * - role_id: number (optional) - filter gaps for specific role
 */
router.get('/employees/:employeeId/skill-gaps', async (req, res) => {
  console.log('[Internal API] ========== SKILL GAP ANALYSIS REQUEST ==========');
  console.log('[Internal API] Params:', JSON.stringify(req.params));
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { employeeId } = req.params;
    const { tenant_id, role_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Verify employee exists and belongs to tenant
    const employee = await prisma.employees.findFirst({
      where: {
        id: parseInt(employeeId),
        tenant_id
      },
      select: { id: true, first_name: true, last_name: true }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Build skill_gaps query
    const where = { employee_id: parseInt(employeeId) };
    if (role_id) {
      where.role_id = parseInt(role_id);
    }

    const gaps = await prisma.skill_gaps.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { gap_size: 'desc' }
      ]
    });

    // Get skill names
    const skillIds = [...new Set(gaps.map(g => g.skill_id))];
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

    // Get role name if role_id provided
    let targetRoleName = null;
    if (role_id) {
      const role = await prisma.roles.findUnique({
        where: { id: parseInt(role_id) },
        select: { Role: true }
      });
      targetRoleName = role?.Role || null;
    }

    // Format gaps
    const formattedGaps = gaps.map(g => ({
      skill_name: skillsMap[g.skill_id] || 'Unknown',
      current_level: g.current_level || 0,
      required_level: g.required_level || 0,
      gap_size: g.gap_size || 0,
      priority: g.priority || 'medium'
    }));

    // Summary
    const highPriority = formattedGaps.filter(g => g.priority === 'high' || g.priority === 'critical').length;
    const mediumPriority = formattedGaps.filter(g => g.priority === 'medium').length;
    const lowPriority = formattedGaps.filter(g => g.priority === 'low').length;
    const avgGapSize = formattedGaps.length > 0
      ? parseFloat((formattedGaps.reduce((sum, g) => sum + g.gap_size, 0) / formattedGaps.length).toFixed(1))
      : 0;

    const result = {
      employee_id: parseInt(employeeId),
      full_name: `${employee.first_name} ${employee.last_name}`.trim(),
      target_role: targetRoleName,
      gaps: formattedGaps,
      summary: {
        total_gaps: formattedGaps.length,
        high_priority: highPriority,
        medium_priority: mediumPriority,
        low_priority: lowPriority,
        avg_gap_size: avgGapSize
      }
    };

    console.log(`[Internal API] Found ${formattedGaps.length} skill gaps`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Skill gap analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get skill gap analysis',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/projects/:projectId/team
 *
 * Team composition for a project with roles, assignments and coverage.
 *
 * Query params:
 * - tenant_id: string (required)
 */
router.get('/projects/:projectId/team', async (req, res) => {
  console.log('[Internal API] ========== TEAM COMPOSITION REQUEST ==========');
  console.log('[Internal API] Params:', JSON.stringify(req.params));
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { projectId } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Get project with roles
    // Using select to only fetch fields actually needed by this endpoint,
    // avoiding schema-database drift (e.g., client_name column missing from DB)
    const project = await prisma.projects.findFirst({
      where: {
        id: parseInt(projectId),
        tenant_id
      },
      select: {
        id: true,
        project_name: true,
        status: true,
        team_size: true,
        project_roles: {
          select: {
            id: true,
            title: true,
            seniority: true,
            status: true,
            sub_role: true,
            project_matching_results: {
              where: { is_shortlisted: true },
              include: {
                employees: {
                  select: { id: true, first_name: true, last_name: true, email: true }
                }
              },
              orderBy: { match_score: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Format roles
    const roles = project.project_roles.map(role => {
      const assigned = role.project_matching_results[0]?.employees || null;
      const statusUpper = (role.status || 'OPEN').toUpperCase();
      const isFilled = statusUpper === 'FILLED' || statusUpper === 'ASSIGNED';

      return {
        role_name: role.title,
        seniority: role.seniority || null,
        status: isFilled ? 'filled' : 'open',
        assigned_to: assigned ? {
          full_name: `${assigned.first_name} ${assigned.last_name}`.trim(),
          email: assigned.email
        } : null
      };
    });

    const filledCount = roles.filter(r => r.status === 'filled').length;
    const totalRoles = roles.length;

    const result = {
      project_name: project.project_name,
      client_name: null, // Column not yet available in database; add to select when migration is applied
      status: project.status || 'PLANNING',
      team_size: project.team_size || totalRoles,
      roles,
      summary: {
        total_roles: totalRoles,
        filled: filledCount,
        open: totalRoles - filledCount,
        coverage_percentage: totalRoles > 0 ? Math.round((filledCount / totalRoles) * 100) : 0
      }
    };

    console.log(`[Internal API] Project team: ${totalRoles} roles, ${filledCount} filled`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Team composition error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get team composition',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/employees/:employeeId/assessments
 *
 * Assessment summary for an employee (legacy assessments + new assessment_results).
 *
 * Query params:
 * - tenant_id: string (required)
 */
router.get('/employees/:employeeId/assessments', async (req, res) => {
  console.log('[Internal API] ========== ASSESSMENT SUMMARY REQUEST ==========');
  console.log('[Internal API] Params:', JSON.stringify(req.params));
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { employeeId } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Verify employee
    const employee = await prisma.employees.findFirst({
      where: {
        id: parseInt(employeeId),
        tenant_id
      },
      select: { id: true, first_name: true, last_name: true }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Get legacy assessments
    const legacyAssessments = await prisma.assessments.findMany({
      where: {
        employee_id: parseInt(employeeId),
        tenant_id
      },
      orderBy: { assessment_date: 'desc' }
    });

    // Get new assessment results
    const newResults = await prisma.assessment_results.findMany({
      where: {
        employee_id: parseInt(employeeId)
      },
      orderBy: { completed_at: 'desc' }
    });

    // Combine history
    const history = [];

    legacyAssessments.forEach(a => {
      history.push({
        type: a.assessment_type,
        date: a.assessment_date ? a.assessment_date.toISOString().split('T')[0] : null,
        overall_score: a.overall_score ? parseFloat(a.overall_score) : null,
        technical_score: a.technical_score ? parseFloat(a.technical_score) : null,
        soft_skills_score: a.soft_skills_score ? parseFloat(a.soft_skills_score) : null
      });
    });

    newResults.forEach(r => {
      history.push({
        type: 'campaign_assessment',
        date: r.completed_at ? r.completed_at.toISOString().split('T')[0] : null,
        overall_score: r.overall_score || null,
        technical_score: null,
        soft_skills_score: null
      });
    });

    // Sort by date descending
    history.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    const latest = history[0] || null;

    // Determine trend
    let trend = 'stable';
    if (history.length >= 2) {
      const recent = history[0]?.overall_score;
      const previous = history[1]?.overall_score;
      if (recent && previous) {
        if (recent > previous) trend = 'improving';
        else if (recent < previous) trend = 'declining';
      }
    }

    // Aggregate strengths and improvements from new results
    const strengths = [];
    const improvements = [];
    newResults.forEach(r => {
      if (r.strengths && Array.isArray(r.strengths)) {
        r.strengths.forEach(s => {
          if (typeof s === 'string' && !strengths.includes(s)) strengths.push(s);
        });
      }
      if (r.improvements && Array.isArray(r.improvements)) {
        r.improvements.forEach(i => {
          if (typeof i === 'string' && !improvements.includes(i)) improvements.push(i);
        });
      }
    });

    const result = {
      employee_id: parseInt(employeeId),
      full_name: `${employee.first_name} ${employee.last_name}`.trim(),
      latest_assessment: latest ? {
        type: latest.type,
        date: latest.date,
        overall_score: latest.overall_score,
        technical_score: latest.technical_score,
        soft_skills_score: latest.soft_skills_score
      } : null,
      history: history.slice(0, 10),
      strengths: strengths.slice(0, 5),
      improvements: improvements.slice(0, 5),
      trend,
      total_assessments: history.length
    };

    console.log(`[Internal API] Found ${history.length} assessments`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Assessment summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assessment summary',
      details: error.message
    });
  }
});

// ============================================
// L3 Strategic Endpoints (Analytics)
// ============================================

/**
 * GET /api/internal/analytics/workforce
 *
 * Workforce analytics dashboard for tenant.
 *
 * Query params:
 * - tenant_id: string (required)
 */
router.get('/analytics/workforce', async (req, res) => {
  console.log('[Internal API] ========== WORKFORCE ANALYTICS REQUEST ==========');
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Total and active employees
    const totalEmployees = await prisma.employees.count({
      where: { tenant_id }
    });

    const activeEmployees = await prisma.employees.count({
      where: { tenant_id, is_active: true }
    });

    // Employees by department with avg proficiency
    const deptData = await prisma.$queryRawUnsafe(`
      SELECT
        d.department_name as name,
        COUNT(DISTINCT e.id) as count,
        ROUND(AVG(es.proficiency_level)::numeric, 1) as avg_proficiency
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employee_skills es ON e.id = es.employee_id
      WHERE e.tenant_id = $1::uuid AND e.is_active = true
      GROUP BY d.department_name
      ORDER BY count DESC
      LIMIT 20
    `, tenant_id);

    const departments = deptData.map(d => ({
      name: d.name || 'Non assegnato',
      count: parseInt(d.count),
      avg_proficiency: d.avg_proficiency ? parseFloat(d.avg_proficiency) : null
    }));

    // Top 10 skills
    const topSkillsData = await prisma.$queryRawUnsafe(`
      SELECT
        s."Skill" as name,
        COUNT(es.id) as count
      FROM employee_skills es
      JOIN skills s ON es.skill_id = s.id
      JOIN employees e ON es.employee_id = e.id
      WHERE e.tenant_id = $1::uuid AND e.is_active = true
      GROUP BY s."Skill"
      ORDER BY count DESC
      LIMIT 10
    `, tenant_id);

    const topSkills = topSkillsData.map(s => ({
      name: s.name,
      count: parseInt(s.count)
    }));

    // Projects by status
    const projectsData = await prisma.projects.groupBy({
      by: ['status'],
      where: { tenant_id },
      _count: { id: true }
    });

    const projectCounts = { active: 0, planning: 0, completed: 0 };
    projectsData.forEach(p => {
      const st = (p.status || '').toUpperCase();
      if (st === 'IN_PROGRESS' || st === 'ACTIVE') projectCounts.active += p._count.id;
      else if (st === 'PLANNING') projectCounts.planning += p._count.id;
      else if (st === 'COMPLETED') projectCounts.completed += p._count.id;
    });

    // Skill coverage
    const uniqueSkillsCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT es.skill_id) as unique_skills
      FROM employee_skills es
      JOIN employees e ON es.employee_id = e.id
      WHERE e.tenant_id = $1::uuid AND e.is_active = true
    `, tenant_id);

    const totalSkillAssignments = await prisma.$queryRawUnsafe(`
      SELECT COUNT(es.id) as total
      FROM employee_skills es
      JOIN employees e ON es.employee_id = e.id
      WHERE e.tenant_id = $1::uuid AND e.is_active = true
    `, tenant_id);

    const uniqueSkills = parseInt(uniqueSkillsCount[0]?.unique_skills || 0);
    const totalAssignments = parseInt(totalSkillAssignments[0]?.total || 0);
    const avgSkillsPerEmployee = activeEmployees > 0
      ? parseFloat((totalAssignments / activeEmployees).toFixed(1))
      : 0;

    const result = {
      total_employees: totalEmployees,
      active_employees: activeEmployees,
      departments,
      top_skills: topSkills,
      projects: projectCounts,
      skill_coverage: {
        total_unique_skills: uniqueSkills,
        avg_skills_per_employee: avgSkillsPerEmployee
      }
    };

    console.log('[Internal API] Workforce analytics computed');
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Workforce analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get workforce analytics',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/analytics/engagement
 *
 * Engagement trends over time.
 *
 * Query params:
 * - tenant_id: string (required)
 * - department_id: number (optional)
 * - months: number (optional, default 6)
 */
router.get('/analytics/engagement', async (req, res) => {
  console.log('[Internal API] ========== ENGAGEMENT TRENDS REQUEST ==========');
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { tenant_id, department_id, months: monthsParam } = req.query;
    const months = parseInt(monthsParam) || 6;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    // Build where clause
    const where = {
      tenant_id,
      survey_month: { gte: cutoffDate }
    };

    if (department_id) {
      // Need to join through employees to filter by department
      where.employee_id = {
        in: (await prisma.employees.findMany({
          where: { tenant_id, department_id: parseInt(department_id) },
          select: { id: true }
        })).map(e => e.id)
      };
    }

    const surveys = await prisma.engagement_surveys.findMany({
      where,
      orderBy: { survey_month: 'desc' }
    });

    if (surveys.length === 0) {
      return res.json({
        success: true,
        data: {
          period: `ultimi ${months} mesi`,
          current_score: null,
          previous_score: null,
          trend: 'no_data',
          trend_delta: 0,
          monthly_scores: [],
          areas: {},
          top_challenges: [],
          total_responses: 0
        }
      });
    }

    // Group by month
    const monthlyMap = {};
    surveys.forEach(s => {
      const monthKey = s.survey_month.toISOString().substring(0, 7);
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { scores: [], responses: 0 };
      }
      if (s.overall_score) {
        monthlyMap[monthKey].scores.push(parseFloat(s.overall_score));
      }
      monthlyMap[monthKey].responses++;
    });

    const monthlyScores = Object.entries(monthlyMap)
      .map(([month, data]) => ({
        month,
        score: data.scores.length > 0
          ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1))
          : null,
        responses: data.responses
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const currentScore = monthlyScores[0]?.score || null;
    const previousScore = monthlyScores[1]?.score || null;

    let trend = 'stable';
    let trendDelta = 0;
    if (currentScore !== null && previousScore !== null) {
      trendDelta = parseFloat((currentScore - previousScore).toFixed(1));
      if (trendDelta > 0.2) trend = 'improving';
      else if (trendDelta < -0.2) trend = 'declining';
    }

    // Area averages
    const areaFields = ['job_satisfaction', 'work_life_balance', 'career_development', 'team_collaboration', 'manager_support'];
    const areas = {};
    areaFields.forEach(field => {
      const values = surveys.filter(s => s[field] != null).map(s => s[field]);
      areas[field] = values.length > 0
        ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
        : null;
    });

    // Top challenges
    const challengeCounts = {};
    surveys.forEach(s => {
      if (s.challenges_faced && Array.isArray(s.challenges_faced)) {
        s.challenges_faced.forEach(c => {
          challengeCounts[c] = (challengeCounts[c] || 0) + 1;
        });
      }
    });
    const topChallenges = Object.entries(challengeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([challenge]) => challenge);

    const result = {
      period: `ultimi ${months} mesi`,
      current_score: currentScore,
      previous_score: previousScore,
      trend,
      trend_delta: trendDelta,
      monthly_scores: monthlyScores,
      areas,
      top_challenges: topChallenges,
      total_responses: surveys.length
    };

    console.log(`[Internal API] Engagement trends: ${surveys.length} surveys`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Engagement trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get engagement trends',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/analytics/talent-pipeline
 *
 * Talent pipeline - career aspirations and readiness.
 *
 * Query params:
 * - tenant_id: string (required)
 * - target_role_id: number (optional)
 */
router.get('/analytics/talent-pipeline', async (req, res) => {
  console.log('[Internal API] ========== TALENT PIPELINE REQUEST ==========');
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { tenant_id, target_role_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    // Get active aspirations
    const where = { tenant_id, is_active: true };
    if (target_role_id) {
      where.target_role_id = parseInt(target_role_id);
    }

    const aspirations = await prisma.career_aspirations.findMany({ where });

    // Get employee details
    const employeeIds = [...new Set(aspirations.map(a => a.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, first_name: true, last_name: true, email: true }
    });
    const empMap = {};
    employees.forEach(e => {
      empMap[e.id] = e;
    });

    // Get skill gaps count per employee
    const gapCounts = await prisma.skill_gaps.groupBy({
      by: ['employee_id'],
      where: { employee_id: { in: employeeIds } },
      _count: { id: true }
    });
    const gapMap = {};
    gapCounts.forEach(g => {
      gapMap[g.employee_id] = g._count.id;
    });

    // Group by target position
    const byRole = {};
    aspirations.forEach(a => {
      const position = a.target_position || 'Non specificato';
      if (!byRole[position]) {
        byRole[position] = [];
      }

      const emp = empMap[a.employee_id];
      const gaps = gapMap[a.employee_id] || 0;
      // Simple readiness: fewer gaps = higher readiness
      const readiness = gaps === 0 ? 100 : Math.max(0, Math.round(100 - (gaps * 15)));

      byRole[position].push({
        full_name: emp ? `${emp.first_name} ${emp.last_name}`.trim() : 'N/A',
        email: emp?.email || null,
        readiness_percentage: readiness,
        target_date: a.target_date ? a.target_date.toISOString().split('T')[0] : null,
        gaps_count: gaps
      });
    });

    // Format by_target_role
    const byTargetRole = Object.entries(byRole).map(([position, candidates]) => ({
      target_position: position,
      count: candidates.length,
      candidates: candidates.sort((a, b) => b.readiness_percentage - a.readiness_percentage)
    }));

    // Readiness distribution
    const allCandidates = Object.values(byRole).flat();
    const readyCount = allCandidates.filter(c => c.readiness_percentage >= 80).length;
    const almostReady = allCandidates.filter(c => c.readiness_percentage >= 50 && c.readiness_percentage < 80).length;
    const developing = allCandidates.filter(c => c.readiness_percentage < 50).length;

    const result = {
      total_aspirants: aspirations.length,
      by_target_role: byTargetRole,
      readiness_distribution: {
        ready: readyCount,
        almost_ready: almostReady,
        developing: developing
      }
    };

    console.log(`[Internal API] Talent pipeline: ${aspirations.length} aspirants`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Talent pipeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get talent pipeline',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/analytics/certifications
 *
 * Certification tracking - active, expiring, expired.
 *
 * Query params:
 * - tenant_id: string (required)
 * - expiring_within_days: number (optional, default 90)
 */
router.get('/analytics/certifications', async (req, res) => {
  console.log('[Internal API] ========== CERTIFICATION TRACKING REQUEST ==========');
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { tenant_id, expiring_within_days: daysParam } = req.query;
    const expiringDays = parseInt(daysParam) || 90;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    const now = new Date();
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + expiringDays);

    // Get all certifications for tenant
    const certs = await prisma.employee_certifications.findMany({
      where: { tenant_id },
      include: {
        employees: {
          select: { first_name: true, last_name: true, email: true }
        }
      },
      orderBy: { expiry_date: 'asc' }
    });

    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    const expiringList = [];

    certs.forEach(c => {
      if (!c.expiry_date) {
        active++; // No expiry = perpetual
        return;
      }

      const expDate = new Date(c.expiry_date);
      if (expDate < now) {
        expired++;
      } else if (expDate <= expiryThreshold) {
        expiringSoon++;
        const daysUntil = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        expiringList.push({
          employee_name: `${c.employees.first_name} ${c.employees.last_name}`.trim(),
          email: c.employees.email,
          certification_name: c.certification_name,
          expiry_date: c.expiry_date.toISOString().split('T')[0],
          days_until_expiry: daysUntil,
          issuing_organization: c.issuing_organization || null
        });
      } else {
        active++;
      }
    });

    // Top certifications by count
    const certCounts = {};
    certs.forEach(c => {
      const name = c.certification_name;
      certCounts[name] = (certCounts[name] || 0) + 1;
    });
    const topCertifications = Object.entries(certCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const result = {
      total_certifications: certs.length,
      active,
      expiring_soon: expiringSoon,
      expired,
      expiring_list: expiringList.sort((a, b) => a.days_until_expiry - b.days_until_expiry),
      top_certifications: topCertifications
    };

    console.log(`[Internal API] Certifications: ${certs.length} total, ${expiringSoon} expiring soon`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] Certification tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get certification tracking',
      details: error.message
    });
  }
});

/**
 * GET /api/internal/analytics/ai-costs
 *
 * AI/LLM cost analytics.
 *
 * Query params:
 * - tenant_id: string (required)
 * - days: number (optional, default 30)
 */
router.get('/analytics/ai-costs', async (req, res) => {
  console.log('[Internal API] ========== AI COST ANALYTICS REQUEST ==========');
  console.log('[Internal API] Query:', JSON.stringify(req.query));

  try {
    const { tenant_id, days: daysParam } = req.query;
    const days = parseInt(daysParam) || 30;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tenant_id'
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const logs = await prisma.llm_usage_logs.findMany({
      where: {
        tenant_id,
        created_at: { gte: cutoffDate }
      },
      orderBy: { created_at: 'desc' }
    });

    // Aggregate by operation
    const byOperation = {};
    logs.forEach(l => {
      const op = l.operation_type;
      if (!byOperation[op]) {
        byOperation[op] = { cost: 0, tokens: 0, count: 0 };
      }
      byOperation[op].cost += l.estimated_cost ? parseFloat(l.estimated_cost) : 0;
      byOperation[op].tokens += l.total_tokens || 0;
      byOperation[op].count++;
    });

    const operationList = Object.entries(byOperation)
      .map(([operation, data]) => ({
        operation,
        cost: parseFloat(data.cost.toFixed(2)),
        tokens: data.tokens,
        count: data.count
      }))
      .sort((a, b) => b.cost - a.cost);

    // Aggregate by provider/model
    const byProvider = {};
    logs.forEach(l => {
      const key = `${l.provider}|${l.model}`;
      if (!byProvider[key]) {
        byProvider[key] = { provider: l.provider, model: l.model, cost: 0, count: 0 };
      }
      byProvider[key].cost += l.estimated_cost ? parseFloat(l.estimated_cost) : 0;
      byProvider[key].count++;
    });

    const providerList = Object.values(byProvider)
      .map(p => ({
        provider: p.provider,
        model: p.model,
        cost: parseFloat(p.cost.toFixed(2)),
        count: p.count
      }))
      .sort((a, b) => b.cost - a.cost);

    // Daily trend
    const byDay = {};
    logs.forEach(l => {
      const day = l.created_at.toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { cost: 0, operations: 0 };
      }
      byDay[day].cost += l.estimated_cost ? parseFloat(l.estimated_cost) : 0;
      byDay[day].operations++;
    });

    const dailyTrend = Object.entries(byDay)
      .map(([date, data]) => ({
        date,
        cost: parseFloat(data.cost.toFixed(2)),
        operations: data.operations
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const totalCost = logs.reduce((sum, l) => sum + (l.estimated_cost ? parseFloat(l.estimated_cost) : 0), 0);
    const totalTokens = logs.reduce((sum, l) => sum + (l.total_tokens || 0), 0);

    const result = {
      period: `ultimi ${days} giorni`,
      total_cost: parseFloat(totalCost.toFixed(2)),
      total_tokens: totalTokens,
      total_operations: logs.length,
      by_operation: operationList,
      by_provider: providerList,
      daily_trend: dailyTrend.slice(0, 30)
    };

    console.log(`[Internal API] AI costs: ${logs.length} operations, $${totalCost.toFixed(2)}`);
    console.log('[Internal API] ========== END REQUEST ==========');

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Internal API] AI cost analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI cost analytics',
      details: error.message
    });
  }
});

module.exports = router;
