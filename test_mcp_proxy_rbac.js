/**
 * MCP Proxy RBAC Test Script
 *
 * Tests MCP Auth Proxy with different user roles:
 * - HR_MANAGER: Full access to tenant data
 * - PM: Limited access (no assessments/engagement)
 * - EMPLOYEE: Only own data
 *
 * Usage:
 *   node test_mcp_proxy_rbac.js [role]
 *
 * Examples:
 *   node test_mcp_proxy_rbac.js hr_manager
 *   node test_mcp_proxy_rbac.js pm
 *   node test_mcp_proxy_rbac.js employee
 *   node test_mcp_proxy_rbac.js all  # Run all tests
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test user credentials for different roles
// TODO: Replace with actual test users from your database
const TEST_USERS = {
  hr_manager: {
    email: 'mgiurelli@nexadata.it',
    password: 'Marco2025!',
    role: 'HR_MANAGER'
  },
  pm: {
    email: 'claudio.huang@nexadata.it',
    password: 'Claudio2025!',
    role: 'PM'
  },
  employee: {
    email: 'alomonaco@nexadata.it',
    password: 'Andrea2025!',
    role: 'EMPLOYEE'
  }
};

/**
 * Get JWT token for a user
 */
async function login(userType) {
  const user = TEST_USERS[userType];

  try {
    console.log(`\n🔐 Logging in as ${userType.toUpperCase()} (${user.email})...`);

    const response = await axios.post(`${API_URL}/login`, {
      email: user.email,
      password: user.password
    });

    if (response.data.accessToken || response.data.access_token) {
      const token = response.data.accessToken || response.data.access_token;
      console.log(`✅ Login successful. Role: ${response.data.user?.role || 'unknown'}`);
      console.log(`   User ID: ${response.data.user?.id}, Tenant: ${response.data.user?.tenantId}`);
      return {
        token,
        user: response.data.user,
        userType
      };
    } else {
      throw new Error('No accessToken in response');
    }
  } catch (error) {
    console.error(`❌ Login failed for ${userType}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Call MCP proxy with a query
 */
async function callMCPProxy(token, query, description) {
  try {
    console.log(`\n📊 Query: ${description}`);
    console.log(`   JSON: ${JSON.stringify(query)}`);

    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'execute_query',
        arguments: {
          json_query: JSON.stringify(query)
        }
      }
    };

    const response = await axios.post(
      `${API_URL}/mcp`,
      mcpRequest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Parse SSE format if needed
    let result;
    if (typeof response.data === 'string') {
      // SSE format: "data: {...}\n\n"
      const lines = response.data.split('\n').filter(line => line.startsWith('data: '));
      if (lines.length > 0) {
        result = JSON.parse(lines[0].substring(6)); // Remove "data: " prefix
      } else {
        result = response.data;
      }
    } else {
      result = response.data;
    }

    // Check if result has MCP format
    if (result.result?.content?.[0]?.text) {
      const csvData = result.result.content[0].text;
      const lines = csvData.split('\n').filter(line => line.trim());
      console.log(`✅ Success: ${lines.length} lines returned`);
      console.log(`   First 3 lines:\n   ${lines.slice(0, 3).join('\n   ')}`);
    } else if (result.error) {
      console.log(`⚠️  Error: ${result.error.message || JSON.stringify(result.error)}`);
    } else {
      console.log(`✅ Response:`, JSON.stringify(result).substring(0, 200) + '...');
    }

    return { success: true, result };
  } catch (error) {
    if (error.response?.status === 403) {
      console.log(`🚫 Access Denied (403): ${error.response.data.message || 'Forbidden'}`);
      return { success: false, error: 'Forbidden', expected: true };
    } else if (error.response?.status === 401) {
      console.log(`🚫 Unauthorized (401): Token invalid or expired`);
      return { success: false, error: 'Unauthorized' };
    } else {
      console.log(`❌ Request failed:`, error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Test HR_MANAGER permissions
 */
async function testHRManager(session) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: HR_MANAGER - Full access to tenant data');
  console.log('='.repeat(60));

  const tests = [
    {
      description: 'List all employees (tenant-isolated)',
      query: { table: 'employees', select: ['id', 'first_name', 'last_name', 'email'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query employee_skills (tenant-isolated)',
      query: { table: 'employee_skills', select: ['employee_id', 'skill_id', 'proficiency_level'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query assessments (sensitive data, HR only)',
      query: { table: 'assessments', select: ['id', 'assessment_type_id', 'employee_id'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query skills (shared table - no tenant filter)',
      query: { table: 'skills', select: ['id', 'name', 'category'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query roles (shared table - no tenant filter)',
      query: { table: 'roles', select: ['id', 'Role'], limit: 10 },
      shouldSucceed: true
    }
  ];

  for (const test of tests) {
    await callMCPProxy(session.token, test.query, test.description);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit pause
  }
}

/**
 * Test PM permissions
 */
async function testPM(session) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: PM - Limited access (no assessments/engagement)');
  console.log('='.repeat(60));

  const tests = [
    {
      description: 'List employees (should succeed)',
      query: { table: 'employees', select: ['id', 'first_name', 'last_name'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query projects (should succeed)',
      query: { table: 'projects', select: ['id', 'name', 'start_date'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query assessments (should FAIL - forbidden)',
      query: { table: 'assessments', select: ['id'], limit: 10 },
      shouldSucceed: false
    },
    {
      description: 'Query engagement_responses (should FAIL - forbidden)',
      query: { table: 'engagement_responses', select: ['id'], limit: 10 },
      shouldSucceed: false
    },
    {
      description: 'Query skills (shared - should succeed)',
      query: { table: 'skills', select: ['id', 'name'], limit: 10 },
      shouldSucceed: true
    }
  ];

  for (const test of tests) {
    const result = await callMCPProxy(session.token, test.query, test.description);

    if (!test.shouldSucceed && result.expected) {
      console.log('   ✅ Access correctly denied (as expected)');
    } else if (test.shouldSucceed && !result.success) {
      console.log('   ⚠️  Should have succeeded but failed!');
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Test EMPLOYEE permissions
 */
async function testEmployee(session) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: EMPLOYEE - Own data only');
  console.log('='.repeat(60));

  console.log(`   Employee ID: ${session.user?.employeeId || 'unknown'}`);
  console.log(`   Tenant ID: ${session.user?.tenantId || 'unknown'}`);

  const tests = [
    {
      description: 'Query own employee record (should be filtered to own ID)',
      query: { table: 'employees', select: ['id', 'first_name', 'last_name', 'email'] },
      shouldSucceed: true
    },
    {
      description: 'Query own skills (should be filtered to own employee_id)',
      query: { table: 'employee_skills', select: ['employee_id', 'skill_id', 'proficiency_level'], limit: 10 },
      shouldSucceed: true
    },
    {
      description: 'Query all employees (should see ONLY self)',
      query: { table: 'employees', select: ['id', 'first_name', 'last_name'], limit: 100 },
      shouldSucceed: true,
      note: 'Should return only 1 record (self)'
    },
    {
      description: 'Query assessments (should FAIL - forbidden)',
      query: { table: 'assessments', select: ['id'], limit: 10 },
      shouldSucceed: false
    },
    {
      description: 'Query skills (shared - should succeed)',
      query: { table: 'skills', select: ['id', 'name'], limit: 10 },
      shouldSucceed: true
    }
  ];

  for (const test of tests) {
    const result = await callMCPProxy(session.token, test.query, test.description);

    if (test.note) {
      console.log(`   ℹ️  Note: ${test.note}`);
    }

    if (!test.shouldSucceed && result.expected) {
      console.log('   ✅ Access correctly denied (as expected)');
    } else if (test.shouldSucceed && !result.success) {
      console.log('   ⚠️  Should have succeeded but failed!');
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Test health endpoint (no auth required)
 */
async function testHealthEndpoint() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Health Check (No Authentication)');
  console.log('='.repeat(60));

  try {
    const response = await axios.get(`${API_URL}/mcp/health`);

    console.log('✅ Health endpoint responding');
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Service: ${response.data.service}`);
    console.log(`   Tables: ${response.data.config.tables.total} (${response.data.config.tables.tenant_tables} tenant, ${response.data.config.tables.shared_tables} shared)`);
    console.log(`   Roles: ${response.data.config.roles.names.join(', ')}`);
    console.log(`   MCP Server: ${response.data.config.mcp_server_url}`);
    console.log(`   Auth Token: ${response.data.config.mcp_auth_token_configured ? 'Configured ✓' : 'Missing ✗'}`);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

/**
 * Main test runner
 */
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  console.log('🚀 MCP Auth Proxy RBAC Test Suite');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test Type: ${testType}`);

  // Test health endpoint first
  await testHealthEndpoint();

  // Run role-specific tests
  if (testType === 'all' || testType === 'hr_manager') {
    const session = await login('hr_manager');
    if (session) await testHRManager(session);
  }

  if (testType === 'all' || testType === 'pm') {
    const session = await login('pm');
    if (session) await testPM(session);
  }

  if (testType === 'all' || testType === 'employee') {
    const session = await login('employee');
    if (session) await testEmployee(session);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test suite completed');
  console.log('='.repeat(60));
}

// Run tests
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { login, callMCPProxy, testHRManager, testPM, testEmployee };
