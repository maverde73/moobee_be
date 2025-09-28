// Test Campaign Assignment View
// Created: 2025-09-26 16:04
// Purpose: Test the new campaign_assignment_details view

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testView() {
  try {
    console.log('Testing campaign_assignment_details view...\n');

    // Test 1: Query the view directly
    console.log('1. Querying view directly:');
    const directQuery = await prisma.$queryRaw`
      SELECT *
      FROM campaign_assignment_details
      LIMIT 5
    `;
    console.log(`Found ${directQuery.length} records in view`);
    if (directQuery.length > 0) {
      console.log('Sample record:', directQuery[0]);
    }

    // Test 2: Count by campaign type
    console.log('\n2. Count by campaign type:');
    const typeCounts = await prisma.$queryRaw`
      SELECT
        campaign_type,
        COUNT(*) as count
      FROM campaign_assignment_details
      GROUP BY campaign_type
    `;
    console.log('Type counts:', typeCounts);

    // Test 3: Get statistics
    console.log('\n3. Assignment status distribution:');
    const statusStats = await prisma.$queryRaw`
      SELECT
        assignment_status,
        campaign_type,
        COUNT(*) as count
      FROM campaign_assignment_details
      GROUP BY assignment_status, campaign_type
      ORDER BY campaign_type, assignment_status
    `;
    console.log('Status distribution:', statusStats);

    // Test 4: Check performance with specific campaign
    console.log('\n4. Testing performance for specific campaign:');
    const campaigns = await prisma.$queryRaw`
      SELECT DISTINCT campaign_id, campaign_type
      FROM campaign_assignment_details
      LIMIT 1
    `;

    if (campaigns.length > 0) {
      const { campaign_id, campaign_type } = campaigns[0];
      console.log(`Testing with campaign: ${campaign_id} (${campaign_type})`);

      const startTime = Date.now();
      const campaignData = await prisma.$queryRaw`
        SELECT *
        FROM campaign_assignment_details
        WHERE campaign_id = ${campaign_id}
          AND campaign_type = ${campaign_type}
      `;
      const queryTime = Date.now() - startTime;

      console.log(`Query completed in ${queryTime}ms`);
      console.log(`Found ${campaignData.length} assignments`);
    }

    console.log('\n✅ View test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing view:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testView();