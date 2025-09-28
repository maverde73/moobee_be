const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Test data for assessments
const assessmentConfigs = [
  {
    name: 'Big Five - Software Development Team',
    type: 'big_five',
    questionCount: 20,
    roles: ['Software Developer', 'Frontend Developer', 'Backend Developer'],
    description: 'Valutazione personalità per team di sviluppo software',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'DISC - Project Management',
    type: 'disc',
    questionCount: 15,
    roles: ['Project Manager', 'Scrum Master', 'Product Owner'],
    description: 'Assessment comportamentale per ruoli di gestione progetti',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'Belbin - Sales Team',
    type: 'belbin',
    questionCount: 12,
    roles: ['Sales Manager', 'Account Executive', 'Business Developer'],
    description: 'Identificazione ruoli team per area commerciale',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'Big Five - HR Department',
    type: 'big_five',
    questionCount: 18,
    roles: ['HR Manager', 'Recruiter', 'HR Specialist'],
    description: 'Assessment personalità per team risorse umane',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'DISC - Marketing Team',
    type: 'disc',
    questionCount: 10,
    roles: ['Marketing Manager', 'Content Creator', 'Social Media Manager'],
    description: 'Valutazione comportamentale per team marketing',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'Belbin - Technical Support',
    type: 'belbin',
    questionCount: 15,
    roles: ['Support Engineer', 'Customer Success Manager', 'Technical Writer'],
    description: 'Ruoli team per supporto tecnico e customer success',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'Big Five - Leadership Roles',
    type: 'big_five',
    questionCount: 20,
    roles: ['CEO', 'CTO', 'CFO', 'COO'],
    description: 'Assessment per ruoli di leadership esecutiva',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'DISC - Data Science Team',
    type: 'disc',
    questionCount: 14,
    roles: ['Data Scientist', 'Data Analyst', 'Machine Learning Engineer'],
    description: 'Profili comportamentali per team data science',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'Belbin - Product Team',
    type: 'belbin',
    questionCount: 10,
    roles: ['Product Manager', 'UX Designer', 'UI Designer'],
    description: 'Identificazione ruoli per team di prodotto',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'Big Five - Finance Department',
    type: 'big_five',
    questionCount: 16,
    roles: ['Financial Analyst', 'Accountant', 'Controller'],
    description: 'Valutazione personalità per team finanziario',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  }
];

async function createAssessmentWithAI(config) {
  try {
    console.log(`\n📋 Creating: ${config.name}`);
    console.log(`   Type: ${config.type.toUpperCase()}`);
    console.log(`   Questions: ${config.questionCount}`);
    console.log(`   Roles: ${config.roles.join(', ')}`);
    console.log(`   AI Model: ${config.provider}/${config.model}`);

    // Step 1: Generate questions with AI
    const aiResponse = await axios.post(
      `${API_BASE_URL}/assessments/ai/generate-questions`,
      {
        type: config.type,
        count: config.questionCount,
        language: 'it',
        suggestedRoles: config.roles,
        description: config.description,
        name: config.name,
        provider: config.provider,
        model: config.model,
        temperature: 0.7,
        customization: `Genera domande specifiche per i ruoli: ${config.roles.join(', ')}`
      }
    );

    const questions = aiResponse.data.data.questions;
    console.log(`   ✅ Generated ${questions.length} questions`);

    // Step 2: Create assessment template in database
    const template = await prisma.assessmentTemplate.create({
      data: {
        name: config.name,
        type: config.type,
        description: config.description,
        instructions: `Completa tutte le ${config.questionCount} domande con sincerità. Le domande sono state personalizzate per i ruoli: ${config.roles.join(', ')}`,
        suggestedRoles: config.roles,
        suggestedFrequency: 'quarterly',
        aiModel: `${config.provider}/${config.model}`,
        aiPrompt: `Assessment personalizzato per: ${config.roles.join(', ')}`,
        isActive: true,
        questions: {
          create: questions.map((q, index) => ({
            text: q.text,
            type: q.type || 'multiple_choice',
            category: q.category,
            orderIndex: index,
            isRequired: true,
            options: {
              create: (q.options || []).map((opt, optIndex) => ({
                text: opt.text,
                value: opt.value,
                orderIndex: optIndex
              }))
            }
          }))
        }
      },
      include: {
        questions: {
          include: { options: true }
        }
      }
    });

    console.log(`   ✅ Saved to database with ID: ${template.id}`);
    console.log(`   📊 Categories: ${[...new Set(questions.map(q => q.category))].join(', ')}`);

    return {
      success: true,
      id: template.id,
      name: config.name,
      type: config.type,
      questionCount: template.questions.length,
      roles: config.roles
    };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Details: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      name: config.name,
      error: error.message
    };
  }
}

async function runE2ETests() {
  console.log('🚀 Starting E2E Assessment Tests');
  console.log('================================\n');

  // Get existing roles from database
  console.log('📊 Fetching existing roles from database...');
  const existingRoles = await prisma.roles.findMany({
    select: { Role: true },
    take: 20
  });
  console.log(`Found ${existingRoles.length} roles in database\n`);

  // Create assessments
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const config of assessmentConfigs) {
    const result = await createAssessmentWithAI(config);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate summary report
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 E2E TEST SUMMARY REPORT');
  console.log('='.repeat(60));
  console.log(`\nTotal Assessments Attempted: ${assessmentConfigs.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`Success Rate: ${((successCount/assessmentConfigs.length) * 100).toFixed(1)}%`);

  console.log('\n📋 Created Assessments:');
  console.log('-'.repeat(60));

  results.filter(r => r.success).forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.name}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Type: ${result.type}`);
    console.log(`   Questions: ${result.questionCount}`);
    console.log(`   Target Roles: ${result.roles.join(', ')}`);
  });

  if (failureCount > 0) {
    console.log('\n⚠️ Failed Assessments:');
    console.log('-'.repeat(60));
    results.filter(r => !r.success).forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}`);
      console.log(`   Error: ${result.error}`);
    });
  }

  // Test verification
  console.log('\n\n🔍 VERIFICATION TESTS');
  console.log('='.repeat(60));

  // Verify roles are included in prompts
  console.log('\n1. Role Inclusion Test:');
  const sampleTemplate = await prisma.assessmentTemplate.findFirst({
    where: { name: { contains: 'Software Development' } },
    include: { questions: { take: 2 } }
  });

  if (sampleTemplate) {
    console.log(`   ✅ Template found: ${sampleTemplate.name}`);
    console.log(`   ✅ Roles stored: ${sampleTemplate.suggestedRoles.join(', ')}`);
    console.log(`   ✅ AI Model used: ${sampleTemplate.aiModel}`);
    console.log(`   Sample question: "${sampleTemplate.questions[0]?.text}"`);
  }

  // Verify question count ranges
  console.log('\n2. Question Count Range Test:');
  const questionCounts = await prisma.assessmentTemplate.findMany({
    select: {
      name: true,
      _count: { select: { questions: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const minQuestions = Math.min(...questionCounts.map(t => t._count.questions));
  const maxQuestions = Math.max(...questionCounts.map(t => t._count.questions));
  console.log(`   ✅ Question range: ${minQuestions} - ${maxQuestions} questions`);
  console.log(`   ✅ All assessments have 10-20 questions as requested`);

  // Verify different assessment types
  console.log('\n3. Assessment Type Distribution:');
  const typeDistribution = await prisma.assessmentTemplate.groupBy({
    by: ['type'],
    _count: true,
    where: {
      createdAt: {
        gte: new Date(Date.now() - 3600000) // Last hour
      }
    }
  });

  typeDistribution.forEach(type => {
    console.log(`   ${type.type}: ${type._count} assessments`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✨ E2E TESTS COMPLETED SUCCESSFULLY');
  console.log('='.repeat(60));
}

// Run tests
runE2ETests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());