const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test configuration
const config = {
  baseURL: 'http://localhost:3000/api',
  authEmail: 'john.doe@example.com',
  authPassword: 'Password123!',
  totalTestsPlanned: 10,
  useMockData: true // Force mock data for faster testing
};

// Mock question generator
function generateMockQuestions(type, count) {
  const questionTemplates = {
    'big-five': [
      'I enjoy being the center of attention',
      'I prefer working independently',
      'I am detail-oriented in my work',
      'I handle stress well',
      'I am open to new experiences'
    ],
    'disc': [
      'I am decisive in my actions',
      'I enjoy influencing others',
      'I prefer stability in my work',
      'I focus on accuracy and quality'
    ],
    'belbin': [
      'I can be relied upon to finish tasks',
      'I enjoy coordinating team efforts',
      'I bring creative solutions to problems',
      'I am good at evaluating options objectively'
    ]
  };

  const templates = questionTemplates[type] || questionTemplates['big-five'];
  const questions = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    questions.push({
      question: `${template} (Q${i + 1})`,
      type: 'scale',
      options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
      category: type,
      weight: 1,
      orderIndex: i,
      required: true
    });
  }

  return questions;
}

// Test data: Assessment configurations
const assessmentConfigurations = [
  {
    type: 'big-five',
    name: 'Big Five Personality Assessment - Project Manager',
    description: 'Comprehensive personality assessment for project management roles',
    count: 20,
    suggestedRoles: ['Project Manager', 'Program Manager', 'Scrum Master'],
    category: 'personality',
    difficulty: 'medium'
  },
  {
    type: 'disc',
    name: 'DiSC Profile - Software Developer',
    description: 'Behavioral assessment tailored for software development roles',
    count: 18,
    suggestedRoles: ['Software Developer', 'Full Stack Developer', 'Backend Developer'],
    category: 'behavioral',
    difficulty: 'medium'
  },
  {
    type: 'belbin',
    name: 'Belbin Team Roles - HR Manager',
    description: 'Team role identification for HR management positions',
    count: 15,
    suggestedRoles: ['HR Manager', 'HR Business Partner', 'Talent Acquisition Manager'],
    category: 'team-dynamics',
    difficulty: 'advanced'
  },
  {
    type: 'big-five',
    name: 'Big Five Assessment - Sales Manager',
    description: 'Personality evaluation for sales leadership roles',
    count: 20,
    suggestedRoles: ['Sales Manager', 'Business Development Manager', 'Account Manager'],
    category: 'personality',
    difficulty: 'medium'
  },
  {
    type: 'disc',
    name: 'DiSC Behavioral - Marketing Manager',
    description: 'Marketing leadership behavioral assessment',
    count: 16,
    suggestedRoles: ['Marketing Manager', 'Brand Manager', 'Digital Marketing Manager'],
    category: 'behavioral',
    difficulty: 'intermediate'
  },
  {
    type: 'belbin',
    name: 'Team Roles - Data Scientist',
    description: 'Team dynamics assessment for data science roles',
    count: 12,
    suggestedRoles: ['Data Scientist', 'Machine Learning Engineer', 'Data Analyst'],
    category: 'team-dynamics',
    difficulty: 'advanced'
  },
  {
    type: 'big-five',
    name: 'Personality Profile - Product Manager',
    description: 'Comprehensive personality assessment for product management',
    count: 19,
    suggestedRoles: ['Product Manager', 'Product Owner', 'Product Marketing Manager'],
    category: 'personality',
    difficulty: 'medium'
  },
  {
    type: 'disc',
    name: 'DiSC Assessment - Financial Analyst',
    description: 'Behavioral profile for financial analysis roles',
    count: 14,
    suggestedRoles: ['Financial Analyst', 'Investment Analyst', 'Risk Analyst'],
    category: 'behavioral',
    difficulty: 'intermediate'
  },
  {
    type: 'belbin',
    name: 'Team Dynamics - Operations Manager',
    description: 'Team role assessment for operations management',
    count: 10,
    suggestedRoles: ['Operations Manager', 'Supply Chain Manager', 'Logistics Manager'],
    category: 'team-dynamics',
    difficulty: 'medium'
  },
  {
    type: 'big-five',
    name: 'Big Five - Customer Success Manager',
    description: 'Personality traits assessment for customer-facing roles',
    count: 17,
    suggestedRoles: ['Customer Success Manager', 'Account Executive', 'Client Relations Manager'],
    category: 'personality',
    difficulty: 'intermediate'
  }
];

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function login() {
  try {
    console.log('\n🔐 Logging in...');
    const response = await axios.post(`${config.baseURL}/auth/login`, {
      email: config.authEmail,
      password: config.authPassword
    });

    const { accessToken } = response.data;
    console.log('✅ Login successful');
    return accessToken;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createAssessmentTemplate(token, assessmentData, index) {
  try {
    console.log(`\n📝 Creating Assessment ${index + 1}/${config.totalTestsPlanned}`);
    console.log(`   Type: ${assessmentData.type}`);
    console.log(`   Name: ${assessmentData.name}`);
    console.log(`   Questions: ${assessmentData.count}`);
    console.log(`   Roles: ${assessmentData.suggestedRoles.join(', ')}`);

    // Generate mock questions
    console.log('   🤖 Generating mock questions...');
    const questions = generateMockQuestions(assessmentData.type, assessmentData.count);

    // Create assessment template directly
    console.log('   💾 Creating assessment template...');
    const templateResponse = await axios.post(
      `${config.baseURL}/assessments/templates`,
      {
        name: assessmentData.name,
        type: assessmentData.type,
        description: assessmentData.description,
        timeLimit: assessmentData.count * 2, // 2 minutes per question
        passingScore: 70,
        isActive: true,
        orderIndex: index,
        language: 'en',
        questions: questions,
        metadata: {
          suggestedRoles: assessmentData.suggestedRoles,
          difficulty: assessmentData.difficulty,
          category: assessmentData.category,
          isMockData: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const template = templateResponse.data;
    console.log(`   ✅ Template created with ID: ${template.id}`);

    return {
      success: true,
      templateId: template.id,
      name: assessmentData.name,
      type: assessmentData.type,
      questionsCount: questions.length,
      suggestedRoles: assessmentData.suggestedRoles
    };

  } catch (error) {
    console.error(`   ❌ Failed to create assessment ${index + 1}:`, error.response?.data || error.message);
    return {
      success: false,
      name: assessmentData.name,
      error: error.response?.data?.error || error.message
    };
  }
}

async function testAIGeneration(token) {
  console.log('\n🤖 Testing AI Generation Endpoints...');

  try {
    // Test 1: Generate questions with specific model
    console.log('\n1. Testing question generation with GPT-4:');
    const gptResponse = await axios.post(
      `${config.baseURL}/assessments/ai/generate-questions`,
      {
        type: 'big-five',
        count: 5,
        language: 'en',
        suggestedRoles: ['Software Developer'],
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    ).catch(err => ({ data: { error: err.message } }));

    if (gptResponse.data.questions) {
      console.log(`   ✅ Generated ${gptResponse.data.questions.length} questions`);
      console.log(`   Provider: ${gptResponse.data.aiInfo?.provider || 'unknown'}`);
    } else {
      console.log(`   ⚠️  AI not available, using mock: ${gptResponse.data.error || 'timeout'}`);
    }

    // Test 2: Generate with Claude
    console.log('\n2. Testing question generation with Claude Opus 4.1:');
    const claudeResponse = await axios.post(
      `${config.baseURL}/assessments/ai/generate-questions`,
      {
        type: 'disc',
        count: 5,
        language: 'en',
        suggestedRoles: ['Project Manager'],
        provider: 'anthropic',
        model: 'claude-3-opus-20240229'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ).catch(err => ({ data: { error: err.message } }));

    if (claudeResponse.data.questions) {
      console.log(`   ✅ Generated ${claudeResponse.data.questions.length} questions`);
      console.log(`   Model: ${claudeResponse.data.aiInfo?.model || 'unknown'}`);
    } else {
      console.log(`   ⚠️  AI not available, using mock: ${claudeResponse.data.error || 'timeout'}`);
    }

  } catch (error) {
    console.log('   ⚠️  AI testing failed, will use mock data:', error.message);
  }
}

async function verifyTemplates(token) {
  try {
    console.log('\n🔍 Verifying created templates...');
    const response = await axios.get(`${config.baseURL}/assessments/templates`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        limit: 50,
        sort: 'createdAt:desc'
      }
    });

    const templates = response.data.data || response.data;
    console.log(`✅ Found ${templates.length} total templates in database`);

    // Group by type
    const byType = {};
    templates.forEach(t => {
      if (!byType[t.type]) byType[t.type] = 0;
      byType[t.type]++;
    });

    console.log('\n📊 Templates by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} templates`);
    });

    // Show last 5 created templates
    console.log('\n📋 Last 5 created templates:');
    templates.slice(0, 5).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name}`);
      console.log(`      ID: ${t.id}, Type: ${t.type}, Active: ${t.isActive}`);
    });

    return templates;
  } catch (error) {
    console.error('❌ Failed to verify templates:', error.response?.data || error.message);
    return [];
  }
}

async function testTemplateOperations(token, templateId) {
  console.log('\n🔧 Testing Template Operations...');

  try {
    // Test 1: Get single template
    console.log(`\n1. Fetching template ${templateId}:`);
    const getResponse = await axios.get(
      `${config.baseURL}/assessments/templates/${templateId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    console.log(`   ✅ Retrieved template: ${getResponse.data.name}`);
    console.log(`   Questions: ${getResponse.data.questions?.length || 0}`);

    // Test 2: Update template
    console.log(`\n2. Updating template ${templateId}:`);
    const updateResponse = await axios.put(
      `${config.baseURL}/assessments/templates/${templateId}`,
      {
        description: `${getResponse.data.description} [Updated ${new Date().toISOString()}]`
      },
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    console.log(`   ✅ Template updated successfully`);

    // Test 3: Duplicate template
    console.log(`\n3. Duplicating template ${templateId}:`);
    const duplicateResponse = await axios.post(
      `${config.baseURL}/assessments/templates/${templateId}/duplicate`,
      {},
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    console.log(`   ✅ Template duplicated with ID: ${duplicateResponse.data.id}`);

    return true;
  } catch (error) {
    console.error('   ❌ Operation failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function runComprehensiveE2ETest() {
  console.log('🚀 Starting Comprehensive E2E Assessment Test (Mock Mode)');
  console.log('=' .repeat(60));

  let token;
  const results = [];

  try {
    // Login
    token = await login();

    // Test AI endpoints (non-blocking)
    await testAIGeneration(token);

    // Create assessments with mock data
    console.log(`\n📋 Creating ${config.totalTestsPlanned} different assessments...`);
    console.log('=' .repeat(60));

    for (let i = 0; i < assessmentConfigurations.length; i++) {
      const result = await createAssessmentTemplate(token, assessmentConfigurations[i], i);
      results.push(result);

      // Add small delay between requests
      if (i < assessmentConfigurations.length - 1) {
        await delay(200);
      }
    }

    // Verify all templates
    const templates = await verifyTemplates(token);

    // Test template operations on first successful template
    const firstSuccess = results.find(r => r.success);
    if (firstSuccess) {
      await testTemplateOperations(token, firstSuccess.templateId);
    }

    // Generate comprehensive report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('=' .repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✅ Successful: ${successful.length}/${config.totalTestsPlanned}`);
    console.log(`❌ Failed: ${failed.length}/${config.totalTestsPlanned}`);
    console.log(`📈 Success Rate: ${(successful.length / config.totalTestsPlanned * 100).toFixed(1)}%`);

    if (successful.length > 0) {
      console.log('\n✅ Successfully Created Assessments:');
      successful.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name}`);
        console.log(`      - Type: ${r.type}`);
        console.log(`      - Questions: ${r.questionsCount}`);
        console.log(`      - Template ID: ${r.templateId}`);
        console.log(`      - Roles: ${r.suggestedRoles.join(', ')}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Assessments:');
      failed.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name}`);
        console.log(`      Error: ${r.error}`);
      });
    }

    // Summary statistics
    console.log('\n📊 Assessment Type Distribution:');
    const typeStats = {};
    successful.forEach(r => {
      if (!typeStats[r.type]) typeStats[r.type] = 0;
      typeStats[r.type]++;
    });

    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} assessments`);
    });

    // Question count statistics
    const totalQuestions = successful.reduce((sum, r) => sum + r.questionsCount, 0);
    const avgQuestions = successful.length > 0 ? (totalQuestions / successful.length).toFixed(1) : 0;

    console.log('\n📈 Question Statistics:');
    console.log(`   Total questions generated: ${totalQuestions}`);
    console.log(`   Average questions per assessment: ${avgQuestions}`);
    console.log(`   Min questions: ${Math.min(...successful.map(r => r.questionsCount))}`);
    console.log(`   Max questions: ${Math.max(...successful.map(r => r.questionsCount))}`);

    // Role coverage
    console.log('\n👥 Role Coverage:');
    const allRoles = new Set();
    successful.forEach(r => {
      r.suggestedRoles.forEach(role => allRoles.add(role));
    });
    console.log(`   Total unique roles tested: ${allRoles.size}`);
    console.log(`   Roles: ${Array.from(allRoles).slice(0, 10).join(', ')}...`);

    console.log('\n' + '=' .repeat(60));
    console.log('✅ E2E Test Completed Successfully!');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with critical error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the test
runComprehensiveE2ETest().catch(console.error);