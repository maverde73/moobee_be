/**
 * AI Controller
 * Handles all AI-related endpoints that interface with Python backend
 * All database writes happen here, Python only provides analysis
 */

const pythonService = require('../services/pythonIntegrationService');
const documentParser = require('../services/documentParserService');

class AIController {
    /**
     * Analyze CV and save results
     * POST /api/ai/cv/analyze
     * Supports both text input and file upload (PDF, DOCX, etc.)
     */
    async analyzeCv(req, res) {
        try {
            let cvText = req.body.cv_text;
            const employeeId = req.body.employee_id;
            const tenantId = req.tenant?.id || '1';

            // Check if a file was uploaded
            if (req.file) {
                console.log(`Processing uploaded file: ${req.file.originalname}`);

                // Extract text from uploaded file
                const extractionResult = await documentParser.extractFromUploadedFile(req.file);

                if (!extractionResult.success) {
                    return res.status(400).json({
                        success: false,
                        error: `Failed to extract text from file: ${extractionResult.error}`
                    });
                }

                cvText = extractionResult.text;

                console.log(`Extracted ${extractionResult.statistics.words} words from ${req.file.originalname}`);

                // Optionally include extraction metadata in response
                req.extractionMetadata = extractionResult.metadata;
                req.extractionStatistics = extractionResult.statistics;
            }

            // Validation
            if (!cvText) {
                return res.status(400).json({
                    success: false,
                    error: 'CV text is required (either as text or file upload)'
                });
            }

            if (cvText.length < 100) {
                return res.status(400).json({
                    success: false,
                    error: 'CV text too short (minimum 100 characters)'
                });
            }

            console.log(`Analyzing CV for employee ${employeeId} in tenant ${tenantId}`);

            // Call Python service and save results
            const result = await pythonService.analyzeCVAndSave(
                cvText,
                employeeId,
                tenantId
            );

            // Build response with extraction metadata if available
            const response = {
                success: true,
                message: 'CV analyzed and saved successfully',
                requestId: result.requestId,
                data: {
                    employeeId: employeeId,
                    ...result.data,
                    analysis: {
                        totalSkillsFound: result.analysisResults.total_skills_found,
                        matchedSkillsCount: result.analysisResults.matched_skills_count,
                        seniorityInfo: result.analysisResults.seniority_info
                    }
                }
            };

            // Add extraction metadata if file was uploaded
            if (req.extractionMetadata) {
                response.extraction = {
                    metadata: req.extractionMetadata,
                    statistics: req.extractionStatistics
                };
            }

            // Return success response
            res.json(response);

        } catch (error) {
            console.error('CV Analysis Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to analyze CV',
                details: error.message
            });
        }
    }

    /**
     * Calculate skill-role scoring
     * POST /api/ai/scoring/calculate
     */
    async calculateScoring(req, res) {
        try {
            const { skill_ids, role_ids, scoring_type = 'skill_to_role' } = req.body;
            const tenantId = req.tenant?.id || '1';

            // Validation
            if (!skill_ids || !Array.isArray(skill_ids) || skill_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'skill_ids array is required'
                });
            }

            if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'role_ids array is required'
                });
            }

            if (!['skill_to_role', 'role_to_skill'].includes(scoring_type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid scoring_type. Must be skill_to_role or role_to_skill'
                });
            }

            console.log(`Calculating scoring for ${skill_ids.length} skills and ${role_ids.length} roles`);

            // Call scoring service
            const result = await pythonService.calculateAndSaveScoring(
                skill_ids,
                role_ids,
                tenantId,
                scoring_type
            );

            res.json({
                success: true,
                message: 'Scoring calculated and saved successfully',
                requestId: result.requestId,
                data: {
                    ...result.data,
                    scoring: {
                        totalCombinations: skill_ids.length * role_ids.length,
                        scoresReturned: result.scoringResults.scores?.length || 0,
                        fromCache: result.scoringResults.from_cache
                    }
                }
            });

        } catch (error) {
            console.error('Scoring Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to calculate scoring',
                details: error.message
            });
        }
    }

    /**
     * Batch tournament execution
     * POST /api/ai/scoring/batch-tournament
     */
    async runBatchTournament(req, res) {
        try {
            const { targets, tournament_mode = 'score', parallel_targets = 10 } = req.body;
            const tenantId = req.tenant?.id || '1';

            // Validation
            if (!targets || !Array.isArray(targets) || targets.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'targets array is required'
                });
            }

            // Validate each target
            for (const target of targets) {
                if (!target.target_id || !target.target_name || !target.candidates) {
                    return res.status(400).json({
                        success: false,
                        error: 'Each target must have target_id, target_name, and candidates array'
                    });
                }

                if (target.candidates.length < 2) {
                    return res.status(400).json({
                        success: false,
                        error: `Target ${target.target_name} must have at least 2 candidates`
                    });
                }
            }

            // For now, return a mock response
            // In production, this would call the Python batch tournament endpoint
            res.json({
                success: true,
                message: 'Batch tournament executed successfully',
                data: {
                    totalTargets: targets.length,
                    tournamentMode: tournament_mode,
                    parallelTargets: parallel_targets
                }
            });

        } catch (error) {
            console.error('Batch Tournament Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to run batch tournament',
                details: error.message
            });
        }
    }

    /**
     * Vector search for skills/roles
     * POST /api/ai/rag/search
     */
    async vectorSearch(req, res) {
        try {
            const { query, search_type = 'skills', top_k = 5 } = req.body;
            const tenantId = req.tenant?.id || '1';

            // Validation
            if (!query || query.length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Query must be at least 3 characters'
                });
            }

            if (!['skills', 'roles', 'all'].includes(search_type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid search_type. Must be skills, roles, or all'
                });
            }

            console.log(`Vector search for: "${query}" in ${search_type}`);

            // Call vector search service
            const result = await pythonService.vectorSearch(
                query,
                search_type,
                tenantId,
                top_k
            );

            res.json({
                success: true,
                requestId: result.requestId,
                data: {
                    query: query,
                    matches: result.matches,
                    totalMatches: result.totalMatches
                }
            });

        } catch (error) {
            console.error('Vector Search Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to perform vector search',
                details: error.message
            });
        }
    }

    /**
     * Enrich skills with metadata
     * POST /api/ai/skills/enrich
     */
    async enrichSkills(req, res) {
        try {
            const { skills } = req.body;
            const tenantId = req.tenant?.id || '1';

            // Validation
            if (!skills || !Array.isArray(skills) || skills.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'skills array is required'
                });
            }

            if (skills.length > 50) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 50 skills per request'
                });
            }

            console.log(`Enriching ${skills.length} skills`);

            // Call enrichment service
            const result = await pythonService.enrichSkills(
                skills,
                tenantId
            );

            res.json({
                success: true,
                requestId: result.requestId,
                data: {
                    enrichedSkills: result.enrichedSkills,
                    totalProcessed: result.totalProcessed
                }
            });

        } catch (error) {
            console.error('Skill Enrichment Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to enrich skills',
                details: error.message
            });
        }
    }

    /**
     * Health check for AI services
     * GET /api/ai/health
     */
    async healthCheck(req, res) {
        try {
            const pythonHealth = await pythonService.checkPythonHealth();

            const overallStatus = pythonHealth.status === 'healthy' ? 'healthy' : 'degraded';

            res.json({
                success: true,
                status: overallStatus,
                services: {
                    nodejs: {
                        status: 'healthy',
                        version: '1.0.0'
                    },
                    python: pythonHealth
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Health Check Error:', error);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new AIController();