/**
 * Test Setup Configuration
 * Configures Jest environment for testing
 */

const { PrismaClient } = require('@prisma/client');

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    assessmentTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    assessmentQuestion: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn()
    },
    assessmentOption: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn()
    },
    tenantAssessmentSelection: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    },
    assessmentResponse: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    },
    $transaction: jest.fn(callback => callback(mockPrismaClient))
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient)
  };
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// Add custom matchers
expect.extend({
  toBeValidAssessment(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      received.id &&
      received.name &&
      received.type &&
      ['big_five', 'disc', 'belbin', 'competency', 'custom'].includes(received.type);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid assessment`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid assessment`,
        pass: false
      };
    }
  },

  toBeValidQuestion(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      received.id &&
      received.text &&
      received.type &&
      ['single_choice', 'multiple_choice', 'scale', 'open_text'].includes(received.type);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid question`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid question`,
        pass: false
      };
    }
  }
});

// Global test utilities
global.createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  tenantId: 'test-tenant-id',
  ...overrides
});

global.createMockAssessment = (overrides = {}) => ({
  id: 'test-assessment-id',
  name: 'Test Assessment',
  type: 'big_five',
  description: 'Test assessment description',
  isActive: true,
  questions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

global.createMockQuestion = (overrides = {}) => ({
  id: 'test-question-id',
  text: 'Test question?',
  type: 'single_choice',
  order: 1,
  required: true,
  options: [],
  ...overrides
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});