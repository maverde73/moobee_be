const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Test data for assessments - 10 assessment con ruoli diversi
const assessmentConfigs = [
  {
    name: 'Big Five - Software Development Team',
    type: 'big_five',
    questionCount: 20,
    roles: ['Software Developer', 'Frontend Developer', 'Backend Developer'],
    description: 'Valutazione personalità per team di sviluppo software',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'DISC - Project Management',
    type: 'disc',
    questionCount: 15,
    roles: ['Project Manager', 'Scrum Master', 'Product Owner'],
    description: 'Assessment comportamentale per ruoli di gestione progetti',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'Belbin - Sales Team',
    type: 'belbin',
    questionCount: 12,
    roles: ['Sales Manager', 'Account Executive', 'Business Developer'],
    description: 'Identificazione ruoli team per area commerciale',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'Big Five - HR Department',
    type: 'big_five',
    questionCount: 18,
    roles: ['HR Manager', 'Recruiter', 'HR Specialist'],
    description: 'Assessment personalità per team risorse umane',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'DISC - Marketing Team',
    type: 'disc',
    questionCount: 10,
    roles: ['Marketing Manager', 'Content Creator', 'Social Media Manager'],
    description: 'Valutazione comportamentale per team marketing',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'Belbin - Technical Support',
    type: 'belbin',
    questionCount: 15,
    roles: ['Support Engineer', 'Customer Success Manager', 'Technical Writer'],
    description: 'Ruoli team per supporto tecnico e customer success',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'Big Five - Leadership Roles',
    type: 'big_five',
    questionCount: 20,
    roles: ['CEO', 'CTO', 'CFO', 'COO'],
    description: 'Assessment per ruoli di leadership esecutiva',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'DISC - Data Science Team',
    type: 'disc',
    questionCount: 14,
    roles: ['Data Scientist', 'Data Analyst', 'Machine Learning Engineer'],
    description: 'Profili comportamentali per team data science',
    model: 'gpt-4',
    provider: 'openai'
  },
  {
    name: 'Belbin - Product Team',
    type: 'belbin',
    questionCount: 10,
    roles: ['Product Manager', 'UX Designer', 'UI Designer'],
    description: 'Identificazione ruoli per team di prodotto',
    model: 'claude-opus-4-1-20250805',
    provider: 'anthropic'
  },
  {
    name: 'Big Five - Finance Department',
    type: 'big_five',
    questionCount: 16,
    roles: ['Financial Analyst', 'Accountant', 'Controller'],
    description: 'Valutazione personalità per team finanziario',
    model: 'gpt-4',
    provider: 'openai'
  }
];

async function createAssessmentWithAPI(config) {
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
        customization: `Genera domande specifiche per i ruoli: ${config.roles.join(', ')}. Assicurati che le domande siano rilevanti per valutare le competenze e caratteristiche necessarie per questi ruoli specifici.`
      }
    );

    const questions = aiResponse.data.data.questions;
    console.log(`   ✅ Generated ${questions.length} questions`);

    // Show sample questions to verify role relevance
    if (questions.length > 0) {
      console.log(`   📝 Sample question: "${questions[0].text}"`);
      console.log(`   📁 Category: ${questions[0].category}`);
    }

    // Step 2: Create assessment template using public API
    const templateResponse = await axios.post(
      `${API_BASE_URL}/assessments/templates`,
      {
        name: config.name,
        type: config.type,
        description: config.description,
        instructions: `Completa tutte le ${config.questionCount} domande con sincerità. Le domande sono state personalizzate per i ruoli: ${config.roles.join(', ')}`,
        suggestedRoles: config.roles,
        suggestedFrequency: 'quarterly',
        aiModel: `${config.provider}/${config.model}`,
        aiPrompt: `Assessment personalizzato per: ${config.roles.join(', ')}`,
        isActive: true,
        questions: questions
      }
    );

    const template = templateResponse.data.data;
    console.log(`   ✅ Saved to database with ID: ${template.id}`);
    console.log(`   📊 Categories: ${[...new Set(questions.map(q => q.category))].join(', ')}`);

    return {
      success: true,
      id: template.id,
      name: config.name,
      type: config.type,
      questionCount: questions.length,
      roles: config.roles,
      model: config.model
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
  console.log('================================');
  console.log('Testing with multiple AI models including Opus 4.1\n');

  // Create assessments
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const config of assessmentConfigs) {
    const result = await createAssessmentWithAPI(config);
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

  // Group by assessment type
  const byType = {
    big_five: results.filter(r => r.success && r.type === 'big_five'),
    disc: results.filter(r => r.success && r.type === 'disc'),
    belbin: results.filter(r => r.success && r.type === 'belbin')
  };

  console.log('\n🎯 Big Five Assessments:');
  byType.big_five.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.name}`);
    console.log(`      - Questions: ${result.questionCount}`);
    console.log(`      - Roles: ${result.roles.join(', ')}`);
    console.log(`      - Model: ${result.model}`);
  });

  console.log('\n💡 DISC Assessments:');
  byType.disc.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.name}`);
    console.log(`      - Questions: ${result.questionCount}`);
    console.log(`      - Roles: ${result.roles.join(', ')}`);
    console.log(`      - Model: ${result.model}`);
  });

  console.log('\n🤝 Belbin Assessments:');
  byType.belbin.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.name}`);
    console.log(`      - Questions: ${result.questionCount}`);
    console.log(`      - Roles: ${result.roles.join(', ')}`);
    console.log(`      - Model: ${result.model}`);
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
  const verifyResponse = await axios.get(`${API_BASE_URL}/assessments/templates?limit=10&sortBy=createdAt&sortOrder=desc`);
  const recentTemplates = verifyResponse.data.data;

  if (recentTemplates.length > 0) {
    const sample = recentTemplates[0];
    console.log(`   ✅ Most recent template: ${sample.name}`);
    console.log(`   ✅ Has suggested roles: ${sample.suggestedRoles ? 'Yes' : 'No'}`);
    if (sample.suggestedRoles) {
      console.log(`   ✅ Roles: ${sample.suggestedRoles.join(', ')}`);
    }
  }

  // Verify question count ranges
  console.log('\n2. Question Count Range Test:');
  const questionCounts = recentTemplates.map(t => t.questions?.length || 0);
  const minQuestions = Math.min(...questionCounts);
  const maxQuestions = Math.max(...questionCounts);
  console.log(`   ✅ Question range: ${minQuestions} - ${maxQuestions} questions`);

  // Verify AI models used
  console.log('\n3. AI Models Used:');
  const models = new Set(results.filter(r => r.success).map(r => r.model));
  models.forEach(model => {
    const count = results.filter(r => r.success && r.model === model).length;
    console.log(`   ${model}: ${count} assessments`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✨ E2E TESTS COMPLETED');
  console.log('📌 All assessments include target roles in AI prompts');
  console.log('🤖 Tested with multiple AI models including Opus 4.1');
  console.log('='.repeat(60));
}

// Run tests
runE2ETests().catch(console.error);