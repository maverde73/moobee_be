/**
 * AI Generation Service - Main Module
 * Servizio principale per la generazione di contenuti con AI
 * Orchestratore dei moduli AI secondo Giurelli's Code Standards
 * @module services/ai/AIGenerationService
 */

const AIProviders = require('./providers');
const ResponseParser = require('./responseParser');
const MockDataProvider = require('./mockData');
const PromptBuilder = require('./promptBuilder');
const { getAssessmentPrompt } = require('../prompts/assessmentPrompts');

/**
 * Servizio principale per generazione AI
 * Coordina provider, parser e builder secondo pattern separation of concerns
 * @class AIGenerationService
 */
class AIGenerationService {
  constructor() {
    // Inizializza moduli secondo single responsibility principle
    this.providers = new AIProviders();
    this.parser = new ResponseParser();
    this.mockProvider = new MockDataProvider();
    this.promptBuilder = new PromptBuilder();

    // Cache configuration
    this.cache = new Map();
    this.cacheMaxAge = 3600000; // 1 ora
    this.rateLimitDelay = 1000; // 1 secondo tra richieste
    this.modelsCache = null; // For compatibility with controller
    this.cacheExpiry = null; // For compatibility with controller
    this.lastRequestTime = 0;
  }

  /**
   * Genera domande per assessment
   * @param {string} type - Tipo di assessment
   * @param {Object} parameters - Parametri di generazione
   * @returns {Promise<Array>} Array di domande generate
   */
  async generateAssessmentQuestions(type, parameters = {}) {
    const {
      count = this.getDefaultCount(type),
      language = 'it',
      context,
      suggestedRoles = [],
      description = '',
      auditContext = null
    } = parameters;

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(type, parameters);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('Cache hit for prompt');
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      // Build customization string for fixed prompts
      let customization = '';
      if (suggestedRoles && suggestedRoles.length > 0) {
        customization += `RUOLI TARGET: ${suggestedRoles.join(', ')}\n`;
      }
      if (description) {
        customization += `DESCRIZIONE ASSESSMENT: ${description}\n`;
      }
      if (context) {
        customization += `CONTESTO SPECIFICO: ${context}\n`;
      }

      // Use fixed prompt with customization
      const { getAssessmentPrompt } = require('../prompts/assessmentPrompts');
      const prompt = getAssessmentPrompt(type.replace('_', '-'), customization, count, null, language) +
        this.promptBuilder.getJSONInstructions(type, language);

      // Log del prompt completo per debug
      console.log('\n========== PROMPT COMPLETO PER AI ==========');
      console.log('📋 Tipo Assessment:', type);
      if (type === 'disc' || type === 'disc') {
        console.log('🎯 DISC Assessment - Dimensioni: Dominanza, Influenza, Stabilità, Coscienziosità');
      }
      console.log('📊 Numero domande richieste:', count);
      console.log('👥 Ruoli target:', suggestedRoles.length > 0 ? suggestedRoles.join(', ') : 'Nessuno');
      console.log('📝 Descrizione:', description || 'Nessuna');
      console.log('🌍 Lingua:', language);
      console.log('🔧 Personalizzazione:', customization || 'Nessuna');
      console.log('---------- INIZIO PROMPT ESATTO ----------');
      console.log(prompt);
      console.log('---------- FINE PROMPT ESATTO ----------');
      console.log('📏 Lunghezza prompt:', prompt.length, 'caratteri\n');

      // Generate with AI
      let response;
      if (this.providers.hasProviders()) {
        response = await this.generateWithAI(prompt, type, auditContext);
      } else {
        response = this.mockProvider.getMockAIResponse(prompt);
      }

      // Set parser language for default options
      this.parser.setLanguage(language);

      // Parse response
      const questions = this.parser.parseQuestionsResponse(response, type);

      // Cache result
      this.saveToCache(cacheKey, questions);

      return questions;

    } catch (error) {
      console.error('Error generating assessment questions:', error);
      console.log('Returning fallback questions due to error');
      return this.mockProvider.getFallbackQuestions(type, count);
    }
  }

  /**
   * Genera con configurazione personalizzata
   * @param {string} type - Tipo di assessment
   * @param {Object} options - Opzioni di generazione
   * @returns {Promise<Array>} Domande generate
   */
  async generateWithCustomConfig(type, options) {
    const {
      provider,
      model,
      temperature = 0.7,
      maxTokens = 4000,
      customization = '',
      count = 10,
      language = 'it',
      suggestedRoles = [],
      description = '',
      auditContext = null
    } = options;

    console.log('🎨 Generating with custom configuration:', {
      provider,
      model,
      temperature,
      maxTokens,
      hasCustomization: !!customization,
      customizationLength: customization ? customization.length : 0,
      rolesCount: suggestedRoles.length
    });

    try {
      // Build customization with roles
      let fullCustomization = customization;
      if (suggestedRoles && suggestedRoles.length > 0) {
        const rolesSection = `RUOLI TARGET: ${suggestedRoles.join(', ')}`;
        fullCustomization = fullCustomization ?
          `${rolesSection}\n${customization}` : rolesSection;
      }
      if (description) {
        const descSection = `DESCRIZIONE ASSESSMENT: ${description}`;
        fullCustomization = fullCustomization ?
          `${fullCustomization}\n${descSection}` : descSection;
      }

      // Get fixed prompt with customization
      const basePrompt = getAssessmentPrompt(type, fullCustomization, count, null, language);
      const jsonInstructions = this.promptBuilder.getJSONInstructions(type, language);
      const finalPrompt = basePrompt + jsonInstructions;

      // LOG THE EXACT PROMPT BEING SENT
      console.log('\n' + '='.repeat(80));
      console.log('🎯 EXACT PROMPT BEING SENT TO AI:');
      console.log('='.repeat(80));
      console.log(finalPrompt);
      console.log('='.repeat(80) + '\n');

      console.log('📝 Final prompt length:', finalPrompt.length);

      // Get system prompt in correct language
      const systemPrompt = this.promptBuilder.getSystemPrompt(type, language);
      console.log('🎭 System Prompt:', systemPrompt);

      // Generate with selected provider
      let response;
      if (provider === 'openai' && this.providers.openai) {
        // GPT-5 doesn't support temperature, maxTokens, or top_p
        const isGPT5 = model && model.toLowerCase().includes('gpt-5');
        response = await this.providers.generateWithOpenAI(
          finalPrompt,
          systemPrompt,
          isGPT5 ? undefined : temperature,
          isGPT5 ? undefined : maxTokens,
          model || 'gpt-5',
          auditContext
        );
      } else if (provider === 'anthropic' && this.providers.anthropic) {
        response = await this.providers.generateWithAnthropic(
          finalPrompt,
          systemPrompt,
          temperature,
          maxTokens,
          model || 'claude-opus-4-1-20250805',
          auditContext
        );
      } else {
        console.warn(`Provider ${provider} not available, falling back to default`);
        return this.generateAssessmentQuestions(type, options);
      }

      // Set parser language for default options
      this.parser.setLanguage(language);

      // Parse and return questions
      const questions = this.parser.parseQuestionsResponse(response, type);
      console.log(`✅ Generated ${questions.length} questions with custom config`);

      // Add metadata
      return questions.map(q => ({
        ...q,
        generatedWith: {
          provider,
          model,
          temperature,
          hasCustomization: !!customization
        }
      }));

    } catch (error) {
      console.error('Error with custom generation:', error);
      console.log('Falling back to default generation');
      return this.generateAssessmentQuestions(type, options);
    }
  }

  /**
   * Genera completion con provider e modello specifici
   * @public
   * @param {Object} options - Opzioni di generazione
   * @returns {Promise<string>} Risposta AI
   */
  async generateCompletion(options = {}) {
    const {
      prompt,
      provider = 'openai',
      model = 'gpt-4',
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt = 'You are a helpful assistant.'
    } = options;

    try {
      // Rate limiting
      await this.enforceRateLimit();

      // Generate based on provider
      if (provider === 'openai' && this.providers.openai) {
        console.log(`🤖 Calling OpenAI with model: ${model}`);
        try {
          // GPT-5 doesn't support temperature, maxTokens, or top_p
          const isGPT5 = model && model.toLowerCase().includes('gpt-5');
          const response = await this.providers.generateWithOpenAI(
            prompt,
            systemPrompt,
            isGPT5 ? undefined : temperature,
            isGPT5 ? undefined : maxTokens,
            model
          );
          console.log('✅ OpenAI response received:', response?.substring(0, 200));
          return response;
        } catch (error) {
          console.error('❌ OpenAI error:', error.message);
          throw error;
        }
      } else if (provider === 'anthropic' && this.providers.anthropic) {
        return await this.providers.generateWithAnthropic(
          prompt,
          systemPrompt,
          temperature,
          maxTokens,
          model
        );
      } else if (provider === 'deepseek' && this.providers.deepseek) {
        // DeepSeek uses OpenAI-compatible API
        return await this.providers.generateWithDeepSeek(
          prompt,
          systemPrompt,
          temperature,
          maxTokens,
          model
        );
      } else {
        // Fallback to mock data if provider not available
        console.warn(`⚠️ Provider ${provider} not available, using MOCK DATA`);
        console.log('Available providers:', {
          openai: !!this.providers.openai,
          anthropic: !!this.providers.anthropic,
          deepseek: !!this.providers.deepseek
        });
        return this.mockProvider.getMockAIResponse(prompt);
      }
    } catch (error) {
      console.error(`Error with ${provider}:`, error);
      // Try fallback providers
      if (provider !== 'openai' && this.providers.openai) {
        console.log('Falling back to OpenAI...');
        return await this.providers.generateWithOpenAI(
          prompt,
          systemPrompt,
          temperature,
          maxTokens,
          'gpt-4'
        );
      }
      throw error;
    }
  }

  /**
   * Genera con AI disponibile
   * @private
   * @param {string} prompt - Prompt completo
   * @param {string} type - Tipo di assessment
   * @param {Object} auditContext - Context for LLM audit logging
   * @returns {Promise<string>} Risposta AI
   */
  async generateWithAI(prompt, type, auditContext = null) {
    const systemPrompt = this.promptBuilder.getSystemPrompt(type);

    // Try OpenAI first
    if (this.providers.openai) {
      try {
        return await this.providers.generateWithOpenAI(
          prompt,
          systemPrompt,
          0.7,
          4000,
          'gpt-4-turbo',
          auditContext
        );
      } catch (error) {
        console.warn('OpenAI generation failed:', error.message);
      }
    }

    // Try Anthropic as fallback
    if (this.providers.anthropic) {
      try {
        return await this.providers.generateWithAnthropic(
          prompt,
          systemPrompt,
          0.7,
          4000,
          'claude-3-5-sonnet-20241022',
          auditContext
        );
      } catch (error) {
        console.warn('Anthropic generation failed:', error.message);
      }
    }

    // Use mock if no AI available
    return this.mockProvider.getMockAIResponse(prompt);
  }

  /**
   * Valuta risposte con AI
   * @param {Array} responses - Risposte da valutare
   * @param {string} type - Tipo di assessment
   * @returns {Promise<Object>} Valutazione
   */
  async evaluateResponsesWithAI(responses, type = 'big_five') {
    try {
      if (!this.providers.hasProviders()) {
        return this.mockProvider.getMockReport(type, responses);
      }

      const prompt = this.promptBuilder.buildEvaluationPrompt(responses, type);
      const systemPrompt = 'You are an expert psychometric evaluator. Analyze the assessment responses and provide detailed evaluation.';

      let response;
      if (this.providers.openai) {
        response = await this.providers.generateWithOpenAI(
          prompt,
          systemPrompt,
          0.3, // Lower temperature for evaluation
          2000,
          'gpt-4-turbo'
        );
      } else if (this.providers.anthropic) {
        response = await this.providers.generateWithAnthropic(
          prompt,
          systemPrompt,
          0.3,
          2000
        );
      } else {
        return this.mockProvider.getMockReport(type, responses);
      }

      return this.parser.parseEvaluationResponse(response);

    } catch (error) {
      console.error('Error evaluating responses:', error);
      return this.mockProvider.getMockReport(type, responses);
    }
  }

  /**
   * Genera report dettagliato
   * @param {Object} evaluation - Valutazione da cui generare report
   * @param {string} type - Tipo di assessment
   * @returns {Promise<string>} Report in formato HTML/Markdown
   */
  async generateReportWithAI(evaluation, type = 'big_five') {
    try {
      if (!this.providers.hasProviders()) {
        return this.generateMockReport(evaluation, type);
      }

      const prompt = this.promptBuilder.buildReportPrompt(evaluation, type);
      const systemPrompt = 'You are an expert HR consultant. Create a professional assessment report.';

      let response;
      if (this.providers.openai) {
        response = await this.providers.generateWithOpenAI(
          prompt,
          systemPrompt,
          0.5,
          3000,
          'gpt-4-turbo'
        );
      } else if (this.providers.anthropic) {
        response = await this.providers.generateWithAnthropic(
          prompt,
          systemPrompt,
          0.5,
          3000
        );
      } else {
        return this.generateMockReport(evaluation, type);
      }

      return this.formatReport(response);

    } catch (error) {
      console.error('Error generating report:', error);
      return this.generateMockReport(evaluation, type);
    }
  }

  /**
   * Ottiene provider AI disponibili
   * @param {boolean} refresh - Forza refresh cache
   * @returns {Promise<Object>} Provider disponibili
   */
  async getAIProviders(refresh = false) {
    return await this.providers.getAvailableProviders(refresh);
  }

  /**
   * Alias per compatibilità con vecchio codice
   * @param {boolean} refresh - Forza refresh cache
   * @returns {Promise<Object>} Provider disponibili
   */
  async getAvailableProviders(refresh = false) {
    return await this.getAIProviders(refresh);
  }

  // ===== Helper Methods (< 50 lines each) =====

  /**
   * Ottiene conteggio default per tipo
   * @private
   */
  getDefaultCount(type) {
    const counts = {
      'big-five': 20,
      'disc': 20,
      'belbin': 15
    };
    return counts[type] || 10;
  }

  /**
   * Genera chiave cache
   * @private
   */
  getCacheKey(type, parameters) {
    return `${type}_${JSON.stringify(parameters)}`;
  }

  /**
   * Ottiene da cache
   * @private
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }

  /**
   * Salva in cache
   * @private
   */
  saveToCache(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheMaxAge
    });

    // Cleanup old cache entries
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Applica rate limiting
   * @private
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Genera report mock
   * @private
   */
  generateMockReport(evaluation, type) {
    return `
# Assessment Report - ${type}

## Overall Score: ${evaluation.overallScore}/100

## Category Scores
${Object.entries(evaluation.categories || {})
  .map(([cat, score]) => `- ${cat}: ${score}/100`)
  .join('\n')}

## Strengths
${(evaluation.strengths || []).map(s => `- ${s}`).join('\n')}

## Areas for Improvement
${(evaluation.improvements || []).map(i => `- ${i}`).join('\n')}

## Recommendations
${(evaluation.recommendations || []).map(r => `- ${r}`).join('\n')}

---
*Generated: ${new Date().toISOString()}*
*Note: This is a mock report for testing purposes*
    `.trim();
  }

  /**
   * Formatta report
   * @private
   */
  formatReport(response) {
    // Ensure proper formatting
    if (response.startsWith('#')) {
      return response; // Already formatted as markdown
    }

    // Convert to markdown if needed
    return `# Assessment Report\n\n${response}`;
  }
}

// Export singleton instance
module.exports = new AIGenerationService();