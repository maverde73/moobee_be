/**
 * Test script to simulate frontend AI generation call
 * Tests if LLM audit logging works with FE_tenant authentication
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testFrontendAICall() {
  console.log('\n🧪 Testing Frontend AI Generation Call\n');
  console.log('=' .repeat(60));

  // Step 1: Login as super admin (same as frontend)
  console.log('\n1️⃣ Logging in as super admin...');

  try {
    const loginResponse = await axios.post(`${API_URL}/login`, {
      email: 'superadmin@moobee.com',
      password: 'SuperAdmin123!'
    });

    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful');
    console.log('   Token:', token.substring(0, 30) + '...');
    console.log('   User:', loginResponse.data.user?.email);
    console.log('   User Type:', loginResponse.data.userType);
    console.log('   Tenant ID:', loginResponse.data.tenantId);

    // Decode JWT to see tenant_id
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    console.log('   JWT Payload:', JSON.stringify(payload, null, 2));

    // Step 2: Call AI generation endpoint (exactly as frontend does)
    console.log('\n2️⃣ Calling AI generation endpoint...');

    const aiParams = {
      type: 'big_five',
      name: 'Test Assessment from Frontend Simulation',
      description: 'Testing LLM audit logging',
      count: 5,
      language: 'it',
      context: 'Testing LLM audit logging',
      questionType: 'likert_scale',
      difficulty: 'medium',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4000
    };

    console.log('   Request params:', JSON.stringify(aiParams, null, 2));

    const aiResponse = await axios.post(
      `${API_URL}/assessments/ai/generate-questions`,
      aiParams,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ AI Generation successful');
    console.log('   Generated questions:', aiResponse.data.data.questions?.length || 0);

    // Step 3: Check if LLM log was created
    console.log('\n3️⃣ Checking LLM usage logs...');

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const recentLogs = await prisma.llm_usage_logs.findMany({
      where: {
        operation_type: 'assessment_generation',
        created_at: {
          gte: new Date(Date.now() - 60000) // Last minute
        }
      },
      orderBy: { created_at: 'desc' },
      take: 1
    });

    if (recentLogs.length > 0) {
      const log = recentLogs[0];
      console.log('✅ LLM log created successfully!');
      console.log('   Log ID:', log.id);
      console.log('   Tenant ID:', log.tenant_id);
      console.log('   User ID:', log.user_id);
      console.log('   Operation:', log.operation_type);
      console.log('   Provider:', log.provider);
      console.log('   Model:', log.model);
      console.log('   Total tokens:', log.total_tokens);
      console.log('   Estimated cost: $', log.estimated_cost);
      console.log('   Status:', log.status);
      console.log('   Response time:', log.response_time_ms, 'ms');
    } else {
      console.log('❌ NO LLM log found in database!');
      console.log('   This indicates the audit logging did NOT work.');
    }

    await prisma.$disconnect();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully\n');

  } catch (error) {
    console.error('\n❌ Test failed:');

    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run test
testFrontendAICall();
