/**
 * LLM Role Matching Service
 * Fallback service for matching extracted roles to database sub-roles using LLM
 * Date: 10 October 2025
 *
 * Use Case:
 * When BE_py fails to find exact match for extracted role (id_sub_role === null),
 * use OpenAI GPT-4o to find the best matching sub-role from database.
 */

const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const LLMAuditService = require('./llmAuditService');

class LLMRoleMatchingService {
  /**
   * Find best matching sub-role using LLM when exact match fails
   * @param {Object} extractedRole - Role extracted from CV by BE_py
   * @param {string} extractedRole.free_role - Free text role name (e.g., "Junior web developer")
   * @param {string} extractedRole.seniority - Seniority level (e.g., "Junior")
   * @param {string} extractedRole.track - Track (e.g., "Frontend", "Backend", "Fullstack")
   * @param {string} extractedRole.grade - Grade (e.g., "J2")
   * @param {string} tenantId - Tenant UUID
   * @param {number} employeeId - Employee ID (for logging)
   * @param {string} [userId] - User ID who triggered the operation
   * @returns {Promise<Object|null>} Matched sub-role or null if confidence too low
   */
  static async findBestSubRoleMatch(extractedRole, tenantId, employeeId, userId = null) {
    const prisma = new PrismaClient();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const startTime = Date.now();

    try {
      console.log(`[LLM Role Match] 🔍 Starting fallback matching for: "${extractedRole.free_role}"`);

      // 1. Fetch ALL sub-roles from database
      const allSubRoles = await prisma.sub_roles.findMany({
        select: {
          id: true,
          Sub_Role: true,
          NameKnown_Sub_Role: true,
          Synonyms_Sub_Role: true,
          role_sub_role: {
            select: {
              id_role: true,
              roles: {
                select: {
                  id: true,
                  Role: true,
                  NameKnown_Role: true
                }
              }
            }
          }
        },
        where: {
          // Optional: Filter by tenant if sub_roles have tenant_id
          // tenant_id: tenantId
        }
      });

      if (!allSubRoles || allSubRoles.length === 0) {
        console.error('[LLM Role Match] ❌ No sub-roles found in database');
        return null;
      }

      console.log(`[LLM Role Match] 📋 Found ${allSubRoles.length} sub-roles in database`);

      // 2. Filter candidate sub-roles based on track (if available)
      let candidateSubRoles = allSubRoles;

      if (extractedRole.track) {
        // Map track to role IDs (you may need to adjust these based on your database)
        const trackRoleMap = {
          'Frontend': [4],
          'Backend': [5],
          'Fullstack': [6],
          'DevOps': [7],
          'Mobile': [8],
          'Data': [9]
        };

        const relevantRoleIds = trackRoleMap[extractedRole.track];

        if (relevantRoleIds && relevantRoleIds.length > 0) {
          const filtered = allSubRoles.filter(sr =>
            sr.role_sub_role.some(rsr => relevantRoleIds.includes(rsr.id_role))
          );

          if (filtered.length > 0) {
            candidateSubRoles = filtered;
            console.log(`[LLM Role Match] 🎯 Filtered to ${candidateSubRoles.length} sub-roles for track "${extractedRole.track}"`);
          }
        }
      }

      // Optional: Filter by seniority (if sub-role names contain seniority keywords)
      if (extractedRole.seniority && candidateSubRoles.length > 20) {
        const seniorityKeywords = extractedRole.seniority.toLowerCase();
        const filtered = candidateSubRoles.filter(sr =>
          sr.Sub_Role?.toLowerCase().includes(seniorityKeywords) ||
          sr.NameKnown_Sub_Role?.toLowerCase().includes(seniorityKeywords)
        );

        if (filtered.length > 0) {
          candidateSubRoles = filtered;
          console.log(`[LLM Role Match] 🎯 Filtered to ${candidateSubRoles.length} sub-roles for seniority "${extractedRole.seniority}"`);
        }
      }

      // Limit to top 50 for token efficiency
      if (candidateSubRoles.length > 50) {
        candidateSubRoles = candidateSubRoles.slice(0, 50);
      }

      // 3. Build OpenAI prompt
      const prompt = this._buildMatchingPrompt(extractedRole, candidateSubRoles);

      // 4. Call OpenAI GPT-4o
      console.log(`[LLM Role Match] 🤖 Calling OpenAI GPT-4o with ${candidateSubRoles.length} candidates...`);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a precise job role matching expert. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistency
        response_format: { type: 'json_object' }
      });

      const responseTime = Date.now() - startTime;
      const usage = response.usage;

      // Parse LLM response
      const llmMatch = JSON.parse(response.choices[0].message.content);

      console.log(`[LLM Role Match] 📊 LLM Response:`, llmMatch);

      // 5. Validate and retrieve matched sub-role
      const suggestedSubRole = candidateSubRoles.find(sr => sr.id === llmMatch.sub_role_id);

      if (!suggestedSubRole) {
        console.error(`[LLM Role Match] ❌ Invalid sub_role_id returned: ${llmMatch.sub_role_id}`);

        // Log failure
        await LLMAuditService.logUsage({
          tenantId,
          operationType: 'role_matching_fallback',
          provider: 'openai',
          model: 'gpt-4o',
          usage,
          status: 'failed',
          responseTime,
          entityType: 'employee',
          entityId: String(employeeId),
          userId,
          errorMessage: `Invalid sub_role_id: ${llmMatch.sub_role_id}`,
          requestParams: {
            extracted_role: extractedRole.free_role,
            seniority: extractedRole.seniority,
            track: extractedRole.track,
            candidates_count: candidateSubRoles.length
          },
          responseSummary: llmMatch,
          metadata: {
            cv_extraction: true
          }
        });

        return null;
      }

      // Check confidence threshold
      if (llmMatch.confidence < 70) {
        console.warn(`[LLM Role Match] ⚠️ Low confidence: ${llmMatch.confidence}%. Skipping match.`);

        // Log low confidence
        await LLMAuditService.logUsage({
          tenantId,
          operationType: 'role_matching_fallback',
          provider: 'openai',
          model: 'gpt-4o',
          usage,
          status: 'failed',
          responseTime,
          entityType: 'employee',
          entityId: String(employeeId),
          userId,
          errorMessage: `Low confidence: ${llmMatch.confidence}%`,
          requestParams: {
            extracted_role: extractedRole.free_role,
            seniority: extractedRole.seniority,
            track: extractedRole.track,
            candidates_count: candidateSubRoles.length
          },
          responseSummary: llmMatch,
          metadata: {
            cv_extraction: true
          }
        });

        return null;
      }

      // 6. Success! Log usage
      console.log(`[LLM Role Match] ✅ Match found: "${extractedRole.free_role}" → "${suggestedSubRole.Sub_Role}" (confidence: ${llmMatch.confidence}%)`);

      await LLMAuditService.logUsage({
        tenantId,
        operationType: 'role_matching_fallback',
        provider: 'openai',
        model: 'gpt-4o',
        usage,
        status: 'success',
        responseTime,
        entityType: 'employee',
        entityId: String(employeeId),
        userId,
        requestParams: {
          extracted_role: extractedRole.free_role,
          seniority: extractedRole.seniority,
          track: extractedRole.track,
          candidates_count: candidateSubRoles.length
        },
        responseSummary: {
          matched_sub_role: suggestedSubRole.Sub_Role,
          confidence: llmMatch.confidence,
          reasoning: llmMatch.reasoning
        },
        metadata: {
          cv_extraction: true
        }
      });

      // 7. Return matched sub-role with metadata
      return {
        sub_role_id: suggestedSubRole.id,
        sub_role_name: suggestedSubRole.Sub_Role,
        role_id: suggestedSubRole.role_sub_role[0]?.id_role || null,
        role_name: suggestedSubRole.role_sub_role[0]?.roles?.Role || null,
        confidence: llmMatch.confidence,
        reasoning: llmMatch.reasoning,
        source: 'llm_fallback'
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      console.error('[LLM Role Match] ❌ Error:', error.message);

      // Log error
      await LLMAuditService.logUsage({
        tenantId,
        operationType: 'role_matching_fallback',
        provider: 'openai',
        model: 'gpt-4o',
        usage: error.response?.data?.usage || null,
        status: 'failed',
        responseTime,
        entityType: 'employee',
        entityId: String(employeeId),
        userId,
        errorMessage: error.message,
        requestParams: {
          extracted_role: extractedRole.free_role,
          seniority: extractedRole.seniority,
          track: extractedRole.track
        },
        metadata: {
          cv_extraction: true,
          error_stack: error.stack
        }
      });

      return null;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Build OpenAI prompt for role matching
   * @private
   */
  static _buildMatchingPrompt(extractedRole, candidateSubRoles) {
    return `You are a job role matching expert.

EXTRACTED ROLE from CV:
- Role Name: "${extractedRole.free_role}"
- Seniority: "${extractedRole.seniority || 'Unknown'}"
- Track: "${extractedRole.track || 'Unknown'}"
- Grade: "${extractedRole.grade || 'Unknown'}"

AVAILABLE SUB-ROLES in database (${candidateSubRoles.length} candidates):
${candidateSubRoles.map((sr, idx) => {
  const parentRole = sr.role_sub_role[0]?.roles?.Role || 'N/A';
  return `${idx + 1}. ID: ${sr.id}, Name: "${sr.Sub_Role}", Parent Role: "${parentRole}"`;
}).join('\n')}

TASK:
Find the SINGLE BEST matching sub-role ID for this extracted role.

MATCHING CRITERIA (in order of importance):
1. **Job title similarity** (most important)
   - Consider synonyms and variations (e.g., "Dev" = "Developer", "Jr" = "Junior")
2. **Seniority level alignment**
   - Junior/Mid/Senior must match
3. **Technical track/area match**
   - Frontend/Backend/Fullstack/DevOps/Mobile/Data

RESPONSE FORMAT (JSON only, no explanation):
{
  "sub_role_id": <number>,
  "confidence": <0-100>,
  "reasoning": "<brief 1-sentence explanation>"
}

IMPORTANT:
- confidence must be 0-100 (integer)
- sub_role_id must be from the list above
- reasoning must be concise (max 100 chars)`;
  }
}

module.exports = LLMRoleMatchingService;
