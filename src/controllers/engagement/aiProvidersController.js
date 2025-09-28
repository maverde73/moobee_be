/**
 * AI Providers Controller
 * Handles requests for AI provider models
 * @created 2025-09-23
 */

const aiProvidersService = require('../../services/aiProvidersService');

const aiProvidersController = {
  /**
   * Get all available AI providers and their models
   */
  async getProviders(req, res) {
    try {
      const { refresh = false } = req.query;

      // Convert string to boolean
      const forceRefresh = refresh === 'true' || refresh === true;

      // Get providers data
      const providers = await aiProvidersService.getAllProviders(forceRefresh);

      res.json({
        success: true,
        data: providers,
        cached: !forceRefresh,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in getProviders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch AI providers',
        message: error.message
      });
    }
  },

  /**
   * Get models for a specific provider
   */
  async getProviderModels(req, res) {
    try {
      const { provider } = req.params;
      const { refresh = false } = req.query;

      const forceRefresh = refresh === 'true' || refresh === true;
      const providers = await aiProvidersService.getAllProviders(forceRefresh);

      if (!providers[provider]) {
        return res.status(404).json({
          success: false,
          error: `Provider ${provider} not found`
        });
      }

      res.json({
        success: true,
        data: providers[provider],
        cached: !forceRefresh,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in getProviderModels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider models',
        message: error.message
      });
    }
  }
};

module.exports = aiProvidersController;