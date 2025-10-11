const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const AIGenerationService = require('../services/AIGenerationService');
// Use the new unified prompt system from services/prompts
const { getAssessmentPrompt, getAssessmentConfig, getAssessmentTypes } = require('../services/prompts/assessmentPrompts');

/**
 * Assessment AI Controller
 * Gestisce tutte le operazioni AI per gli assessment
 * @module assessmentAIController
 */

class AssessmentAIController {
  /**
   * Genera domande assessment usando AI
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async generateQuestionsWithAI(req, res) {
    // FORCE LOG TO FILE FOR DEBUGGING
    const fs = require('fs');
    fs.appendFileSync('/tmp/moobee_debug.log', `\n[${new Date().toISOString()}] generateQuestionsWithAI CALLED\n`);

    try {
      // Extract audit context from authenticated request
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.id;  // tenant_users.id

      fs.appendFileSync('/tmp/moobee_debug.log', `  tenantId: ${tenantId}\n  userId: ${userId}\n`);

      if (!tenantId) {
        console.warn('[Assessment AI] ⚠️ No tenantId found in request - LLM audit logging will be skipped');
        fs.appendFileSync('/tmp/moobee_debug.log', `  WARNING: No tenantId found!\n`);
      }

      let {
        type,
        count = 10,
        language = 'it',
        difficulty = 'medium',
        category,
        context,
        suggestedRoles,
        description,
        name,
        // NEW: Job Family parameters
        job_family_id,
        selected_soft_skill_ids,
        // AI configuration parameters
        provider,
        model,
        temperature,
        maxTokens,
        customization // Changed from customPrompt to customization
      } = req.body;

      if (!type) {
        return res.status(400).json({
          error: 'Assessment type is required'
        });
      }

      // NEW: Validate job family parameters
      if (job_family_id) {
        if (!selected_soft_skill_ids || !Array.isArray(selected_soft_skill_ids) || selected_soft_skill_ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'selected_soft_skill_ids array is required when using job_family_id'
          });
        }
      }

      // Normalize type: convert big_five to big-five for compatibility
      if (type === 'big_five') {
        type = 'big-five';
      }

      console.log('Generating questions for assessment:', {
        type,
        name,
        count,
        rolesCount: suggestedRoles ? suggestedRoles.length : 0,
        jobFamilyId: job_family_id || null,
        selectedSoftSkillsCount: selected_soft_skill_ids ? selected_soft_skill_ids.length : 0,
        language,
        provider: provider || 'default',
        model: model || 'default',
        hasCustomization: !!customization
      });

      // NEW: Load job family soft skills if job_family_id provided
      let jobFamilyContext = null;
      if (job_family_id && selected_soft_skill_ids) {
        const jobFamilyData = await prisma.job_family_soft_skills.findMany({
          where: {
            job_family_id: parseInt(job_family_id),
            soft_skill_id: { in: selected_soft_skill_ids.map(id => parseInt(id)) }
          },
          include: {
            job_family: {
              select: {
                id: true,
                name: true,
                description: true
              }
            },
            soft_skills: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                description: true,
                category: true
              }
            }
          },
          orderBy: { priority: 'asc' }
        });

        if (jobFamilyData.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No soft skills found for the selected job family and skill IDs'
          });
        }

        const jobFamily = jobFamilyData[0].job_family;

        // Build soft skills text for AI prompt
        const softSkillsText = jobFamilyData.map((mapping, idx) => {
          const required = mapping.is_required ? 'obbligatoria' : 'opzionale';
          return `${idx + 1}. ${mapping.soft_skills.name} (${required}, weight: ${mapping.weight}, target: ${mapping.target_score}/5)
   - Descrizione: ${mapping.description || mapping.soft_skills.description}
   - Score minimo: ${mapping.min_score}/5
   - Priorità: ${mapping.priority}`;
        }).join('\n\n');

        // Build job family context for AI
        jobFamilyContext = `Job Family: "${jobFamily.name}"
Descrizione: ${jobFamily.description || 'N/A'}

Soft Skills da valutare (selezionate dall'utente, in ordine di priorità):
${softSkillsText}

IMPORTANTE:
- Distribuisci le ${count} domande proporzionalmente ai weights delle soft skills
- Copri TUTTE le soft skills selezionate
- NON includere domande per soft skills non elencate sopra
- Ogni domanda deve mappare chiaramente a una soft skill specifica`;

        // Use job family context as customization if not already provided
        if (!customization) {
          customization = jobFamilyContext;
        } else {
          customization = jobFamilyContext + '\n\n' + customization;
        }

        console.log('✅ Job family context built:', {
          jobFamilyName: jobFamily.name,
          softSkillsCount: jobFamilyData.length,
          contextLength: jobFamilyContext.length
        });
      }

      // Build audit context for LLM logging
      const auditContext = tenantId ? {
        tenantId,
        operationType: 'assessment_generation',
        userId,
        entityType: 'assessment',
        entityId: name || type,
        metadata: {
          assessment_type: type,
          language,
          question_count: count,
          has_job_family: !!job_family_id,
          has_customization: !!customization,
          provider: provider || 'default',
          model: model || 'default'
        }
      } : null;

      // Check if custom configuration is provided
      let questions;
      if (provider && model) {
        // Use custom AI configuration
        questions = await AIGenerationService.generateWithCustomConfig(
          type,
          {
            count,
            language,
            difficulty,
            category,
            context: context || description,
            suggestedRoles,
            description,
            provider,
            model,
            temperature: temperature || 0.7,
            maxTokens: maxTokens || 4000,
            customization,
            auditContext  // Pass audit context for LLM logging
          }
        );
      } else {
        // Use default generation
        questions = await AIGenerationService.generateAssessmentQuestions(
          type,
          {
            count,
            language,
            difficulty,
            category,
            context: context || description,
            suggestedRoles,
            description,
            auditContext  // Pass audit context for LLM logging
          }
        );
      }

      // Check if questions are mock or fallback
      const isMockGeneration = questions.some(q => q.isMock === true);
      const isFallbackGeneration = questions.some(q => q.isFallback === true);

      if (isMockGeneration || isFallbackGeneration) {
        console.warn(`⚠️ WARNING: Returning ${isMockGeneration ? 'MOCK' : 'FALLBACK'} questions - AI not available`);
      }

      // Build the prompt that was/will be used
      const assessmentPrompt = getAssessmentPrompt(
        type,
        customization || description || '',
        count,
        req.body.roleSoftSkills || null,
        language  // Pass the language parameter to the prompt
      );

      // Get AI configuration used (either custom or default)
      const aiConfig = {
        provider: provider || 'openai',
        model: model || 'gpt-4-turbo',
        temperature: temperature !== undefined ? temperature : 0.7,
        maxTokens: maxTokens || 4000,
        language: language || 'it',
        prompt: assessmentPrompt // Always include the prompt that was used
      };

      // If custom config was used, use those values
      if (provider && model) {
        aiConfig.provider = provider;
        aiConfig.model = model;
        if (temperature !== undefined) aiConfig.temperature = temperature;
        if (maxTokens) aiConfig.maxTokens = maxTokens;
      }

      res.status(200).json({
        success: true,
        data: {
          questions,
          metadata: {
            type,
            count: questions.length,
            language,
            generatedAt: new Date().toISOString(),
            isMock: isMockGeneration,
            isFallback: isFallbackGeneration,
            warning: (isMockGeneration || isFallbackGeneration)
              ? 'Domande generate localmente - AI non disponibile'
              : null
          },
          aiConfig // Always return the AI configuration used
        }
      });
    } catch (error) {
      console.error('Error generating questions with AI:', error);
      res.status(500).json({
        error: 'Failed to generate questions',
        details: error.message
      });
    }
  }

  /**
   * Valuta risposte assessment con AI
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async evaluateResponsesWithAI(req, res) {
    try {
      const { responses, type, templateId } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.id;

      if (!responses || !type) {
        return res.status(400).json({
          error: 'Responses and type are required'
        });
      }

      // Build audit context for LLM logging
      const auditContext = tenantId ? {
        tenantId,
        operationType: 'assessment_evaluation',
        userId,
        entityType: 'assessment_template',
        entityId: templateId ? String(templateId) : null,
        metadata: {
          assessment_type: type,
          response_count: responses?.length || 0
        }
      } : null;

      const evaluation = await AIGenerationService.evaluateResponses(
        responses,
        type,
        auditContext
      );

      // Salva valutazione nel database se richiesto
      if (templateId) {
        await prisma.assessmentTemplate.update({
          where: { id: templateId },
          data: {
            usageCount: {
              increment: 1
            }
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          evaluation,
          type,
          evaluatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error evaluating responses with AI:', error);
      res.status(500).json({
        error: 'Failed to evaluate responses',
        details: error.message
      });
    }
  }

  /**
   * Genera report personalizzato con AI
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async generateReportWithAI(req, res) {
    try {
      const {
        assessmentId,
        type,
        responses,
        scores,
        employeeId
      } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.id;

      if (!type || !responses) {
        return res.status(400).json({
          error: 'Type and responses are required'
        });
      }

      // Ottieni dati employee se disponibile
      let employee = null;
      if (employeeId) {
        employee = await prisma.employees.findUnique({
          where: { id: parseInt(employeeId) },
          select: {
            first_name: true,
            last_name: true,
            email: true,
            job_title: true
          }
        });
      }

      // Build audit context for LLM logging
      const auditContext = tenantId ? {
        tenantId,
        operationType: 'assessment_report_generation',
        userId,
        entityType: 'assessment',
        entityId: assessmentId ? String(assessmentId) : null,
        metadata: {
          assessment_type: type,
          employee_id: employeeId ? String(employeeId) : null,
          has_scores: !!scores
        }
      } : null;

      const report = await AIGenerationService.generateReport({
        type,
        responses,
        scores,
        employee: employee ? {
          name: `${employee.first_name} ${employee.last_name}`,
          email: employee.email,
          role: employee.job_title
        } : null,
        auditContext
      });

      res.status(200).json({
        success: true,
        data: {
          report,
          format: 'markdown',
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating report with AI:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        details: error.message
      });
    }
  }

  /**
   * Ottiene suggerimenti per migliorare domande
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getImprovementSuggestions(req, res) {
    try {
      const { questions } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.id;

      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({
          error: 'Questions array is required'
        });
      }

      // Build audit context for LLM logging
      const auditContext = tenantId ? {
        tenantId,
        operationType: 'assessment_improvement_suggestions',
        userId,
        entityType: 'assessment_questions',
        entityId: null,
        metadata: {
          question_count: questions?.length || 0
        }
      } : null;

      const suggestions = await AIGenerationService.improveSuggestions(
        questions,
        auditContext
      );

      res.status(200).json({
        success: true,
        data: {
          suggestions,
          questionCount: questions.length,
          suggestedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting improvement suggestions:', error);
      res.status(500).json({
        error: 'Failed to get suggestions',
        details: error.message
      });
    }
  }

  /**
   * Ottiene i provider AI disponibili e i loro modelli
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getAIProviders(req, res) {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const providers = await AIGenerationService.getAvailableProviders(forceRefresh);

      res.json({
        success: true,
        data: providers,
        metadata: {
          cached: !forceRefresh && AIGenerationService.modelsCache !== null,
          cacheExpiry: AIGenerationService.cacheExpiry,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching AI providers:', error);
      res.status(500).json({
        error: 'Failed to fetch AI providers',
        message: error.message
      });
    }
  }

  /**
   * Ottiene dettagli per un modello specifico
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getModelDetails(req, res) {
    try {
      const { provider, modelId } = req.params;
      const details = await AIGenerationService.getModelInfo(provider, modelId);

      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      console.error('Error fetching model details:', error);
      res.status(500).json({
        error: 'Failed to fetch model details',
        message: error.message
      });
    }
  }

  /**
   * Rigenera domande per un template esistente
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async regenerateQuestions(req, res) {
    try {
      const { id } = req.params;
      const { useStoredPrompt = true, customPrompt } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.id;

      const template = await prisma.assessmentTemplate.findUnique({
        where: { id },
        include: { questions: true }
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const config = {
        type: template.type,
        name: template.name,
        description: template.description,
        suggestedRoles: template.suggestedRoles,
        count: AIGenerationService.getQuestionCountByType(template.type),
        language: template.aiLanguage || 'it'
      };

      // Build audit context for LLM logging
      const auditContext = tenantId ? {
        tenantId,
        operationType: 'assessment_regeneration',
        userId,
        entityType: 'assessment_template',
        entityId: id,
        metadata: {
          assessment_type: template.type,
          use_stored_prompt: useStoredPrompt,
          provider: template.aiProvider,
          model: template.aiModel
        }
      } : null;

      const questions = await AIGenerationService.generateWithCustomConfig({
        prompt: useStoredPrompt ? template.aiPrompt : customPrompt,
        config,
        provider: template.aiProvider,
        model: template.aiModel,
        temperature: template.aiTemperature,
        maxTokens: template.aiMaxTokens,
        auditContext
      });

      // Transaction per aggiornare domande
      await prisma.$transaction(async (tx) => {
        // Elimina vecchie domande
        await tx.assessmentQuestion.deleteMany({
          where: { templateId: id }
        });

        // Crea nuove domande
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const { isMock, isFallback, metadata, ...questionData } = q;

          const question = await tx.assessmentQuestion.create({
            data: {
              templateId: id,
              text: questionData.text,
              type: questionData.type || 'multiple_choice',
              orderIndex: i + 1,
              category: questionData.category,
              isRequired: true,
              metadata: metadata || {}
            }
          });

          if (q.options && q.options.length > 0) {
            await tx.assessmentOption.createMany({
              data: q.options.map((opt, index) => ({
                questionId: question.id,
                text: opt.text,
                value: opt.value,
                orderIndex: index + 1
              }))
            });
          }
        }

        // Aggiorna info generazione template
        await tx.assessmentTemplate.update({
          where: { id },
          data: {
            lastAiGeneration: new Date(),
            aiGenerationCount: { increment: 1 },
            generationMetadata: {
              regeneratedAt: new Date().toISOString(),
              questionCount: questions.length,
              provider: template.aiProvider,
              model: template.aiModel
            }
          }
        });
      });

      const updatedTemplate = await prisma.assessmentTemplate.findUnique({
        where: { id },
        include: { questions: { include: { options: true } } }
      });

      res.json({
        success: true,
        data: updatedTemplate
      });
    } catch (error) {
      console.error('Error regenerating questions:', error);
      res.status(500).json({
        error: 'Failed to regenerate questions',
        message: error.message
      });
    }
  }

  /**
   * Genera prompt AI personalizzato per assessment
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async generateCustomPrompt(req, res) {
    try {
      const {
        type,
        action,
        parameters
      } = req.body;

      if (!type || !action) {
        return res.status(400).json({
          error: 'Type and action are required'
        });
      }

      const prompt = getPrompt(type, action, parameters);

      res.status(200).json({
        success: true,
        data: {
          prompt,
          type,
          action,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating custom prompt:', error);
      res.status(500).json({
        error: 'Failed to generate prompt',
        details: error.message
      });
    }
  }

  /**
   * Test connessione AI providers
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async testAIConnection(req, res) {
    try {
      const testPrompt = 'Generate one assessment question about teamwork.';

      const result = await AIGenerationService.generateCompletion(
        testPrompt,
        {
          maxTokens: 100,
          temperature: 0.7
        }
      );

      res.status(200).json({
        success: true,
        data: {
          status: 'AI service is operational',
          testResult: result ? 'Success' : 'Failed',
          providers: {
            openai: AIGenerationService.openai ? 'Available' : 'Not configured',
            anthropic: AIGenerationService.anthropic ? 'Available' : 'Not configured'
          },
          testedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error testing AI connection:', error);
      res.status(500).json({
        error: 'AI service test failed',
        details: error.message
      });
    }
  }

  /**
   * Genera assessment completo con AI
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async generateCompleteAssessment(req, res) {
    try {
      const {
        name,
        type,
        questionCount = 20,
        language = 'it',
        targetRoles,
        competencies
      } = req.body;
      const tenantId = req.user?.tenantId || req.user?.tenant_id;
      const userId = req.user?.id;

      if (!name || !type) {
        return res.status(400).json({
          error: 'Name and type are required'
        });
      }

      // Build audit context for LLM logging
      const auditContext = tenantId ? {
        tenantId,
        operationType: 'assessment_complete_generation',
        userId,
        entityType: 'assessment_template',
        entityId: name,
        metadata: {
          assessment_type: type,
          question_count: questionCount,
          target_roles: targetRoles,
          competencies
        }
      } : null;

      // Genera domande
      const questions = await AIGenerationService.generateAssessmentQuestions(
        type,
        {
          count: questionCount,
          language,
          context: targetRoles ? `Target roles: ${targetRoles.join(', ')}` : null,
          category: competencies ? competencies[0] : null,
          auditContext
        }
      );

      // Crea template nel database
      const template = await prisma.assessmentTemplate.create({
        data: {
          name,
          type,
          description: `AI-generated ${type} assessment`,
          instructions: `Complete all ${questionCount} questions honestly`,
          suggestedRoles: targetRoles || [],
          suggestedFrequency: 'quarterly',
          aiModel: 'gpt-5/claude-3',
          isActive: true,
          isPublic: false,
          version: 1,
          usageCount: 0,
          questions: {
            create: questions.map((q, index) => ({
              text: q.text,
              category: q.category || type,
              type: q.type || 'multiple_choice',
              orderIndex: index + 1,
              isRequired: true,
              options: {
                create: q.options.map((opt, optIndex) => ({
                  text: opt.text,
                  value: opt.value || optIndex + 1,
                  orderIndex: optIndex + 1,
                  isCorrect: opt.isCorrect || false
                }))
              }
            }))
          }
        },
        include: {
          questions: {
            include: {
              options: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: {
          template,
          questionsGenerated: questions.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating complete assessment:', error);
      res.status(500).json({
        error: 'Failed to generate complete assessment',
        details: error.message
      });
    }
  }
  /**
   * Get the prompt template for an assessment type
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getPromptTemplate(req, res) {
    try {
      let { type, customization = '' } = req.query;

      if (!type) {
        return res.status(400).json({
          success: false,
          message: 'Assessment type is required'
        });
      }

      // Normalize type: convert big_five to big-five for compatibility
      if (type === 'big_five') {
        type = 'big-five';
      }

      // Using functions already imported from services/prompts/assessmentPrompts

      const config = getAssessmentConfig(type);
      if (!config) {
        return res.status(404).json({
          success: false,
          message: `Unknown assessment type: ${type}`
        });
      }

      // Get the prompt with customization
      const prompt = getAssessmentPrompt(type, customization, config.defaultCount);

      res.json({
        success: true,
        data: {
          type,
          name: config.name,
          prompt,
          categories: config.categories,
          defaultCount: config.defaultCount,
          minCount: config.minCount,
          maxCount: config.maxCount,
          hasCustomization: !!customization,
          isEditable: false // User cannot edit the prompt
        }
      });
    } catch (error) {
      console.error('Error getting prompt template:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting prompt template',
        error: error.message
      });
    }
  }

  /**
   * Get all available assessment types
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getAssessmentTypes(req, res) {
    try {
      // Using function already imported from services/prompts/assessmentPrompts

      const types = getAssessmentTypes();

      res.json({
        success: true,
        data: types
      });
    } catch (error) {
      console.error('Error getting assessment types:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting assessment types',
        error: error.message
      });
    }
  }
}

module.exports = new AssessmentAIController();