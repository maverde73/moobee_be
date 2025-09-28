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

// Test data: Assessment configurations
const assessmentConfigurations = [
  {
    type: 'big-five',
    name: 'Big Five Personality Assessment - Project Manager',
    description: 'Comprehensive personality assessment for project management roles',
    count: 20,
    suggestedRoles: ['Project Manager', 'Program Manager', 'Scrum Master'],
    category: 'personality',
    difficulty: 'medium',
    model: 'gpt-4'
  },
  {
    type: 'disc',
    name: 'DiSC Profile - Software Developer',
    description: 'Behavioral assessment tailored for software development roles',
    count: 18,
    suggestedRoles: ['Software Developer', 'Full Stack Developer', 'Backend Developer'],
    category: 'behavioral',
    difficulty: 'medium',
    model: 'claude-3-opus-20240229'
  },
  {
    type: 'belbin',
    name: 'Belbin Team Roles - HR Manager',
    description: 'Team role identification for HR management positions',
    count: 15,
    suggestedRoles: ['HR Manager', 'HR Business Partner', 'Talent Acquisition Manager'],
    category: 'team-dynamics',
    difficulty: 'advanced',
    provider: 'anthropic'
  },
  {
    type: 'big-five',
    name: 'Big Five Assessment - Sales Manager',
    description: 'Personality evaluation for sales leadership roles',
    count: 20,
    suggestedRoles: ['Sales Manager', 'Business Development Manager', 'Account Manager'],
    category: 'personality',
    difficulty: 'medium',
    model: 'gpt-4-turbo'
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
    difficulty: 'intermediate',
    model: 'claude-3-opus-20240229'
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

async function createAssessmentWithAI(token, assessmentData, index) {
  try {
    console.log(`\n📝 Creating Assessment ${index + 1}/${config.totalTestsPlanned}`);
    console.log(`   Type: ${assessmentData.type}`);
    console.log(`   Name: ${assessmentData.name}`);
    console.log(`   Questions: ${assessmentData.count}`);
    console.log(`   Roles: ${assessmentData.suggestedRoles.join(', ')}`);

    // Step 1: Generate questions with AI
    console.log('   🤖 Generating questions with AI...');
    const questionsResponse = await axios.post(
      `${config.baseURL}/assessments/ai/generate-questions`,
      {
        type: assessmentData.type,
        count: assessmentData.count,
        language: 'en',
        difficulty: assessmentData.difficulty || 'medium',
        category: assessmentData.category,
        suggestedRoles: assessmentData.suggestedRoles,
        description: assessmentData.description,
        name: assessmentData.name,
        provider: assessmentData.provider,
        model: assessmentData.model,
        temperature: 0.7,
        maxTokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const questions = questionsResponse.data.questions;
    const aiInfo = questionsResponse.data.aiInfo;

    console.log(`   ✅ Generated ${questions.length} questions`);
    if (aiInfo) {
      console.log(`   📊 AI Info: ${aiInfo.provider || 'default'} - ${aiInfo.model || 'default'}`);
      console.log(`   ⚡ Generation type: ${aiInfo.isMock ? 'Mock' : aiInfo.isFallback ? 'Fallback' : 'Real AI'}`);
    }

    // Step 2: Create assessment template
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
        questions: questions.map((q, qIndex) => ({
          question: q.question || q.text,
          type: q.type || 'scale',
          options: q.options || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          category: q.category || assessmentData.category,
          weight: q.weight || 1,
          orderIndex: qIndex,
          required: true
        })),
        metadata: {
          suggestedRoles: assessmentData.suggestedRoles,
          difficulty: assessmentData.difficulty,
          category: assessmentData.category,
          aiGenerated: true,
          aiProvider: aiInfo?.provider,
          aiModel: aiInfo?.model
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
      aiInfo: aiInfo,
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

    return templates;
  } catch (error) {
    console.error('❌ Failed to verify templates:', error.response?.data || error.message);
    return [];
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

    // Create assessments
    console.log(`\n📋 Creating ${config.totalTestsPlanned} different assessments...`);
    console.log('=' .repeat(60));

    for (let i = 0; i < assessmentConfigurations.length; i++) {
      const result = await createAssessmentWithAI(token, assessmentConfigurations[i], i);
      results.push(result);

      // Add delay between requests to avoid rate limiting
      if (i < assessmentConfigurations.length - 1) {
        await delay(1000);
      }
    }

    // Verify all templates
    const templates = await verifyTemplates(token);

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
        if (r.aiInfo) {
          console.log(`      - AI: ${r.aiInfo.provider || 'default'} - ${r.aiInfo.model || 'default'}`);
        }
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

    // AI provider statistics
    console.log('\n🤖 AI Provider Usage:');
    const aiStats = {};
    successful.forEach(r => {
      if (r.aiInfo) {
        const provider = r.aiInfo.provider || 'default';
        if (!aiStats[provider]) aiStats[provider] = 0;
        aiStats[provider]++;
      }
    });

    Object.entries(aiStats).forEach(([provider, count]) => {
      console.log(`   ${provider}: ${count} assessments`);
    });

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