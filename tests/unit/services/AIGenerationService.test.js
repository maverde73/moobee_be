/**
 * Unit Tests for AIGenerationService
 */

const AIGenerationService = require('../../../src/services/AIGenerationService');

// Mock OpenAI
jest.mock('openai', () => {
  return class OpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: jest.fn()
        }
      };
    }
  };
});

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return class Anthropic {
    constructor() {
      this.messages = {
        create: jest.fn()
      };
    }
  };
});

describe('AIGenerationService', () => {
  let service;

  beforeEach(() => {
    service = new AIGenerationService();
    jest.clearAllMocks();
  });

  describe('generateAssessmentQuestions', () => {
    it('should generate questions for Big Five assessment', async () => {
      const mockResponse = [
        {
          text: 'How often do you enjoy social gatherings?',
          type: 'scale',
          category: 'extraversion',
          options: [
            { text: 'Never', value: 1 },
            { text: 'Rarely', value: 2 },
            { text: 'Sometimes', value: 3 },
            { text: 'Often', value: 4 },
            { text: 'Always', value: 5 }
          ]
        }
      ];

      service.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockResponse)
          }
        }]
      });

      const result = await service.generateAssessmentQuestions('big_five', 1);

      expect(result).toEqual(mockResponse);
      expect(service.openai.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      service.openai.chat.completions.create.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        service.generateAssessmentQuestions('big_five', 5)
      ).rejects.toThrow('Failed to generate assessment questions');
    });

    it('should validate assessment type', async () => {
      await expect(
        service.generateAssessmentQuestions('invalid_type', 5)
      ).rejects.toThrow('Invalid assessment type');
    });

    it('should use cache for repeated requests', async () => {
      const mockResponse = [{ text: 'Test question', type: 'scale' }];

      service.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(mockResponse) }
        }]
      });

      // First call
      await service.generateAssessmentQuestions('disc', 1);
      // Second call should use cache
      await service.generateAssessmentQuestions('disc', 1);

      expect(service.openai.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateReport', () => {
    it('should generate assessment report', async () => {
      const mockReport = {
        summary: 'Assessment completed successfully',
        strengths: ['Leadership', 'Communication'],
        improvements: ['Time management'],
        recommendations: ['Focus on delegation']
      };

      service.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(mockReport) }
        }]
      });

      const responses = {
        questions: [
          { text: 'Question 1', answer: 'Answer 1' }
        ],
        scores: { total: 85 }
      };

      const result = await service.generateReport('big_five', responses);

      expect(result).toEqual(mockReport);
      expect(service.openai.chat.completions.create).toHaveBeenCalled();
    });

    it('should fallback to Anthropic when OpenAI fails', async () => {
      const mockReport = { summary: 'Report from Anthropic' };

      service.openai.chat.completions.create.mockRejectedValue(
        new Error('OpenAI error')
      );

      service.anthropic.messages.create.mockResolvedValue({
        content: [{ text: JSON.stringify(mockReport) }]
      });

      const result = await service.generateReport('disc', {});

      expect(result).toEqual(mockReport);
      expect(service.anthropic.messages.create).toHaveBeenCalled();
    });
  });

  describe('generateSuggestions', () => {
    it('should generate template suggestions', async () => {
      const mockSuggestions = [
        'Add more questions about teamwork',
        'Include scenario-based questions',
        'Balance question difficulty'
      ];

      service.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(mockSuggestions) }
        }]
      });

      const template = {
        name: 'Leadership Assessment',
        questions: [{ text: 'Sample question' }]
      };

      const result = await service.generateSuggestions(template);

      expect(result).toEqual(mockSuggestions);
      expect(result).toHaveLength(3);
    });
  });

  describe('improveQuestion', () => {
    it('should improve question quality', async () => {
      const improvedQuestion = {
        text: 'On a scale of 1-5, how confident are you in leading team meetings?',
        type: 'scale',
        improved: true
      };

      service.openai.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(improvedQuestion) }
        }]
      });

      const originalQuestion = {
        text: 'Do you lead meetings?',
        type: 'single_choice'
      };

      const result = await service.improveQuestion(originalQuestion);

      expect(result.improved).toBe(true);
      expect(result.text).toContain('scale');
    });
  });

  describe('Cache Management', () => {
    it('should clear expired cache entries', async () => {
      // Add item to cache
      service.cache.set('test-key', {
        data: 'test-data',
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      });

      const cachedData = service.getCachedData('test-key');
      expect(cachedData).toBeNull(); // Should be expired
    });

    it('should return valid cached data', async () => {
      const testData = { test: 'data' };
      service.cache.set('valid-key', {
        data: testData,
        timestamp: Date.now() // Current time
      });

      const cachedData = service.getCachedData('valid-key');
      expect(cachedData).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    it('should retry on failure with exponential backoff', async () => {
      let attempts = 0;
      service.openai.chat.completions.create.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return {
          choices: [{
            message: { content: '{"success": true}' }
          }]
        };
      });

      const result = await service.generateCompletion('test prompt');

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      service.openai.chat.completions.create.mockRejectedValue(
        new Error('Persistent failure')
      );
      service.anthropic.messages.create.mockRejectedValue(
        new Error('Anthropic also failed')
      );

      await expect(
        service.generateCompletion('test prompt')
      ).rejects.toThrow('AI generation failed after retries');
    });
  });
});