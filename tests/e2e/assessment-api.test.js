/**
 * E2E Tests for Assessment API
 * Direct API testing using axios
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production';

// Generate auth token
const generateToken = () => {
  return jwt.sign(
    {
      id: 'e2e-test-user',
      email: 'e2e@moobee.com',
      role: 'admin',
      tenantId: 'test-tenant'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Test data storage
const testData = {
  createdTemplates: [],
  authToken: null
};

// Helper function for API calls
const apiCall = async (method, endpoint, data = null, token = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response;
  } catch (error) {
    console.error(`API call failed: ${method} ${endpoint}`, error.message);
    throw error;
  }
};

describe('Assessment System E2E Tests', () => {
  beforeAll(() => {
    testData.authToken = generateToken();
    console.log('🔑 Generated auth token for tests');
  });

  afterAll(async () => {
    // Cleanup created test templates
    console.log(`\n🧹 Cleaning up ${testData.createdTemplates.length} test templates...`);

    for (const templateId of testData.createdTemplates) {
      try {
        await apiCall('DELETE', `/api/assessments/templates/${templateId}`, null, testData.authToken);
        console.log(`   ✅ Deleted template: ${templateId}`);
      } catch (error) {
        console.log(`   ⚠️  Failed to delete template: ${templateId}`);
      }
    }
  });

  describe('1. Template CRUD Operations', () => {
    let templateId;

    test('Should create a new assessment template', async () => {
      const newTemplate = {
        name: 'E2E Test Template - CRUD',
        type: 'big_five',
        description: 'Template created during E2E testing',
        language: 'it',
        isActive: true,
        questions: [
          {
            text: 'Test question 1',
            type: 'likert',
            orderIndex: 0,
            required: true,
            category: 'extraversion',
            options: [
              { text: 'Strongly Disagree', value: 1 },
              { text: 'Disagree', value: 2 },
              { text: 'Neutral', value: 3 },
              { text: 'Agree', value: 4 },
              { text: 'Strongly Agree', value: 5 }
            ]
          }
        ]
      };

      const response = await apiCall('POST', '/api/assessments/templates', newTemplate, testData.authToken);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.name).toBe(newTemplate.name);

      templateId = response.data.data.id;
      testData.createdTemplates.push(templateId);
    });

    test('Should retrieve template by ID', async () => {
      const response = await apiCall('GET', `/api/assessments/templates/${templateId}`);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(templateId);
      expect(response.data.questions).toBeInstanceOf(Array);
    });

    test('Should list all templates with pagination', async () => {
      const response = await apiCall('GET', '/api/assessments/templates?page=1&limit=5');

      expect(response.status).toBe(200);

      // Handle both possible response formats
      const templates = response.data.templates || response.data.data;
      const total = response.data.total || response.data.pagination?.total;

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeLessThanOrEqual(5);
      expect(total).toBeGreaterThan(0);
    });

    test('Should update template', async () => {
      const updates = {
        name: 'E2E Test Template - Updated',
        description: 'Updated during testing',
        isActive: false
      };

      const response = await apiCall('PUT', `/api/assessments/templates/${templateId}`, updates, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(updates.name);
      expect(response.data.isActive).toBe(false);
    });

    test('Should duplicate template', async () => {
      const duplicateData = {
        name: 'E2E Test Template - Duplicate'
      };

      const response = await apiCall('POST', `/api/assessments/templates/${templateId}/duplicate`, duplicateData, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data.id).not.toBe(templateId);
      expect(response.data.name).toBe(duplicateData.name);

      if (response.data.id) {
        testData.createdTemplates.push(response.data.id);
      }
    });

    test('Should delete template', async () => {
      const response = await apiCall('DELETE', `/api/assessments/templates/${templateId}`, null, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      // Remove from cleanup list
      const index = testData.createdTemplates.indexOf(templateId);
      if (index > -1) {
        testData.createdTemplates.splice(index, 1);
      }

      // Verify deletion
      const getResponse = await apiCall('GET', `/api/assessments/templates/${templateId}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('2. Question Management', () => {
    let templateId;
    let questionId;

    beforeAll(async () => {
      // Create a template for question tests
      const template = {
        name: 'E2E Test - Question Management',
        type: 'disc',
        description: 'Template for question management tests',
        questions: []
      };

      const response = await apiCall('POST', '/api/assessments/templates', template, testData.authToken);
      templateId = response.data.data?.id || response.data.id;
      testData.createdTemplates.push(templateId);
    });

    test('Should add question to template', async () => {
      const newQuestion = {
        text: 'How do you handle challenges?',
        type: 'likert',
        orderIndex: 0,
        required: true,
        category: 'dominance',
        options: [
          { text: 'Avoid', value: 1 },
          { text: 'Neutral', value: 3 },
          { text: 'Embrace', value: 5 }
        ]
      };

      const response = await apiCall('POST', `/api/assessments/templates/${templateId}/questions`, newQuestion, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data.text).toBe(newQuestion.text);

      questionId = response.data.id;
    });

    test('Should update question', async () => {
      const updates = {
        text: 'How do you approach difficult challenges?',
        required: false
      };

      const response = await apiCall('PUT', `/api/assessments/questions/${questionId}`, updates, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.text).toBe(updates.text);
      expect(response.data.required).toBe(false);
    });

    test('Should reorder questions', async () => {
      // Add another question first
      const question2 = await apiCall('POST', `/api/assessments/templates/${templateId}/questions`, {
        text: 'Second question',
        type: 'text',
        orderIndex: 1,
        required: true
      }, testData.authToken);

      const reorderData = {
        templateId,
        questionOrders: [
          { questionId: question2.data.id, orderIndex: 0 },
          { questionId: questionId, orderIndex: 1 }
        ]
      };

      const response = await apiCall('PUT', '/api/assessments/questions/reorder', reorderData, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('Should delete question', async () => {
      const response = await apiCall('DELETE', `/api/assessments/questions/${questionId}`, null, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('3. AI Generation', () => {
    test('Should generate questions using AI', async () => {
      const request = {
        type: 'big_five',
        count: 3,
        language: 'it',
        difficulty: 'medium',
        suggestedRoles: ['Developer']
      };

      const response = await apiCall('POST', '/api/assessments/ai/generate-questions', request, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('questions');
      expect(response.data.data.questions).toBeInstanceOf(Array);
      expect(response.data.data.metadata.language).toBe('it');
    });

    test('Should get AI providers', async () => {
      const response = await apiCall('GET', '/api/assessments/ai/providers', null, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('providers');
      expect(response.data.providers).toBeInstanceOf(Array);
    });

    test('Should get assessment types', async () => {
      const response = await apiCall('GET', '/api/assessments/ai/assessment-types', null, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('types');
      expect(response.data.types).toBeInstanceOf(Array);
      expect(response.data.types).toContain('big-five');
      expect(response.data.types).toContain('disc');
      expect(response.data.types).toContain('belbin');
    });

    test('Should test AI connection', async () => {
      const response = await apiCall('GET', '/api/assessments/ai/test-connection', null, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
    });
  });

  describe('4. Filtering and Search', () => {
    test('Should filter templates by type', async () => {
      const response = await apiCall('GET', '/api/assessments/templates?type=big_five');

      expect(response.status).toBe(200);
      const templates = response.data.templates || response.data.data || [];
      templates.forEach(template => {
        expect(template.type).toBe('big_five');
      });
    });

    test('Should filter templates by active status', async () => {
      const response = await apiCall('GET', '/api/assessments/templates?isActive=true');

      expect(response.status).toBe(200);
      const templates = response.data.templates || response.data.data || [];
      templates.forEach(template => {
        expect(template.isActive).toBe(true);
      });
    });

    test('Should search templates by name', async () => {
      const response = await apiCall('GET', '/api/assessments/templates?search=Marketing');

      expect(response.status).toBe(200);
      const templates = response.data.templates || response.data.data || [];
      if (templates.length > 0) {
        expect(templates.some(t =>
          t.name.toLowerCase().includes('marketing')
        )).toBe(true);
      }
    });
  });

  describe('5. Validation and Error Handling', () => {
    test('Should reject invalid template type', async () => {
      const invalidTemplate = {
        name: 'Invalid Type Test',
        type: 'invalid_type',
        description: 'Should fail'
      };

      const response = await apiCall('POST', '/api/assessments/templates', invalidTemplate, testData.authToken);

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('errors');
    });

    test('Should reject missing required fields', async () => {
      const incompleteTemplate = {
        description: 'Missing name and type'
      };

      const response = await apiCall('POST', '/api/assessments/templates', incompleteTemplate, testData.authToken);

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('errors');
    });

    test('Should require authentication for protected endpoints', async () => {
      const template = {
        name: 'Unauthorized Test',
        type: 'disc',
        description: 'Should fail without auth'
      };

      const response = await apiCall('POST', '/api/assessments/templates', template);

      expect(response.status).toBe(401);
    });

    test('Should handle non-existent resources', async () => {
      const response = await apiCall('GET', '/api/assessments/templates/non-existent-id-12345');

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('6. Statistics', () => {
    test('Should get assessment statistics', async () => {
      const response = await apiCall('GET', '/api/assessments/statistics', null, testData.authToken);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('totalTemplates');
      expect(response.data.data).toHaveProperty('totalQuestions');
      expect(response.data.data).toHaveProperty('templatesByType');
    });
  });
});

// Test summary
afterAll(() => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 E2E TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('✅ All E2E tests completed');
  console.log(`🗂️  Templates created: ${testData.createdTemplates.length}`);
  console.log('✨ Assessment system validation complete!');
});