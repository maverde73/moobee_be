/**
 * Unit Tests for Assessment Controller
 */

const assessmentController = require('../../../src/controllers/assessmentController');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('AssessmentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: createMockUser()
    };

    res = {
      json: jest.fn(),
      status: jest.fn(() => res)
    };
  });

  describe('getAllTemplates', () => {
    it('should return all active templates', async () => {
      const mockTemplates = [
        createMockAssessment({ id: '1', name: 'Big Five' }),
        createMockAssessment({ id: '2', name: 'DiSC' })
      ];

      prisma.assessmentTemplate.findMany.mockResolvedValue(mockTemplates);
      prisma.assessmentTemplate.count.mockResolvedValue(2);

      await assessmentController.getAllTemplates(req, res);

      expect(prisma.assessmentTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' }
          }
        },
        skip: 0,
        take: 10
      });

      expect(res.json).toHaveBeenCalledWith({
        templates: mockTemplates,
        total: 2,
        page: 1,
        totalPages: 1
      });
    });

    it('should handle pagination parameters', async () => {
      req.query = { page: '2', limit: '5' };

      prisma.assessmentTemplate.findMany.mockResolvedValue([]);
      prisma.assessmentTemplate.count.mockResolvedValue(10);

      await assessmentController.getAllTemplates(req, res);

      expect(prisma.assessmentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
    });

    it('should filter by type when provided', async () => {
      req.query = { type: 'big_five' };

      prisma.assessmentTemplate.findMany.mockResolvedValue([]);
      prisma.assessmentTemplate.count.mockResolvedValue(0);

      await assessmentController.getAllTemplates(req, res);

      expect(prisma.assessmentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, type: 'big_five' }
        })
      );
    });

    it('should handle errors gracefully', async () => {
      prisma.assessmentTemplate.findMany.mockRejectedValue(
        new Error('Database error')
      );

      await assessmentController.getAllTemplates(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('getTemplateById', () => {
    it('should return template by id', async () => {
      const mockTemplate = createMockAssessment({
        id: 'template-1',
        questions: [createMockQuestion()]
      });

      req.params.id = 'template-1';
      prisma.assessmentTemplate.findUnique.mockResolvedValue(mockTemplate);

      await assessmentController.getTemplateById(req, res);

      expect(prisma.assessmentTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' }
          }
        }
      });

      expect(res.json).toHaveBeenCalledWith(mockTemplate);
    });

    it('should return 404 if template not found', async () => {
      req.params.id = 'non-existent';
      prisma.assessmentTemplate.findUnique.mockResolvedValue(null);

      await assessmentController.getTemplateById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Template not found'
      });
    });
  });

  describe('createTemplate', () => {
    it('should create new assessment template', async () => {
      const newTemplate = {
        name: 'New Assessment',
        type: 'custom',
        description: 'Test description',
        questions: [
          {
            text: 'Question 1',
            type: 'single_choice',
            options: [
              { text: 'Option 1', value: 1 },
              { text: 'Option 2', value: 2 }
            ]
          }
        ]
      };

      req.body = newTemplate;

      const createdTemplate = {
        ...newTemplate,
        id: 'new-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.$transaction.mockImplementation(callback =>
        callback({
          assessmentTemplate: {
            create: jest.fn().mockResolvedValue(createdTemplate)
          },
          assessmentQuestion: {
            create: jest.fn().mockResolvedValue({
              id: 'q1',
              ...newTemplate.questions[0]
            })
          },
          assessmentOption: {
            createMany: jest.fn()
          }
        })
      );

      await assessmentController.createTemplate(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-id',
          name: 'New Assessment'
        })
      );
    });

    it('should validate required fields', async () => {
      req.body = { type: 'custom' }; // Missing name

      await assessmentController.createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Name and type are required'
      });
    });

    it('should validate assessment type', async () => {
      req.body = {
        name: 'Test',
        type: 'invalid_type'
      };

      await assessmentController.createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid assessment type'
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update existing template', async () => {
      req.params.id = 'template-1';
      req.body = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const updatedTemplate = {
        id: 'template-1',
        ...req.body,
        updatedAt: new Date()
      };

      prisma.assessmentTemplate.update.mockResolvedValue(updatedTemplate);

      await assessmentController.updateTemplate(req, res);

      expect(prisma.assessmentTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description'
        })
      });

      expect(res.json).toHaveBeenCalledWith(updatedTemplate);
    });

    it('should handle non-existent template', async () => {
      req.params.id = 'non-existent';
      req.body = { name: 'Updated' };

      prisma.assessmentTemplate.update.mockRejectedValue({
        code: 'P2025'
      });

      await assessmentController.updateTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Template not found'
      });
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      req.params.id = 'template-1';

      prisma.assessmentTemplate.delete.mockResolvedValue({
        id: 'template-1'
      });

      await assessmentController.deleteTemplate(req, res);

      expect(prisma.assessmentTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' }
      });

      expect(res.json).toHaveBeenCalledWith({
        message: 'Template deleted successfully'
      });
    });

    it('should handle delete errors', async () => {
      req.params.id = 'template-1';

      prisma.assessmentTemplate.delete.mockRejectedValue(
        new Error('Cannot delete')
      );

      await assessmentController.deleteTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('selectTemplateForTenant', () => {
    it('should create tenant selection', async () => {
      req.body = {
        templateId: 'template-1',
        tenantId: 'tenant-1',
        configuration: {
          timeLimit: 60,
          passingScore: 70
        }
      };

      const selection = {
        id: 'selection-1',
        ...req.body,
        createdAt: new Date()
      };

      prisma.assessmentTemplate.findUnique.mockResolvedValue(
        createMockAssessment()
      );
      prisma.tenantAssessmentSelection.create.mockResolvedValue(selection);

      await assessmentController.selectTemplateForTenant(req, res);

      expect(prisma.tenantAssessmentSelection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          tenantId: 'tenant-1'
        })
      });

      expect(res.json).toHaveBeenCalledWith(selection);
    });

    it('should validate template exists', async () => {
      req.body = {
        templateId: 'non-existent',
        tenantId: 'tenant-1'
      };

      prisma.assessmentTemplate.findUnique.mockResolvedValue(null);

      await assessmentController.selectTemplateForTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Template not found'
      });
    });
  });
});