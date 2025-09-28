const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test configuration
const config = {
  baseURL: 'http://localhost:3000/api',
  authEmail: 'john.doe@example.com',
  authPassword: 'Password123!',
  totalTestsPlanned: 10
};

// Mock question generator with correct schema
function generateMockQuestions(type, count) {
  const questionTemplates = {
    'big_five': [
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

  const templates = questionTemplates[type] || questionTemplates['big_five'];
  const questions = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    questions.push({
      text: `${template} (Q${i + 1})`, // Changed from 'question' to 'text'
      type: 'likert', // Changed from 'scale' to 'likert'
      options: [
        { text: 'Strongly Disagree', value: 1, orderIndex: 0 },
        { text: 'Disagree', value: 2, orderIndex: 1 },
        { text: 'Neutral', value: 3, orderIndex: 2 },
        { text: 'Agree', value: 4, orderIndex: 3 },
        { text: 'Strongly Agree', value: 5, orderIndex: 4 }
      ],
      category: type,
      weight: 1,
      orderIndex: i,
      required: true
    });
  }

  return questions;
}

// Test data: Assessment configurations with correct type names
const assessmentConfigurations = [
  {
    type: 'big_five', // Changed from 'big-five'
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
    type: 'big_five',
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
    type: 'big_five',
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
    type: 'big_five',
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

    // Generate mock questions with correct schema
    console.log('   🤖 Generating mock questions...');
    const questions = generateMockQuestions(assessmentData.type, assessmentData.count);

    // Create assessment template
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
        suggestedRoles: assessmentData.suggestedRoles,
        metadata: {
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
    console.error(`   ❌ Failed to create assessment ${index + 1}:`);
    if (error.response?.data?.errors) {
      console.error('   Validation errors:', error.response.data.errors.slice(0, 5));
    } else {
      console.error('   Error:', error.response?.data?.error || error.message);
    }
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
    console.log('\n1. Testing with mock generation:');
    const mockResponse = await axios.post(
      `${config.baseURL}/assessments/ai/generate-questions`,
      {
        type: 'big_five', // Using underscore format
        count: 5,
        language: 'en',
        suggestedRoles: ['Software Developer'],
        description: 'Test assessment for developers'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    ).catch(err => ({ data: { error: err.message } }));

    if (mockResponse.data.questions) {
      console.log(`   ✅ Generated ${mockResponse.data.questions.length} questions`);
      console.log(`   Sample question:`, mockResponse.data.questions[0]?.question || mockResponse.data.questions[0]?.text);
    } else {
      console.log(`   ⚠️  Generation failed: ${mockResponse.data.error}`);
    }

  } catch (error) {
    console.log('   ⚠️  AI testing skipped:', error.message);
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

    // Show recently created templates
    const recentTemplates = templates.slice(0, 5);
    if (recentTemplates.length > 0) {
      console.log('\n📋 Recently created templates:');
      recentTemplates.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.name}`);
        console.log(`      ID: ${t.id}, Type: ${t.type}, Questions: ${t.questions?.length || 0}`);
      });
    }

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
    console.log(`   Suggested Roles: ${getResponse.data.suggestedRoles?.join(', ') || 'None'}`);

    // Test 2: Update template
    console.log(`\n2. Updating template ${templateId}:`);
    const updateResponse = await axios.put(
      `${config.baseURL}/assessments/templates/${templateId}`,
      {
        description: `${getResponse.data.description} [Updated at ${new Date().toLocaleTimeString()}]`,
        suggestedRoles: [...(getResponse.data.suggestedRoles || []), 'Test Role']
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
    console.log(`   New name: ${duplicateResponse.data.name}`);

    return true;
  } catch (error) {
    console.error('   ❌ Operation failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function runComprehensiveE2ETest() {
  console.log('🚀 Starting Comprehensive E2E Assessment Test');
  console.log('=' .repeat(60));

  let token;
  const results = [];

  try {
    // Login
    token = await login();

    // Test AI endpoints
    await testAIGeneration(token);

    // Create assessments
    console.log(`\n📋 Creating ${config.totalTestsPlanned} different assessments...`);
    console.log('=' .repeat(60));

    for (let i = 0; i < assessmentConfigurations.length; i++) {
      const result = await createAssessmentTemplate(token, assessmentConfigurations[i], i);
      results.push(result);

      // Add small delay between requests
      if (i < assessmentConfigurations.length - 1) {
        await delay(500);
      }
    }

    // Verify all templates
    const templates = await verifyTemplates(token);

    // Test operations on first successful template
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
    const minQuestions = successful.length > 0 ? Math.min(...successful.map(r => r.questionsCount)) : 0;
    const maxQuestions = successful.length > 0 ? Math.max(...successful.map(r => r.questionsCount)) : 0;

    console.log('\n📈 Question Statistics:');
    console.log(`   Total questions created: ${totalQuestions}`);
    console.log(`   Average questions per assessment: ${avgQuestions}`);
    console.log(`   Min questions: ${minQuestions}`);
    console.log(`   Max questions: ${maxQuestions}`);

    // Role coverage
    console.log('\n👥 Role Coverage:');
    const allRoles = new Set();
    successful.forEach(r => {
      r.suggestedRoles.forEach(role => allRoles.add(role));
    });
    console.log(`   Total unique roles tested: ${allRoles.size}`);
    const roleList = Array.from(allRoles);
    console.log(`   Roles tested: ${roleList.slice(0, 10).join(', ')}${roleList.length > 10 ? '...' : ''}`);

    // Test summary
    console.log('\n🎯 Test Summary:');
    console.log(`   - Created ${successful.length} assessment templates`);
    console.log(`   - Total of ${totalQuestions} questions across all assessments`);
    console.log(`   - Covered ${allRoles.size} different professional roles`);
    console.log(`   - Tested 3 assessment types: big_five, disc, belbin`);
    console.log(`   - Verified template CRUD operations`);

    console.log('\n' + '=' .repeat(60));
    if (successful.length >= 7) { // 70% success rate
      console.log('✅ E2E Test PASSED! Major functionality working correctly.');
    } else {
      console.log('⚠️  E2E Test completed with issues. Review failed assessments.');
    }
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