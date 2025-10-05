/**
 * Python Integration Service
 * Handles all communication between Node.js and Python FastAPI backend
 * IMPORTANT: BE_nodejs is the ONLY service that writes to the database
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

class PythonIntegrationService {
    constructor() {
        this.baseURL = process.env.PYTHON_API_URL || 'http://localhost:8001/api';
        this.timeout = parseInt(process.env.PYTHON_API_TIMEOUT) || 300000; // 5 minutes for CV analysis
        this.token = process.env.PYTHON_API_TOKEN || 'secret-shared-token-moobee-2025';
        this.maxRetries = 3;
        this.retryDelay = 1000; // Start with 1 second

        // Initialize Prisma client
        this.prisma = new PrismaClient();
    }

    /**
     * Base method for calling Python API with retry logic
     * @private
     */
    async callPythonAPI(endpoint, data, retryCount = 0) {
        const requestId = uuidv4();
        const tenantId = data.tenant_id || 'default';

        console.log(`[${requestId}] Calling Python API: ${endpoint}`);

        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseURL}${endpoint}`,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'X-Request-ID': requestId,
                    'X-Tenant-ID': tenantId
                },
                timeout: this.timeout
            });

            console.log(`[${requestId}] Python API success`);

            return {
                success: true,
                data: response.data,
                requestId: requestId
            };

        } catch (error) {
            // Handle specific error types
            if (error.response) {
                // Server responded with error
                console.error(`[${requestId}] Python API error: ${error.response.status} - ${error.response.data?.error}`);

                if (error.response.status === 503 && retryCount < this.maxRetries) {
                    // Service unavailable - retry
                    await this.sleep(this.retryDelay * Math.pow(2, retryCount));
                    return this.callPythonAPI(endpoint, data, retryCount + 1);
                }

                return {
                    success: false,
                    error: error.response.data?.error || error.message,
                    statusCode: error.response.status,
                    requestId: requestId
                };

            } else if (error.request) {
                // No response received
                console.error(`[${requestId}] Python API no response: ${error.message}`);

                if (retryCount < this.maxRetries) {
                    await this.sleep(this.retryDelay * Math.pow(2, retryCount));
                    return this.callPythonAPI(endpoint, data, retryCount + 1);
                }

                return {
                    success: false,
                    error: 'Python service unavailable',
                    requestId: requestId
                };

            } else {
                // Request setup error
                console.error(`[${requestId}] Request error: ${error.message}`);
                return {
                    success: false,
                    error: error.message,
                    requestId: requestId
                };
            }
        }
    }

    /**
     * Sleep helper for retry delays
     * @private
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Analyze CV text ONLY - returns results without saving to database
     * Used for testing and local extraction
     */
    async analyzeCVText(cvText, employeeId, tenantId) {
        try {
            // Call Python API for analysis ONLY
            const pythonResult = await this.callPythonAPI('/cv/analyze', {
                cv_text: cvText,
                employee_id: employeeId,
                tenant_id: tenantId || '1',
                language: 'it',
                extract_seniority: true,
                extract_skills: true,
                extract_roles: true
            });

            if (!pythonResult.success) {
                throw new Error(`CV Analysis failed: ${pythonResult.error}`);
            }

            return {
                success: true,
                requestId: pythonResult.requestId,
                analysisResults: pythonResult.data
            };

        } catch (error) {
            console.error('analyzeCVText error:', error);
            throw error;
        }
    }

    /**
     * Analyze CV and save results to database
     * This is the main integration point for CV analysis
     */
    async analyzeCVAndSave(cvText, employeeId, tenantId) {
        try {
            // Step 1: Call Python API for analysis
            const pythonResult = await this.callPythonAPI('/cv/analyze', {
                cv_text: cvText,
                employee_id: employeeId,
                tenant_id: tenantId,
                language: 'it',
                extract_seniority: true,
                extract_skills: true
            });

            if (!pythonResult.success) {
                throw new Error(`CV Analysis failed: ${pythonResult.error}`);
            }

            // Step 2: Save results to database (ONLY Node.js writes!)
            const savedData = await this.saveAnalysisResults(
                pythonResult.data,
                employeeId,
                tenantId
            );

            return {
                success: true,
                requestId: pythonResult.requestId,
                data: savedData,
                analysisResults: pythonResult.data
            };

        } catch (error) {
            console.error('analyzeCVAndSave error:', error);
            throw error;
        }
    }

    /**
     * Save CV analysis results to database
     * @private
     */
    async saveAnalysisResults(analysisData, employeeId, tenantId) {
        try {
            // Use transaction for data consistency
            const result = await this.prisma.$transaction(async (tx) => {
                const savedData = {
                    employeeUpdated: false,
                    skillsSaved: 0,
                    rolesSaved: 0
                };

                // 1. Update employee with seniority info if provided
                if (employeeId && analysisData.seniority_info) {
                    const seniority = analysisData.seniority_info;

                    await tx.employees.update({
                        where: { id: employeeId },
                        data: {
                            // Map seniority data to employee fields
                            // Adjust field names based on actual schema
                            competenze_trasversali: analysisData.skills
                                ?.filter(s => s.skill_type === 'Soft Skill')
                                ?.map(s => s.skill_name) || [],
                            // Add other fields as needed
                        }
                    });

                    savedData.employeeUpdated = true;

                    // Save role information if exists
                    if (seniority.role) {
                        // Check if role exists in roles table
                        const role = await tx.roles.findFirst({
                            where: {
                                OR: [
                                    { Role: seniority.role },
                                    { NameKnown_Role: seniority.role }
                                ]
                            }
                        });

                        if (role) {
                            // Save employee role
                            await tx.employee_roles.create({
                                data: {
                                    employee_id: employeeId,
                                    role_id: role.id,
                                    anni_esperienza: Math.round(seniority.years_experience)
                                    // Removed: is_current (Migration 014), competenze_tecniche_trasversali (Migration 013)
                                }
                            });
                            savedData.rolesSaved++;
                        }
                    }
                }

                // 2. Save extracted skills
                if (analysisData.skills && analysisData.skills.length > 0) {
                    for (const skill of analysisData.skills) {
                        // Only save skills that were matched in database
                        if (skill.matched_in_db && skill.skill_id) {
                            // Check if skill-employee relation exists
                            const existing = await tx.employee_skills.findFirst({
                                where: {
                                    employee_id: employeeId,
                                    skill_id: skill.skill_id
                                }
                            });

                            if (!existing) {
                                await tx.employee_skills.create({
                                    data: {
                                        employee_id: employeeId,
                                        skill_id: skill.skill_id,
                                        confidence_score: skill.confidence,
                                        source: 'cv_extraction',
                                        extracted_at: new Date()
                                    }
                                });
                                savedData.skillsSaved++;
                            }
                        }
                    }
                }

                // 3. Create audit log
                await tx.audit_logs.create({
                    data: {
                        tenant_id: parseInt(tenantId) || 1,
                        user_id: null, // Would be set from auth context
                        action: 'cv_analysis_completed',
                        entity_type: 'employee',
                        entity_id: employeeId,
                        details: JSON.stringify({
                            request_id: analysisData.request_id,
                            skills_found: analysisData.total_skills_found,
                            skills_matched: analysisData.matched_skills_count,
                            processing_time_ms: analysisData.processing_time_ms
                        }),
                        created_at: new Date()
                    }
                });

                return savedData;
            });

            console.log('Analysis results saved:', result);
            return result;

        } catch (error) {
            console.error('Error saving analysis results:', error);
            throw error;
        }
    }

    /**
     * Calculate scoring between skills and roles
     */
    async calculateAndSaveScoring(skillIds, roleIds, tenantId, scoringType = 'skill_to_role') {
        try {
            // Call Python API for scoring
            const scoringResult = await this.callPythonAPI('/scoring/calculate', {
                skill_ids: skillIds,
                role_ids: roleIds,
                tenant_id: tenantId,
                scoring_type: scoringType,
                use_cache: true
            });

            if (!scoringResult.success) {
                throw new Error(`Scoring failed: ${scoringResult.error}`);
            }

            // Save scores to database
            const savedScores = await this.saveScoringResults(
                scoringResult.data,
                tenantId
            );

            return {
                success: true,
                requestId: scoringResult.requestId,
                data: savedScores,
                scoringResults: scoringResult.data
            };

        } catch (error) {
            console.error('calculateAndSaveScoring error:', error);
            throw error;
        }
    }

    /**
     * Save scoring results to database
     * @private
     */
    async saveScoringResults(scoringData, tenantId) {
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                let savedCount = 0;

                for (const score of scoringData.scores || []) {
                    // Check if this is updating roles or skills table
                    if (score.score_type === 'value') {
                        // Update skill to role mapping
                        await tx.extended_tech_skills_roles_descriptions_full.updateMany({
                            where: {
                                id_skill: score.skill_id,
                                id_role: score.role_id
                            },
                            data: {
                                Value: score.score
                            }
                        });
                        savedCount++;
                    } else if (score.score_type === 'grading') {
                        // Update role to skill grading
                        await tx.extended_tech_skills_roles_descriptions_full.updateMany({
                            where: {
                                id_skill: score.skill_id,
                                id_role: score.role_id
                            },
                            data: {
                                Grading: score.score
                            }
                        });
                        savedCount++;
                    }
                }

                // Log the scoring operation
                await tx.audit_logs.create({
                    data: {
                        tenant_id: parseInt(tenantId) || 1,
                        action: 'scoring_calculated',
                        entity_type: 'scoring',
                        details: JSON.stringify({
                            request_id: scoringData.request_id,
                            total_scores: scoringData.scores?.length || 0,
                            from_cache: scoringData.from_cache,
                            processing_time_ms: scoringData.processing_time_ms
                        }),
                        created_at: new Date()
                    }
                });

                return { savedCount };
            });

            console.log('Scoring results saved:', result);
            return result;

        } catch (error) {
            console.error('Error saving scoring results:', error);
            throw error;
        }
    }

    /**
     * Perform vector search for skills/roles
     */
    async vectorSearch(query, searchType, tenantId, topK = 5) {
        try {
            const searchResult = await this.callPythonAPI('/rag/search', {
                query: query,
                search_type: searchType,
                tenant_id: tenantId,
                top_k: topK,
                use_hyde: true
            });

            if (!searchResult.success) {
                throw new Error(`Vector search failed: ${searchResult.error}`);
            }

            return {
                success: true,
                requestId: searchResult.requestId,
                matches: searchResult.data.matches,
                totalMatches: searchResult.data.total_matches
            };

        } catch (error) {
            console.error('vectorSearch error:', error);
            throw error;
        }
    }

    /**
     * Enrich skills with metadata
     */
    async enrichSkills(skills, tenantId) {
        try {
            const enrichResult = await this.callPythonAPI('/skills/enrich', {
                skills: skills,
                tenant_id: tenantId,
                include_synonyms: true,
                include_descriptions: true
            });

            if (!enrichResult.success) {
                throw new Error(`Skill enrichment failed: ${enrichResult.error}`);
            }

            return {
                success: true,
                requestId: enrichResult.requestId,
                enrichedSkills: enrichResult.data.enriched_skills,
                totalProcessed: enrichResult.data.total_processed
            };

        } catch (error) {
            console.error('enrichSkills error:', error);
            throw error;
        }
    }

    /**
     * Health check for Python API
     */
    async checkPythonHealth() {
        try {
            const response = await axios.get(`${this.baseURL}/health`, {
                timeout: 5000
            });

            return {
                status: response.data.status,
                service: response.data.service,
                version: response.data.version,
                database: response.data.database,
                timestamp: response.data.timestamp
            };

        } catch (error) {
            console.error('Python health check failed:', error.message);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Clean up resources
     */
    async disconnect() {
        await this.prisma.$disconnect();
    }
}

// Export singleton instance
module.exports = new PythonIntegrationService();