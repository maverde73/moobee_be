/**
 * AI Providers Service
 * Fetches available models from AI providers dynamically
 * @created 2025-09-23
 */

const axios = require('axios');

class AIProvidersService {
  constructor() {
    this.cache = {
      openai: null,
      anthropic: null,
      deepseek: null,
      lastUpdate: null
    };
    this.cacheTimeout = 3600000; // 1 hour cache
  }

  /**
   * Get all available providers and their models
   */
  async getAllProviders(forceRefresh = false) {
    // Check cache
    if (!forceRefresh && this.cache.lastUpdate &&
        (Date.now() - this.cache.lastUpdate) < this.cacheTimeout) {
      return this.getCachedData();
    }

    // Fetch fresh data
    const providers = {};

    // Fetch from each provider in parallel
    const [openai, anthropic, deepseek] = await Promise.allSettled([
      this.getOpenAIModels(),
      this.getAnthropicModels(),
      this.getDeepSeekModels()
    ]);

    if (openai.status === 'fulfilled') {
      providers.openai = openai.value;
    }
    if (anthropic.status === 'fulfilled') {
      providers.anthropic = anthropic.value;
    }
    if (deepseek.status === 'fulfilled') {
      providers.deepseek = deepseek.value;
    }

    // Update cache
    this.cache = {
      ...providers,
      lastUpdate: Date.now()
    };

    return this.getCachedData();
  }

  /**
   * Get cached data in formatted structure
   */
  getCachedData() {
    const data = {};

    if (this.cache.openai) {
      data.openai = {
        name: 'OpenAI',
        models: this.cache.openai
      };
    }

    if (this.cache.anthropic) {
      data.anthropic = {
        name: 'Anthropic',
        models: this.cache.anthropic
      };
    }

    if (this.cache.deepseek) {
      data.deepseek = {
        name: 'DeepSeek',
        models: this.cache.deepseek
      };
    }

    return data;
  }

  /**
   * Fetch OpenAI models
   */
  async getOpenAIModels() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAI API key not configured');
        return this.getDefaultOpenAIModels();
      }

      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        timeout: 5000
      });

      // Filter and format models
      const models = response.data.data
        .filter(model => {
          // Filter for chat models
          return model.id.includes('gpt') ||
                 model.id.includes('text-davinci') ||
                 model.id.includes('text-curie');
        })
        .map(model => ({
          id: model.id,
          name: this.formatModelName(model.id),
          maxTokens: this.getOpenAIMaxTokens(model.id)
        }))
        .sort((a, b) => {
          // Sort by priority (GPT-5 first, then GPT-4, etc)
          const priority = ['gpt-5', 'gpt-4o', 'gpt-4', 'gpt-3.5'];
          const aIndex = priority.findIndex(p => a.id.includes(p));
          const bIndex = priority.findIndex(p => b.id.includes(p));
          return aIndex - bIndex;
        });

      return models.length > 0 ? models : this.getDefaultOpenAIModels();
    } catch (error) {
      console.error('Error fetching OpenAI models:', error.message);
      return this.getDefaultOpenAIModels();
    }
  }

  /**
   * Fetch Anthropic models
   */
  async getAnthropicModels() {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Anthropic API key not configured');
        return this.getDefaultAnthropicModels();
      }

      const response = await axios.get('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        timeout: 5000
      });

      // Format models
      const models = response.data.data
        .map(model => ({
          id: model.id,
          name: model.display_name || this.formatModelName(model.id),
          maxTokens: model.max_tokens || 200000
        }))
        .sort((a, b) => {
          // Sort by version (newest first)
          const aVersion = parseFloat(a.id.replace(/[^0-9.]/g, '') || '0');
          const bVersion = parseFloat(b.id.replace(/[^0-9.]/g, '') || '0');
          return bVersion - aVersion;
        });

      return models.length > 0 ? models : this.getDefaultAnthropicModels();
    } catch (error) {
      console.error('Error fetching Anthropic models:', error.message);
      return this.getDefaultAnthropicModels();
    }
  }

  /**
   * Fetch DeepSeek models
   */
  async getDeepSeekModels() {
    try {
      if (!process.env.DEEPSEEK_API_KEY) {
        console.log('DeepSeek API key not configured');
        return this.getDefaultDeepSeekModels();
      }

      const response = await axios.get('https://api.deepseek.com/models', {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        timeout: 5000
      });

      // Format models (DeepSeek uses OpenAI-compatible format)
      const models = response.data.data
        .map(model => ({
          id: model.id,
          name: this.formatModelName(model.id),
          maxTokens: model.max_tokens || 32768
        }));

      return models.length > 0 ? models : this.getDefaultDeepSeekModels();
    } catch (error) {
      console.error('Error fetching DeepSeek models:', error.message);
      return this.getDefaultDeepSeekModels();
    }
  }

  /**
   * Default OpenAI models (fallback)
   */
  getDefaultOpenAIModels() {
    return [
      { id: 'gpt-5', name: 'GPT-5 (Latest)', maxTokens: 16000 },
      { id: 'gpt-4o', name: 'GPT-4o (Optimized)', maxTokens: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000 },
      { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 16385 }
    ];
  }

  /**
   * Default Anthropic models (fallback)
   */
  getDefaultAnthropicModels() {
    return [
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Latest)', maxTokens: 200000 },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', maxTokens: 200000 },
      { id: 'claude-3-opus', name: 'Claude 3 Opus', maxTokens: 200000 },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', maxTokens: 200000 },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', maxTokens: 200000 }
    ];
  }

  /**
   * Default DeepSeek models (fallback)
   */
  getDefaultDeepSeekModels() {
    return [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', maxTokens: 32768 },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', maxTokens: 32768 }
    ];
  }

  /**
   * Format model name for display
   */
  formatModelName(modelId) {
    // Remove common prefixes and format
    return modelId
      .replace(/-/g, ' ')
      .replace(/gpt/gi, 'GPT')
      .replace(/claude/gi, 'Claude')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get max tokens for OpenAI models
   */
  getOpenAIMaxTokens(modelId) {
    const tokenLimits = {
      'gpt-5': 16000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4-32k': 32768,
      'gpt-4': 8192,
      'gpt-3.5-turbo-16k': 16385,
      'gpt-3.5-turbo': 16385
    };

    for (const [key, value] of Object.entries(tokenLimits)) {
      if (modelId.includes(key)) {
        return value;
      }
    }

    return 4096; // default
  }
}

module.exports = new AIProvidersService();