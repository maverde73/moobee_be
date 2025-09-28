/**
 * Test script for check-conflicts endpoint
 */

const axios = require('axios');

// Test token - replace with a valid one if needed
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY2Yjk2YjhlLTJkNzItNDhjNS05YjU2LWRlMDFjODFkM2IzYiIsInRlbmFudElkIjoiYmNmZDgxYTktN2U0MC00NjkyLTgwMDgtNDY5ZjNjYTIyM2Y3IiwiZW1haWwiOiJockB0ZXN0LmNvbSIsInJvbGUiOiJocl9tYW5hZ2VyIiwiaWF0IjoxNzU4NzQ5OTE1LCJleHAiOjE3NTkzNTQ3MTV9.p5gkUb3pthH7XWH60KOLE73t_vcWOaesIXjcID9RDA0';

async function testCheckConflicts() {
  try {
    console.log('Testing check-conflicts endpoint...\n');

    const response = await axios.post(
      'http://localhost:3000/api/engagement/campaigns/check-conflicts',
      {
        employeeIds: ['1', '2', '3'], // Mock employee IDs
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Success:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.status, error.response.data);

      if (error.response.status === 401) {
        console.log('\nToken might be expired. Generate a new one by logging in.');
      }
    } else {
      console.error('❌ Network error:', error.message);
    }
  }
}

// Run the test
testCheckConflicts();