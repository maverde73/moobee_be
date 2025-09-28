/**
 * Test the full campaign creation flow
 */

const axios = require('axios');

// Test token - valid for 7 days
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY2Yjk2YjhlLTJkNzItNDhjNS05YjU2LWRlMDFjODFkM2IzYiIsInRlbmFudElkIjoiYmNmZDgxYTktN2U0MC00NjkyLTgwMDgtNDY5ZjNjYTIyM2Y3IiwiZW1haWwiOiJockB0ZXN0LmNvbSIsInJvbGUiOiJocl9tYW5hZ2VyIiwiaWF0IjoxNzU4NzQ5OTE1LCJleHAiOjE3NTkzNTQ3MTV9.p5gkUb3pthH7XWH60KOLE73t_vcWOaesIXjcID9RDA0';

const API_BASE = 'http://localhost:3000/api/engagement';

async function testCampaignFlow() {
  try {
    console.log('🚀 Testing Campaign Creation Flow\n');
    console.log('='.repeat(50));

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 1: Check conflicts
    console.log('\n1️⃣ Checking for conflicts...');
    const conflictCheck = await axios.post(
      `${API_BASE}/campaigns/check-conflicts`,
      {
        employeeIds: ['emp-1', 'emp-2', 'emp-3'],
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      },
      { headers }
    );
    console.log('   Conflicts:', conflictCheck.data.hasConflicts ? 'YES' : 'NO');
    if (conflictCheck.data.conflicts.length > 0) {
      console.log('   Conflicting employees:', conflictCheck.data.conflicts);
    }

    // Step 2: Create campaign
    console.log('\n2️⃣ Creating campaign...');
    const campaignData = {
      templateId: '0e56f08a-7e05-48ee-9e08-c751b02f8166',
      name: 'Test Campaign - October 2025',
      description: 'Testing the complete campaign flow',
      employeeIds: ['emp-1', 'emp-2', 'emp-3'],
      startDate: '2025-10-01',
      endDate: '2025-10-31',
      frequency: 'once',
      reminderSettings: {
        enabled: true,
        frequency: 'weekly'
      },
      notifyManagers: false,
      anonymousResponses: false,
      customMessage: 'Please complete this engagement survey'
    };

    const createResponse = await axios.post(
      `${API_BASE}/campaigns`,
      campaignData,
      { headers }
    );

    if (createResponse.data.success) {
      const campaign = createResponse.data.data;
      console.log('   ✅ Campaign created!');
      console.log('   ID:', campaign.id);
      console.log('   Name:', campaign.name);
      console.log('   Status:', campaign.status);
      console.log('   Assignments:', campaign.assignments?.length || 0, 'employees');

      // Step 3: Get campaign stats
      console.log('\n3️⃣ Getting campaign statistics...');
      const statsResponse = await axios.get(
        `${API_BASE}/campaigns/${campaign.id}/stats`,
        { headers }
      );

      if (statsResponse.data.success) {
        const stats = statsResponse.data.data;
        console.log('   Total assigned:', stats.totalAssigned);
        console.log('   Not started:', stats.notStarted);
        console.log('   In progress:', stats.inProgress);
        console.log('   Completed:', stats.completed);
      }

      // Step 4: List all campaigns
      console.log('\n4️⃣ Listing all campaigns...');
      const listResponse = await axios.get(
        `${API_BASE}/campaigns`,
        { headers }
      );

      if (listResponse.data.success) {
        console.log('   Total campaigns:', listResponse.data.data.length);
        listResponse.data.data.slice(0, 3).forEach(c => {
          console.log(`   - ${c.name} (${c.status})`);
        });
      }

      console.log('\n' + '='.repeat(50));
      console.log('✅ Campaign flow test completed successfully!');

      return campaign;
    }
  } catch (error) {
    console.error('\n❌ Error in campaign flow:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Message:', error.message);
    }
  }
}

// Run the test
testCampaignFlow();