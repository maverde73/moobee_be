/**
 * AI Provider Management Module
 * Gestisce l'inizializzazione e comunicazione con provider AI (OpenAI, Anthropic)
 * @module services/ai/providers
 */

const axios = require('axios');
const LLMAuditService = require('../llmAuditService');

/**
 * Gestione dei provider AI
 * @class AIProviders
 */
class AIProviders {
  constructor() {
    this.openai = null;
    this.anthropic = null;
    this.modelsCache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 3600000; // 1 hour cache for models
    this.initializeProviders();
  }

  /**
   * Inizializza i provider AI disponibili
   * @private
   */
  initializeProviders() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const { OpenAI } = require('openai');
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✓ OpenAI provider initialized');
      } catch (error) {
        console.warn('⚠️ OpenAI provider not available:', error.message);
      }
    }

    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        console.log('✓ Anthropic provider initialized');
      } catch (error) {
        console.warn('⚠️ Anthropic provider not available:', error.message);
      }
    }

    if (!this.openai && !this.anthropic) {
      console.warn('⚠️ No AI providers configured - will use mock responses');
    }
  }

  /**
   * Verifica se almeno un provider è disponibile
   * @returns {boolean}
   */
  hasProviders() {
    return !!(this.openai || this.anthropic);
  }

  /**
   * Ottiene informazioni sui provider disponibili
   * @param {boolean} refresh - Forza refresh della cache
   * @returns {Promise<Object>} Provider disponibili con modelli
   */
  async getAvailableProviders(refresh = false) {
    // Check cache
    if (!refresh && this.modelsCache && this.cacheExpiry > Date.now()) {
      return this.modelsCache;
    }

    const providers = {};

    // Get OpenAI models
    if (this.openai) {
      try {
        const models = await this.fetchOpenAIModels();
        providers.openai = {
          name: 'OpenAI',
          models: models
        };
      } catch (error) {
        console.error('Error fetching OpenAI models:', error.message);
        providers.openai = this.getDefaultOpenAIModels();
      }
    }

    // Get Anthropic models
    if (this.anthropic) {
      providers.anthropic = this.getDefaultAnthropicModels();
    }

    // Update cache
    this.modelsCache = providers;
    this.cacheExpiry = Date.now() + this.cacheDuration;

    return providers;
  }

  /**
   * Recupera modelli OpenAI disponibili
   * @private
   * @returns {Promise<Array>}
   */
  async fetchOpenAIModels() {
    try {
      const response = await this.openai.models.list();
      const models = [];

      for await (const model of response) {
        // Filter for chat models
        if (model.id.includes('gpt') || model.id.includes('chat')) {
          models.push({
            id: model.id,
            name: this.formatModelName(model.id),
            maxTokens: this.getModelMaxTokens(model.id),
            created: model.created
          });
        }
      }

      // Sort models by creation date (newest first)
      models.sort((a, b) => b.created - a.created);

      return models.slice(0, 50); // Limit to 50 models
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return this.getDefaultOpenAIModels().models;
    }
  }

  /**
   * Formatta il nome del modello per visualizzazione
   * @private
   * @param {string} modelId
   * @returns {string}
   */
  formatModelName(modelId) {
    const nameMap = {
      'gpt-5': 'GPT-5 ⭐',
      'gpt-4o': 'GPT-4 Omni',
      'gpt-4o-mini': 'GPT-4 Omni Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo'
    };

    return nameMap[modelId] || modelId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Ottiene il numero massimo di token per modello
   * @private
   * @param {string} modelId
   * @returns {number}
   */
  getModelMaxTokens(modelId) {
    const tokenLimits = {
      'gpt-5': 256000,
      'gpt-5-mini': 128000,
      'gpt-5-nano': 64000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 64000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 4096
    };

    return tokenLimits[modelId] || 4096;
  }

  /**
   * Modelli OpenAI predefiniti
   * @private
   * @returns {Object}
   */
  getDefaultOpenAIModels() {
    return {
      name: 'OpenAI',
      models: [
        { id: 'gpt-5', name: 'GPT-5 ⭐', maxTokens: 256000 },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', maxTokens: 128000 },
        { id: 'gpt-4o', name: 'GPT-4 Omni', maxTokens: 128000 },
        { id: 'gpt-4o-mini', name: 'GPT-4 Omni Mini', maxTokens: 64000 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000 },
        { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096 }
      ]
    };
  }

  /**
   * Modelli Anthropic predefiniti
   * @private
   * @returns {Object}
   */
  getDefaultAnthropicModels() {
    return {
      name: 'Anthropic',
      models: [
        { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1 ⭐', maxTokens: 300000 },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', maxTokens: 250000 },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxTokens: 250000 },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', maxTokens: 200000 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxTokens: 200000 }
      ]
    };
  }

  /**
   * Genera con OpenAI
   * @param {string} prompt - User prompt
   * @param {string} systemPrompt - System prompt
   * @param {number} temperature - Temperature (0-1)
   * @param {number} maxTokens - Max tokens
   * @param {string} model - Model ID
   * @param {Object} auditContext - Context for LLM audit logging
   * @param {string} auditContext.tenantId - Tenant UUID
   * @param {string} auditContext.operationType - Operation type (e.g., 'assessment_generation')
   * @param {string} [auditContext.userId] - User ID
   * @param {string} [auditContext.entityType] - Entity type
   * @param {string} [auditContext.entityId] - Entity ID
   * @returns {Promise<string>}
   */
  async generateWithOpenAI(prompt, systemPrompt, temperature, maxTokens, model = 'gpt-5', auditContext = null) {
    if (!this.openai) {
      throw new Error('OpenAI provider not initialized');
    }

    const startTime = Date.now();

    try {
      // GPT-5 specific handling
      const isGPT5 = model.includes('gpt-5');
      const requestParams = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      };

      if (isGPT5) {
        // GPT-5 doesn't support temperature, maxTokens, or top_p
        // Only add max_completion_tokens if maxTokens is defined
        if (maxTokens !== undefined) {
          requestParams.max_completion_tokens = maxTokens;
        }
      } else {
        // For other models, add parameters only if defined
        if (maxTokens !== undefined) {
          requestParams.max_tokens = maxTokens;
        }
        if (temperature !== undefined) {
          requestParams.temperature = temperature;
        }
      }

      const completion = await this.openai.chat.completions.create(requestParams);
      const responseTime = Date.now() - startTime;
      const responseText = completion.choices[0].message.content;

      // Log usage to llm_usage_logs if audit context provided
      if (auditContext && auditContext.tenantId) {
        try {
          await LLMAuditService.logUsage({
            tenantId: auditContext.tenantId,
            operationType: auditContext.operationType || 'ai_generation',
            provider: 'openai',
            model: model,
            usage: completion.usage,
            status: 'success',
            responseTime,
            entityType: auditContext.entityType || null,
            entityId: auditContext.entityId || null,
            userId: auditContext.userId || null,
            requestParams: {
              model,
              temperature,
              maxTokens,
              systemPromptLength: systemPrompt?.length || 0,
              userPromptLength: prompt?.length || 0
            },
            responseSummary: {
              responseLength: responseText?.length || 0,
              finishReason: completion.choices[0].finish_reason
            },
            metadata: auditContext.metadata || {}
          });
        } catch (auditError) {
          console.error('[OpenAI] Failed to log LLM usage:', auditError.message);
          // Don't throw - audit logging failure shouldn't break generation
        }
      }

      return responseText;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failure if audit context provided
      if (auditContext && auditContext.tenantId) {
        try {
          await LLMAuditService.logUsage({
            tenantId: auditContext.tenantId,
            operationType: auditContext.operationType || 'ai_generation',
            provider: 'openai',
            model: model,
            usage: error.response?.data?.usage || null,
            status: 'failed',
            responseTime,
            entityType: auditContext.entityType || null,
            entityId: auditContext.entityId || null,
            userId: auditContext.userId || null,
            errorMessage: error.message,
            requestParams: {
              model,
              temperature,
              maxTokens,
              systemPromptLength: systemPrompt?.length || 0,
              userPromptLength: prompt?.length || 0
            },
            metadata: {
              ...(auditContext.metadata || {}),
              error_code: error.code,
              error_type: error.type
            }
          });
        } catch (auditError) {
          console.error('[OpenAI] Failed to log LLM error:', auditError.message);
        }
      }

      throw error;
    }
  }

  /**
   * Genera con Anthropic
   * @param {string} prompt - User prompt
   * @param {string} systemPrompt - System prompt
   * @param {number} temperature - Temperature (0-1)
   * @param {number} maxTokens - Max tokens
   * @param {string} model - Model ID
   * @param {Object} auditContext - Context for LLM audit logging
   * @param {string} auditContext.tenantId - Tenant UUID
   * @param {string} auditContext.operationType - Operation type (e.g., 'assessment_generation')
   * @param {string} [auditContext.userId] - User ID
   * @param {string} [auditContext.entityType] - Entity type
   * @param {string} [auditContext.entityId] - Entity ID
   * @returns {Promise<string>}
   */
  async generateWithAnthropic(prompt, systemPrompt, temperature, maxTokens, model = 'claude-opus-4-1-20250805', auditContext = null) {
    if (!this.anthropic) {
      throw new Error('Anthropic provider not initialized');
    }

    const startTime = Date.now();

    try {
      const message = await this.anthropic.messages.create({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const responseTime = Date.now() - startTime;
      const responseText = message.content[0].text;

      // Log usage to llm_usage_logs if audit context provided
      if (auditContext && auditContext.tenantId) {
        try {
          // Convert Anthropic usage format to standard format
          const usage = {
            prompt_tokens: message.usage?.input_tokens || 0,
            completion_tokens: message.usage?.output_tokens || 0,
            total_tokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
          };

          await LLMAuditService.logUsage({
            tenantId: auditContext.tenantId,
            operationType: auditContext.operationType || 'ai_generation',
            provider: 'anthropic',
            model: model,
            usage,
            status: 'success',
            responseTime,
            entityType: auditContext.entityType || null,
            entityId: auditContext.entityId || null,
            userId: auditContext.userId || null,
            requestParams: {
              model,
              temperature,
              maxTokens,
              systemPromptLength: systemPrompt?.length || 0,
              userPromptLength: prompt?.length || 0
            },
            responseSummary: {
              responseLength: responseText?.length || 0,
              stopReason: message.stop_reason,
              stopSequence: message.stop_sequence
            },
            metadata: auditContext.metadata || {}
          });
        } catch (auditError) {
          console.error('[Anthropic] Failed to log LLM usage:', auditError.message);
          // Don't throw - audit logging failure shouldn't break generation
        }
      }

      return responseText;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failure if audit context provided
      if (auditContext && auditContext.tenantId) {
        try {
          await LLMAuditService.logUsage({
            tenantId: auditContext.tenantId,
            operationType: auditContext.operationType || 'ai_generation',
            provider: 'anthropic',
            model: model,
            usage: error.usage || null,
            status: 'failed',
            responseTime,
            entityType: auditContext.entityType || null,
            entityId: auditContext.entityId || null,
            userId: auditContext.userId || null,
            errorMessage: error.message,
            requestParams: {
              model,
              temperature,
              maxTokens,
              systemPromptLength: systemPrompt?.length || 0,
              userPromptLength: prompt?.length || 0
            },
            metadata: {
              ...(auditContext.metadata || {}),
              error_type: error.type,
              error_code: error.error?.code
            }
          });
        } catch (auditError) {
          console.error('[Anthropic] Failed to log LLM error:', auditError.message);
        }
      }

      throw error;
    }
  }
}

module.exports = AIProviders;