const axios = require('axios');
const jwt = require('jsonwebtoken');

// Generate test token for Nexadata tenant
const token = jwt.sign(
  {
    id: 'test-hr-manager',
    tenantId: 'f5eafcce-26af-4699-aa97-dd8829621406', // Nexadata
    email: 'hr@nexadata.it',
    role: 'hr_manager',
    tenant_id: 'f5eafcce-26af-4699-aa97-dd8829621406'
  },
  process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
  { expiresIn: '1h' }
);

const API_BASE = 'http://localhost:3000/api';

async function testUnifiedCalendar() {
  console.log('🔍 Testing Unified Calendar API\n');
  console.log('=====================================\n');

  try {
    // Test 1: Get unified calendar data
    console.log('1️⃣ Testing GET /api/unified/calendar');
    console.log('-------------------------------------');

    const calendarResponse = await axios.get(`${API_BASE}/unified/calendar`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        view: 'month',
        includeCompleted: false,
        page: 1,
        limit: 50
      }
    });

    console.log(`✅ Calendar data retrieved successfully`);
    console.log(`   Total campaigns: ${calendarResponse.data.data?.length || 0}`);
    console.log(`   Summary:`, calendarResponse.data.summary);

    if (calendarResponse.data.data?.length > 0) {
      console.log('\n   📅 Campaigns found:');
      calendarResponse.data.data.slice(0, 5).forEach(campaign => {
        const icon = campaign.type === 'engagement' ? '💬' : '📋';
        console.log(`     ${icon} [${campaign.type}] ${campaign.name}`);
        console.log(`        Status: ${campaign.status}`);
        console.log(`        Start: ${new Date(campaign.startDate).toLocaleDateString()}`);
        console.log(`        End: ${new Date(campaign.endDate).toLocaleDateString()}`);
        if (campaign.stats) {
          console.log(`        Stats:`, campaign.stats);
        }
        console.log();
      });
    } else {
      console.log('   ⚠️ No campaigns found for this tenant');
    }

    // Test 2: Get campaign statistics
    console.log('\n2️⃣ Testing GET /api/unified/stats');
    console.log('-------------------------------------');

    const statsResponse = await axios.get(`${API_BASE}/unified/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { period: 'month' }
    });

    console.log(`✅ Statistics retrieved successfully`);
    console.log(`   Summary:`, statsResponse.data.data?.summary);
    console.log(`   Engagement stats:`, statsResponse.data.data?.engagement);
    console.log(`   Assessment stats:`, statsResponse.data.data?.assessment);

    // Test 3: Check conflicts
    console.log('\n3️⃣ Testing POST /api/unified/check-conflicts');
    console.log('-------------------------------------');

    // Get some employee IDs first
    const tenantUsersResponse = await axios.get(`${API_BASE}/tenants/f5eafcce-26af-4699-aa97-dd8829621406/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const employeeIds = tenantUsersResponse.data.data?.slice(0, 3).map(u => u.id) || [];

    if (employeeIds.length > 0) {
      const conflictCheckData = {
        employeeIds: employeeIds,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        campaignType: 'assessment'
      };

      const conflictResponse = await axios.post(
        `${API_BASE}/unified/check-conflicts`,
        conflictCheckData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log(`✅ Conflict check completed`);
      console.log(`   Has conflicts: ${conflictResponse.data.hasConflicts}`);
      console.log(`   Has errors: ${conflictResponse.data.hasErrors}`);
      console.log(`   Has warnings: ${conflictResponse.data.hasWarnings}`);

      if (conflictResponse.data.conflicts?.length > 0) {
        console.log(`   Conflicts found: ${conflictResponse.data.conflicts.length}`);
        conflictResponse.data.conflicts.slice(0, 3).forEach(conflict => {
          console.log(`     - ${conflict.message}`);
        });
      }

      if (conflictResponse.data.suggestions) {
        console.log(`   Suggestions:`, conflictResponse.data.suggestions);
      }
    } else {
      console.log('   ⚠️ No employees found to test conflicts');
    }

    // Test 4: Test reschedule endpoint (without actually rescheduling)
    console.log('\n4️⃣ Testing PATCH /api/unified/reschedule');
    console.log('-------------------------------------');

    if (calendarResponse.data.data?.length > 0) {
      const testCampaign = calendarResponse.data.data[0];
      console.log(`   Testing with campaign: ${testCampaign.name}`);
      console.log(`   Type: ${testCampaign.type}`);
      console.log(`   Current dates: ${new Date(testCampaign.startDate).toLocaleDateString()} - ${new Date(testCampaign.endDate).toLocaleDateString()}`);
      console.log(`   ℹ️ Skipping actual reschedule to avoid modifying data`);
    } else {
      console.log('   ⚠️ No campaigns available to test reschedule');
    }

    console.log('\n=====================================');
    console.log('✅ All unified calendar tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error during testing:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.error('   Route not found - make sure the server has been restarted');
    }
    if (error.response?.status === 500) {
      console.error('   Server error - check server logs for details');
    }
  }
}

// Run the test
testUnifiedCalendar();