/**
 * Comprehensive E2E Functional Tests for Assessment System
 * Tests complete flows for assessment template management, AI generation, and operations
 * @module tests/e2e/assessment-system.e2e.test
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = require('../../src/server');

// Helper function to generate test token
const generateAuthToken = (user = {}) => {
  return jwt.sign(
    {
      id: user.id || 'test-user-e2e',
      email: user.email || 'e2e-test@moobee.com',
      role: user.role || 'admin',
      tenantId: user.tenantId || 'test-tenant-e2e'
    },
    process.env.JWT_ACCESS_SECRET || 'test-secret',
    { expiresIn: '24h' }
  );
};

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Assessment System - Complete E2E Functional Tests', () => {
  let authToken;
  let createdTemplateId;
  let duplicatedTemplateId;
  let createdQuestionId;
  const testTemplates = [];

  beforeAll(async () => {
    authToken = generateAuthToken();
    // Clean up test data from previous runs
    await prisma.assessmentTemplate.deleteMany({
      where: {
        OR: [
          { name: { contains: 'E2E Test' }},
          { name: { contains: 'Test Template' }},
          { createdBy: 'test-user-e2e' }
        ]
      }
    });
  });

  afterAll(async () => {
    // Clean up all test data
    if (testTemplates.length > 0) {
      await prisma.assessmentTemplate.deleteMany({
        where: {
          id: { in: testTemplates }
        }
      });
    }
    await prisma.$disconnect();
  });

  describe('1. Template Creation and Management', () => {
    describe('POST /api/assessments/templates - Create Template', () => {
      it('should create a new assessment template with all fields', async () => {
        const newTemplate = {
          name: 'E2E Test Assessment - Complete Flow',
          type: 'big_five',
          description: 'Comprehensive E2E test for Big Five personality assessment',
          language: 'it',
          isActive: true,
          frequency: 'quarterly',
          targetRoles: ['Developer', 'Manager'],
          questions: [
            {
              text: 'Mi piace lavorare in team su progetti complessi',
              type: 'scale',
              orderIndex: 0,
              required: true,
              category: 'extraversion',
              weight: 1.0,
              scaleMin: 1,
              scaleMax: 5,
              scaleLabels: {
                1: 'Fortemente in disaccordo',
                3: 'Neutro',
                5: 'Fortemente d\'accordo'
              }
            },
            {
              text: 'Preferisco pianificare le attività in anticipo',
              type: 'scale',
              orderIndex: 1,
              required: true,
              category: 'conscientiousness',
              weight: 1.0,
              scaleMin: 1,
              scaleMax: 5
            }
          ],
          metadata: {
            department: 'IT',
            level: 'senior',
            customField: 'test-value'
          }
        };

        const response = await request(app)
          .post('/api/assessments/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send(newTemplate)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(newTemplate.name);
        expect(response.body.type).toBe(newTemplate.type);
        expect(response.body.questions).toHaveLength(2);
        expect(response.body.isActive).toBe(true);
        expect(response.body.targetRoles).toEqual(newTemplate.targetRoles);

        createdTemplateId = response.body.id;
        testTemplates.push(createdTemplateId);
      });

      it('should validate required fields', async () => {
        const invalidTemplate = {
          description: 'Missing required name and type'
        };

        const response = await request(app)
          .post('/api/assessments/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidTemplate)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.success).toBe(false);
      });

      it('should validate assessment type enum', async () => {
        const invalidTemplate = {
          name: 'Invalid Type Test',
          type: 'invalid_assessment_type',
          description: 'Test with invalid type'
        };

        const response = await request(app)
          .post('/api/assessments/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidTemplate)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      it('should reject request without authentication', async () => {
        const template = {
          name: 'Unauthorized Test',
          type: 'disc',
          description: 'Should fail without auth'
        };

        await request(app)
          .post('/api/assessments/templates')
          .send(template)
          .expect(401);
      });
    });

    describe('GET /api/assessments/templates - List Templates', () => {
      it('should retrieve all templates with pagination', async () => {
        const response = await request(app)
          .get('/api/assessments/templates?page=1&limit=10')
          .expect(200);

        expect(response.body).toHaveProperty('templates');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('totalPages');
        expect(Array.isArray(response.body.templates)).toBe(true);
        expect(response.body.page).toBe(1);
      });

      it('should filter templates by type', async () => {
        const response = await request(app)
          .get('/api/assessments/templates?type=big_five')
          .expect(200);

        response.body.templates.forEach(template => {
          expect(template.type).toBe('big_five');
        });
      });

      it('should filter templates by active status', async () => {
        const response = await request(app)
          .get('/api/assessments/templates?isActive=true')
          .expect(200);

        response.body.templates.forEach(template => {
          expect(template.isActive).toBe(true);
        });
      });

      it('should search templates by name', async () => {
        const response = await request(app)
          .get('/api/assessments/templates?search=E2E')
          .expect(200);

        expect(response.body.templates.some(t =>
          t.name.includes('E2E')
        )).toBe(true);
      });
    });

    describe('GET /api/assessments/templates/:id - Get Template by ID', () => {
      it('should retrieve template with all details', async () => {
        const response = await request(app)
          .get(`/api/assessments/templates/${createdTemplateId}`)
          .expect(200);

        expect(response.body.id).toBe(createdTemplateId);
        expect(response.body).toHaveProperty('questions');
        expect(response.body).toHaveProperty('targetRoles');
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.questions).toBeInstanceOf(Array);
      });

      it('should return 404 for non-existent template', async () => {
        const response = await request(app)
          .get('/api/assessments/templates/non-existent-id-12345')
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PUT /api/assessments/templates/:id - Update Template', () => {
      it('should update template fields', async () => {
        const updates = {
          name: 'E2E Test Assessment - Updated',
          description: 'Updated description for E2E test',
          frequency: 'monthly',
          isActive: false,
          targetRoles: ['Developer', 'Manager', 'HR']
        };

        const response = await request(app)
          .put(`/api/assessments/templates/${createdTemplateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200);

        expect(response.body.name).toBe(updates.name);
        expect(response.body.description).toBe(updates.description);
        expect(response.body.frequency).toBe(updates.frequency);
        expect(response.body.isActive).toBe(false);
        expect(response.body.targetRoles).toHaveLength(3);
      });

      it('should validate update data', async () => {
        const invalidUpdate = {
          type: 'invalid_type'
        };

        const response = await request(app)
          .put(`/api/assessments/templates/${createdTemplateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdate)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });

      it('should require authentication for updates', async () => {
        await request(app)
          .put(`/api/assessments/templates/${createdTemplateId}`)
          .send({ name: 'Unauthorized Update' })
          .expect(401);
      });
    });

    describe('POST /api/assessments/templates/:id/duplicate - Duplicate Template', () => {
      it('should create a copy of existing template', async () => {
        const response = await request(app)
          .post(`/api/assessments/templates/${createdTemplateId}/duplicate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'E2E Test Assessment - Duplicated',
            description: 'Duplicated template for testing'
          })
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).not.toBe(createdTemplateId);
        expect(response.body.name).toBe('E2E Test Assessment - Duplicated');
        expect(response.body.questions).toHaveLength(2);

        duplicatedTemplateId = response.body.id;
        testTemplates.push(duplicatedTemplateId);
      });

      it('should handle duplication of non-existent template', async () => {
        const response = await request(app)
          .post('/api/assessments/templates/non-existent-id/duplicate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Failed Duplicate' })
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('2. Question Management', () => {
    describe('POST /api/assessments/templates/:id/questions - Add Question', () => {
      it('should add a new question to template', async () => {
        const newQuestion = {
          text: 'Sono una persona organizzata e metodica',
          type: 'scale',
          orderIndex: 2,
          required: true,
          category: 'conscientiousness',
          weight: 1.5,
          scaleMin: 1,
          scaleMax: 7,
          scaleLabels: {
            1: 'Mai',
            4: 'A volte',
            7: 'Sempre'
          }
        };

        const response = await request(app)
          .post(`/api/assessments/templates/${createdTemplateId}/questions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(newQuestion)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body.text).toBe(newQuestion.text);
        expect(response.body.category).toBe(newQuestion.category);
        expect(response.body.weight).toBe(newQuestion.weight);

        createdQuestionId = response.body.id;
      });

      it('should validate question data', async () => {
        const invalidQuestion = {
          type: 'invalid_type',
          orderIndex: 'not_a_number'
        };

        const response = await request(app)
          .post(`/api/assessments/templates/${createdTemplateId}/questions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidQuestion)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('PUT /api/assessments/questions/:id - Update Question', () => {
      it('should update existing question', async () => {
        const updates = {
          text: 'Sono una persona molto organizzata e precisa',
          weight: 2.0,
          required: false,
          scaleLabels: {
            1: 'Assolutamente no',
            4: 'Neutro',
            7: 'Assolutamente sì'
          }
        };

        const response = await request(app)
          .put(`/api/assessments/questions/${createdQuestionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)
          .expect(200);

        expect(response.body.text).toBe(updates.text);
        expect(response.body.weight).toBe(updates.weight);
        expect(response.body.required).toBe(false);
      });
    });

    describe('PUT /api/assessments/questions/reorder - Reorder Questions', () => {
      it('should reorder questions in template', async () => {
        // Get current questions
        const template = await request(app)
          .get(`/api/assessments/templates/${createdTemplateId}`)
          .expect(200);

        const questions = template.body.questions;
        const reorderData = {
          templateId: createdTemplateId,
          questionOrders: questions.map((q, index) => ({
            questionId: q.id,
            orderIndex: questions.length - index - 1
          }))
        };

        const response = await request(app)
          .put('/api/assessments/questions/reorder')
          .set('Authorization', `Bearer ${authToken}`)
          .send(reorderData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should validate reorder data', async () => {
        const invalidReorder = {
          templateId: createdTemplateId,
          questionOrders: 'not_an_array'
        };

        const response = await request(app)
          .put('/api/assessments/questions/reorder')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidReorder)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      });
    });

    describe('DELETE /api/assessments/questions/:id - Delete Question', () => {
      it('should delete question from template', async () => {
        const response = await request(app)
          .delete(`/api/assessments/questions/${createdQuestionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deletion
        const template = await request(app)
          .get(`/api/assessments/templates/${createdTemplateId}`)
          .expect(200);

        const questionExists = template.body.questions.some(
          q => q.id === createdQuestionId
        );
        expect(questionExists).toBe(false);
      });

      it('should handle deletion of non-existent question', async () => {
        const response = await request(app)
          .delete('/api/assessments/questions/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('3. AI Question Generation', () => {
    describe('POST /api/assessments/ai/generate-questions', () => {
      it('should generate questions for Big Five assessment', async () => {
        const request_data = {
          type: 'big_five',
          count: 5,
          language: 'it',
          difficulty: 'medium',
          suggestedRoles: ['Developer', 'Manager'],
          description: 'Test assessment for software development team'
        };

        const response = await request(app)
          .post('/api/assessments/ai/generate-questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(request_data)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('questions');
        expect(response.body.data.questions).toBeInstanceOf(Array);
        expect(response.body.data.metadata.type).toBe('big-five');
        expect(response.body.data.metadata.language).toBe('it');
      });

      it('should generate questions for DISC assessment', async () => {
        const request_data = {
          type: 'disc',
          count: 4,
          language: 'it',
          difficulty: 'easy',
          context: 'Sales team assessment'
        };

        const response = await request(app)
          .post('/api/assessments/ai/generate-questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(request_data)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.questions).toBeInstanceOf(Array);
      });

      it('should generate questions for Belbin assessment', async () => {
        const request_data = {
          type: 'belbin',
          count: 3,
          language: 'it',
          suggestedRoles: ['Team Leader']
        };

        const response = await request(app)
          .post('/api/assessments/ai/generate-questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(request_data)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.questions).toBeInstanceOf(Array);
      });

      it('should validate assessment type', async () => {
        const response = await request(app)
          .post('/api/assessments/ai/generate-questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'invalid_type',
            count: 5
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/assessments/ai/generate-questions')
          .send({ type: 'big_five', count: 5 })
          .expect(401);
      });
    });

    describe('POST /api/assessments/templates/:id/regenerate', () => {
      it('should regenerate questions for existing template', async () => {
        const response = await request(app)
          .post(`/api/assessments/templates/${createdTemplateId}/regenerate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            count: 3,
            preserveExisting: false
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/assessments/ai/providers', () => {
      it('should return available AI providers', async () => {
        const response = await request(app)
          .get('/api/assessments/ai/providers')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('providers');
        expect(response.body.providers).toBeInstanceOf(Array);
      });
    });

    describe('GET /api/assessments/ai/assessment-types', () => {
      it('should return supported assessment types', async () => {
        const response = await request(app)
          .get('/api/assessments/ai/assessment-types')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('types');
        expect(response.body.types).toBeInstanceOf(Array);
        expect(response.body.types).toContain('big-five');
        expect(response.body.types).toContain('disc');
        expect(response.body.types).toContain('belbin');
      });
    });

    describe('GET /api/assessments/ai/test-connection', () => {
      it('should test AI service connection', async () => {
        const response = await request(app)
          .get('/api/assessments/ai/test-connection')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('provider');
      });
    });
  });

  describe('4. Template Selection and Tenant Management', () => {
    describe('POST /api/assessments/select', () => {
      it('should select template for tenant', async () => {
        const selection = {
          templateId: createdTemplateId,
          tenantId: 'test-tenant-e2e',
          configuration: {
            timeLimit: 60,
            passingScore: 70,
            randomizeQuestions: true,
            showResults: true
          }
        };

        const response = await request(app)
          .post('/api/assessments/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send(selection)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
      });

      it('should validate template exists', async () => {
        const response = await request(app)
          .post('/api/assessments/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateId: 'non-existent-template',
            tenantId: 'test-tenant'
          })
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/assessments/tenant/:tenantId', () => {
      it('should get tenant template selections', async () => {
        const response = await request(app)
          .get('/api/assessments/tenant/test-tenant-e2e')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });
  });

  describe('5. Statistics and Analytics', () => {
    describe('GET /api/assessments/statistics', () => {
      it('should return assessment statistics', async () => {
        const response = await request(app)
          .get('/api/assessments/statistics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalTemplates');
        expect(response.body.data).toHaveProperty('totalQuestions');
        expect(response.body.data).toHaveProperty('templatesByType');
      });
    });
  });

  describe('6. Delete Operations', () => {
    describe('DELETE /api/assessments/templates/:id', () => {
      it('should delete template and cascade to questions', async () => {
        const response = await request(app)
          .delete(`/api/assessments/templates/${duplicatedTemplateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deletion
        await request(app)
          .get(`/api/assessments/templates/${duplicatedTemplateId}`)
          .expect(404);
      });

      it('should require authentication for deletion', async () => {
        await request(app)
          .delete(`/api/assessments/templates/${createdTemplateId}`)
          .expect(401);
      });

      it('should handle deletion of non-existent template', async () => {
        const response = await request(app)
          .delete('/api/assessments/templates/non-existent-template')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('7. Error Handling and Edge Cases', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 'test-user', email: 'test@example.com' },
        process.env.JWT_ACCESS_SECRET || 'test-secret',
        { expiresIn: '0s' }
      );

      await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ name: 'Test', type: 'big_five' })
        .expect(401);
    });

    it('should handle invalid token', async () => {
      await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test', type: 'big_five' })
        .expect(401);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/assessments/templates?page=-1&limit=0')
        .expect(200);

      // Should use default values for invalid pagination
      expect(response.body.page).toBeGreaterThan(0);
      expect(response.body.templates).toBeInstanceOf(Array);
    });

    it('should handle concurrent template updates', async () => {
      // Create a template for concurrent update test
      const template = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Concurrent Test Template',
          type: 'disc',
          description: 'For concurrent update testing'
        })
        .expect(200);

      const templateId = template.body.id;
      testTemplates.push(templateId);

      // Attempt concurrent updates
      const updates = [
        request(app)
          .put(`/api/assessments/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Update 1' }),
        request(app)
          .put(`/api/assessments/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Update 2' }),
        request(app)
          .put(`/api/assessments/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'Update 3' })
      ];

      const results = await Promise.all(updates);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    });
  });

  describe('8. Integration with Multiple Operations', () => {
    it('should handle complete template lifecycle', async () => {
      // 1. Create template with AI-generated questions
      const aiQuestions = await request(app)
        .post('/api/assessments/ai/generate-questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'belbin',
          count: 3,
          language: 'it'
        })
        .expect(200);

      const questions = aiQuestions.body.data.questions;

      // 2. Create template with generated questions
      const templateResponse = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Lifecycle Test Template',
          type: 'belbin',
          description: 'Complete lifecycle test',
          questions: questions
        })
        .expect(200);

      const templateId = templateResponse.body.id;
      testTemplates.push(templateId);

      // 3. Add more questions
      await request(app)
        .post(`/api/assessments/templates/${templateId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Additional question for lifecycle test',
          type: 'scale',
          orderIndex: questions.length,
          required: true
        })
        .expect(200);

      // 4. Duplicate template
      const duplicateResponse = await request(app)
        .post(`/api/assessments/templates/${templateId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Lifecycle Test - Copy'
        })
        .expect(200);

      testTemplates.push(duplicateResponse.body.id);

      // 5. Update original template
      await request(app)
        .put(`/api/assessments/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isActive: false,
          description: 'Updated after duplication'
        })
        .expect(200);

      // 6. Select for tenant
      await request(app)
        .post('/api/assessments/select')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateId: duplicateResponse.body.id,
          tenantId: 'lifecycle-test-tenant'
        })
        .expect(200);

      // 7. Get statistics
      const stats = await request(app)
        .get('/api/assessments/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stats.body.success).toBe(true);

      // 8. Clean up both templates
      await request(app)
        .delete(`/api/assessments/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .delete(`/api/assessments/templates/${duplicateResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});