// Wrapper for Prisma Client to handle type conversions
const { PrismaClient } = require('@prisma/client');

class PrismaClientWrapper extends PrismaClient {
  constructor(options) {
    super(options);

    // Wrap assessmentTemplate model
    const originalAssessmentTemplate = this.assessmentTemplate;

    this.assessmentTemplate = {
      ...originalAssessmentTemplate,

      findUnique: async (args) => {
        // Convert string ID to number if needed
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentTemplate.findUnique.call(this.assessmentTemplate, args);
      },

      findMany: originalAssessmentTemplate.findMany.bind(originalAssessmentTemplate),
      create: originalAssessmentTemplate.create.bind(originalAssessmentTemplate),
      update: async (args) => {
        // Convert string ID to number if needed
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentTemplate.update.call(this.assessmentTemplate, args);
      },
      delete: async (args) => {
        // Convert string ID to number if needed
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentTemplate.delete.call(this.assessmentTemplate, args);
      },
      count: originalAssessmentTemplate.count.bind(originalAssessmentTemplate),
      aggregate: originalAssessmentTemplate.aggregate.bind(originalAssessmentTemplate),
      groupBy: originalAssessmentTemplate.groupBy.bind(originalAssessmentTemplate)
    };

    // Wrap assessmentQuestion model
    const originalAssessmentQuestion = this.assessmentQuestion;

    this.assessmentQuestion = {
      ...originalAssessmentQuestion,

      findUnique: async (args) => {
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        if (args?.where?.templateId && typeof args.where.templateId === 'string') {
          args.where.templateId = parseInt(args.where.templateId, 10);
        }
        return originalAssessmentQuestion.findUnique.call(this.assessmentQuestion, args);
      },

      findMany: async (args) => {
        if (args?.where?.templateId && typeof args.where.templateId === 'string') {
          args.where.templateId = parseInt(args.where.templateId, 10);
        }
        return originalAssessmentQuestion.findMany.call(this.assessmentQuestion, args);
      },

      create: originalAssessmentQuestion.create.bind(originalAssessmentQuestion),
      update: async (args) => {
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentQuestion.update.call(this.assessmentQuestion, args);
      },
      delete: async (args) => {
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentQuestion.delete.call(this.assessmentQuestion, args);
      },
      count: originalAssessmentQuestion.count.bind(originalAssessmentQuestion),
      aggregate: originalAssessmentQuestion.aggregate.bind(originalAssessmentQuestion),
      groupBy: originalAssessmentQuestion.groupBy.bind(originalAssessmentQuestion)
    };

    // Wrap assessmentOption model
    const originalAssessmentOption = this.assessmentOption;

    this.assessmentOption = {
      ...originalAssessmentOption,

      findUnique: async (args) => {
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        if (args?.where?.questionId && typeof args.where.questionId === 'string') {
          args.where.questionId = parseInt(args.where.questionId, 10);
        }
        return originalAssessmentOption.findUnique.call(this.assessmentOption, args);
      },

      findMany: async (args) => {
        if (args?.where?.questionId && typeof args.where.questionId === 'string') {
          args.where.questionId = parseInt(args.where.questionId, 10);
        }
        return originalAssessmentOption.findMany.call(this.assessmentOption, args);
      },

      create: originalAssessmentOption.create.bind(originalAssessmentOption),
      update: async (args) => {
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentOption.update.call(this.assessmentOption, args);
      },
      delete: async (args) => {
        if (args?.where?.id && typeof args.where.id === 'string') {
          args.where.id = parseInt(args.where.id, 10);
        }
        return originalAssessmentOption.delete.call(this.assessmentOption, args);
      },
      count: originalAssessmentOption.count.bind(originalAssessmentOption),
      aggregate: originalAssessmentOption.aggregate.bind(originalAssessmentOption),
      groupBy: originalAssessmentOption.groupBy.bind(originalAssessmentOption)
    };

    console.log('✅ Prisma Client wrapper initialized with type conversions');
  }
}

module.exports = { PrismaClient: PrismaClientWrapper };