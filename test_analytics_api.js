const axios = require('axios');

async function testAnalyticsAPI() {
  try {
    console.log('🧪 Testing Analytics API for LLM Costs\n');
    console.log('=' .repeat(60));

    // Step 1: Login
    console.log('\n1️⃣  Logging in...');
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      email: 'mlamacchia@nexadata.it',
      password: 'Password123!'
    });

    const token = loginResponse.data.accessToken;
    console.log(`   ✅ Token obtained`);

    // Step 2: Test GET /api/assessments/analytics/llm-costs
    console.log('\n2️⃣  Fetching LLM costs summary...');
    const costsResponse = await axios.get('http://localhost:3000/api/assessments/analytics/llm-costs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (costsResponse.data.success) {
      const data = costsResponse.data.data;
      console.log('   ✅ API Response:');
      console.log(`\n   📊 Summary:`);
      console.log(`      Total Cost: $${data.total_cost || 0}`);
      console.log(`      Total Tokens: ${data.total_tokens || 0}`);
      console.log(`      Total Calls: ${data.total_calls || 0}`);

      if (data.by_operation && data.by_operation.length > 0) {
        console.log(`\n   📈 By Operation Type:`);
        data.by_operation.forEach(op => {
          console.log(`      ${op.operation_type}: $${op._sum.estimated_cost} (${op._count.id} calls)`);
        });
      }

      if (data.by_model && data.by_model.length > 0) {
        console.log(`\n   🤖 By Model:`);
        data.by_model.forEach(model => {
          console.log(`      ${model.provider}/${model.model}: $${model._sum.estimated_cost} (${model._count.id} calls)`);
        });
      }

      if (data.period) {
        console.log(`\n   📅 Period: ${data.period.start} → ${data.period.end || 'now'}`);
      }
    } else {
      console.log('   ❌ API returned error:', costsResponse.data.message);
    }

    // Step 3: Test GET /api/assessments/analytics/llm-operations
    console.log('\n3️⃣  Fetching recent LLM operations...');
    const opsResponse = await axios.get('http://localhost:3000/api/assessments/analytics/llm-operations?limit=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (opsResponse.data.success) {
      const data = opsResponse.data.data;
      console.log(`   ✅ Found ${data.total} total operations (showing ${data.operations.length}):\n`);

      data.operations.forEach((op, i) => {
        console.log(`   ${i + 1}. ${op.operation_type}`);
        console.log(`      ${op.provider}/${op.model} - ${op.status}`);
        console.log(`      Tokens: ${op.total_tokens}, Cost: $${op.estimated_cost}`);
        console.log(`      Time: ${op.response_time_ms}ms - ${new Date(op.created_at).toLocaleString()}`);
        if (op.entity_type) {
          console.log(`      Entity: ${op.entity_type}/${op.entity_id || 'N/A'}`);
        }
        console.log('');
      });
    } else {
      console.log('   ❌ API returned error:', opsResponse.data.message);
    }

    console.log('=' .repeat(60));
    console.log('\n🎉 ANALYTICS API IS WORKING!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAnalyticsAPI();
