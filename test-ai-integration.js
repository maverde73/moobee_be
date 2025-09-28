#!/usr/bin/env node

/**
 * Test script for AI Integration
 * Tests all AI endpoints after Phase 2 implementation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let accessToken = null;

// Test credentials
const testUser = {
  email: 'john.doe@example.com',
  password: 'Password123!'
};

/**
 * Login and get access token
 */
async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, testUser);

    // Handle different response structures
    if (response.data.accessToken) {
      accessToken = response.data.accessToken;
    } else if (response.data.data?.accessToken) {
      accessToken = response.data.data.accessToken;
    } else if (response.data.token) {
      accessToken = response.data.token;
    } else {
      console.log('Response structure:', JSON.stringify(response.data, null, 2));
      throw new Error('Access token not found in response');
    }

    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test AI connection endpoint
 */
async function testAIConnection() {
  try {
    console.log('\n📡 Testing AI connection...');
    const response = await axios.get(
      `${BASE_URL}/api/admin/assessment-catalog/ai/test-connection`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('✅ AI Connection Test Result:');
    console.log('  Status:', response.data.data.status);
    console.log('  Providers:', response.data.data.providers);
    return true;
  } catch (error) {
    console.error('❌ AI connection test failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test question generation
 */
async function testQuestionGeneration() {
  try {
    console.log('\n🎯 Testing question generation...');
    const response = await axios.post(
      `${BASE_URL}/api/admin/assessment-catalog/ai/generate-questions`,
      {
        type: 'bigFive',
        count: 3,
        language: 'it',
        difficulty: 'medium'
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Question Generation Result:');
    console.log('  Questions generated:', response.data.data.metadata.count);
    console.log('  Type:', response.data.data.metadata.type);
    console.log('  Language:', response.data.data.metadata.language);

    if (response.data.data.questions && response.data.data.questions.length > 0) {
      console.log('  Sample question:', response.data.data.questions[0].text);
    }

    return true;
  } catch (error) {
    console.error('❌ Question generation failed:', error.response?.data || error.message);
    console.log('Note: This may fail if AI API keys are not configured in .env');
    return false;
  }
}

/**
 * Test custom prompt generation
 */
async function testPromptGeneration() {
  try {
    console.log('\n💡 Testing custom prompt generation...');
    const response = await axios.post(
      `${BASE_URL}/api/admin/assessment-catalog/ai/generate-prompt`,
      {
        type: 'disc',
        action: 'generateQuestions',
        parameters: {
          count: 5,
          language: 'en'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Prompt Generation Result:');
    console.log('  Type:', response.data.data.type);
    console.log('  Action:', response.data.data.action);
    console.log('  System prompt length:', response.data.data.prompt.system.length);
    console.log('  User prompt length:', response.data.data.prompt.user.length);

    return true;
  } catch (error) {
    console.error('❌ Prompt generation failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting AI Integration Tests\n');
  console.log('================================\n');

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running');
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first with: npm start');
    process.exit(1);
  }

  // Run tests
  const results = {
    login: await login(),
    aiConnection: false,
    questionGeneration: false,
    promptGeneration: false
  };

  if (results.login) {
    results.aiConnection = await testAIConnection();
    results.promptGeneration = await testPromptGeneration();
    results.questionGeneration = await testQuestionGeneration();
  }

  // Summary
  console.log('\n================================');
  console.log('📊 Test Summary:\n');

  const testNames = {
    login: 'Authentication',
    aiConnection: 'AI Connection',
    questionGeneration: 'Question Generation',
    promptGeneration: 'Prompt Generation'
  };

  let passed = 0;
  let failed = 0;

  for (const [key, value] of Object.entries(results)) {
    if (value) {
      console.log(`  ✅ ${testNames[key]}`);
      passed++;
    } else {
      console.log(`  ❌ ${testNames[key]}`);
      failed++;
    }
  }

  console.log('\n--------------------------------');
  console.log(`Total: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above.');

    if (!results.questionGeneration) {
      console.log('\n📝 Note: Question generation requires AI API keys.');
      console.log('Add to your .env file:');
      console.log('  OPENAI_API_KEY=your-key-here');
      console.log('  ANTHROPIC_API_KEY=your-key-here');
    }
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});