/**
 * Integration Tests for Assessment API
 */

const request = require('supertest');
const app = require('../../src/server');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Generate test token
const generateToken = (user = {}) => {
  return jwt.sign(
    {
      id: user.id || 'test-user',
      email: user.email || 'test@example.com',
      role: user.role || 'admin',
      tenantId: user.tenantId || 'test-tenant'
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
};

describe('Assessment API Integration Tests', () => {
  let authToken;
  let testTemplateId;

  beforeAll(async () => {
    authToken = generateToken();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/assessments/templates', () => {
    it('should return templates without authentication', async () => {
      const response = await request(app)
        .get('/api/assessments/templates')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/assessments/templates?page=1&limit=5')
        .expect(200);

      expect(response.body.templates).toBeInstanceOf(Array);
      expect(response.body.templates.length).toBeLessThanOrEqual(5);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/assessments/templates?type=big_five')
        .expect(200);

      response.body.templates.forEach(template => {
        expect(template.type).toBe('big_five');
      });
    });
  });

  describe('POST /api/assessments/templates', () => {
    it('should create template with authentication', async () => {
      const newTemplate = {
        name: 'Integration Test Assessment',
        type: 'custom',
        description: 'Created in integration test',
        questions: [
          {
            text: 'Test question 1?',
            type: 'single_choice',
            order: 1,
            required: true,
            options: [
              { text: 'Option A', value: 1 },
              { text: 'Option B', value: 2 }
            ]
          },
          {
            text: 'Rate your experience',
            type: 'scale',
            order: 2,
            required: true,
            minValue: 1,
            maxValue: 5
          }
        ]
      };

      const response = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newTemplate)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newTemplate.name);
      expect(response.body.type).toBe(newTemplate.type);

      testTemplateId = response.body.id;
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/assessments/templates')
        .send({ name: 'Test', type: 'custom' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Missing required fields' })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should validate assessment type', async () => {
      const response = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test', type: 'invalid_type' })
        .expect(400);

      expect(response.body.error).toContain('Invalid assessment type');
    });
  });

  describe('GET /api/assessments/templates/:id', () => {
    it('should return template by id', async () => {
      const response = await request(app)
        .get(`/api/assessments/templates/${testTemplateId}`)
        .expect(200);

      expect(response.body.id).toBe(testTemplateId);
      expect(response.body).toHaveProperty('questions');
    });

    it('should return 404 for non-existent template', async () => {
      await request(app)
        .get('/api/assessments/templates/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /api/assessments/templates/:id', () => {
    it('should update template', async () => {
      const updates = {
        name: 'Updated Test Assessment',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/assessments/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.description).toBe(updates.description);
    });

    it('should reject without authentication', async () => {
      await request(app)
        .put(`/api/assessments/templates/${testTemplateId}`)
        .send({ name: 'Unauthorized Update' })
        .expect(401);
    });
  });

  describe('POST /api/assessments/select', () => {
    it('should select template for tenant', async () => {
      const selection = {
        templateId: testTemplateId,
        tenantId: 'test-tenant',
        configuration: {
          timeLimit: 45,
          passingScore: 75,
          randomizeQuestions: true
        }
      };

      const response = await request(app)
        .post('/api/assessments/select')
        .set('Authorization', `Bearer ${authToken}`)
        .send(selection)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.templateId).toBe(testTemplateId);
      expect(response.body.tenantId).toBe('test-tenant');
    });

    it('should validate template exists', async () => {
      const response = await request(app)
        .post('/api/assessments/select')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateId: 'non-existent',
          tenantId: 'test-tenant'
        })
        .expect(404);

      expect(response.body.error).toContain('Template not found');
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/assessments/analytics/overview', () => {
      it('should return analytics overview', async () => {
        const response = await request(app)
          .get('/api/assessments/analytics/overview?range=30d')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('overview');
        expect(response.body).toHaveProperty('usage');
        expect(response.body).toHaveProperty('performance');
        expect(response.body).toHaveProperty('ai');
      });
    });

    describe('GET /api/assessments/analytics/activity', () => {
      it('should return recent activity', async () => {
        const response = await request(app)
          .get('/api/assessments/analytics/activity?limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeLessThanOrEqual(5);
      });
    });

    describe('GET /api/assessments/analytics/export', () => {
      it('should export analytics as JSON', async () => {
        const response = await request(app)
          .get('/api/assessments/analytics/export?range=30d&format=json')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
      });

      it('should export analytics as CSV', async () => {
        const response = await request(app)
          .get('/api/assessments/analytics/export?range=30d&format=csv')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
      });
    });
  });

  describe('DELETE /api/assessments/templates/:id', () => {
    it('should delete template', async () => {
      await request(app)
        .delete(`/api/assessments/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/assessments/templates/${testTemplateId}`)
        .expect(404);
    });

    it('should reject without authentication', async () => {
      await request(app)
        .delete('/api/assessments/templates/some-id')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/assessments/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error by disconnecting
      await prisma.$disconnect();

      const response = await request(app)
        .get('/api/assessments/templates')
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Reconnect for other tests
      await prisma.$connect();
    });
  });
});