// Temporary fix for Prisma model name mismatch
// This file maps camelCase model names to snake_case equivalents

const { PrismaClient } = require('@prisma/client');

const originalPrismaClient = PrismaClient;

class PrismaClientWithAliases extends originalPrismaClient {
  constructor(options) {
    super(options);

    // Add camelCase aliases for snake_case models
    this.assessmentTemplate = this.assessment_templates;
    this.assessmentQuestion = this.assessment_questions;
    this.assessmentOption = this.assessment_options;

    // Add any other needed aliases
    console.log('✅ Prisma aliases configured');
  }
}

module.exports = { PrismaClient: PrismaClientWithAliases };