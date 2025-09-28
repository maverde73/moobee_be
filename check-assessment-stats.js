const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssessmentStats() {
  try {
    // Find assessment campaigns with their assignments
    const campaigns = await prisma.assessment_campaigns.findMany({
      where: {
        tenant_id: 'nexadata'
      },
      include: {
        assignments: true,
        _count: {
          select: {
            assignments: true
          }
        }
      }
    });

    console.log('\n=== Assessment Campaign Statistics ===\n');

    for (const campaign of campaigns) {
      const completed = campaign.assignments.filter(a => a.status === 'COMPLETED').length;
      const inProgress = campaign.assignments.filter(a => a.status === 'IN_PROGRESS').length;
      const notStarted = campaign.assignments.filter(a => a.status === 'ASSIGNED').length;
      const total = campaign.assignments.length;

      console.log(`Campaign: ${campaign.name}`);
      console.log(`ID: ${campaign.id}`);
      console.log(`Total Assignments: ${total}`);
      console.log(`- Completed: ${completed}`);
      console.log(`- In Progress: ${inProgress}`);
      console.log(`- Not Started: ${notStarted}`);
      console.log(`Status: ${campaign.status}`);
      console.log(`Start Date: ${campaign.start_date}`);
      console.log(`Deadline: ${campaign.deadline}`);
      console.log('---');
    }

    // Check for campaign with 65 assignments
    const bigCampaign = campaigns.find(c => c.assignments.length === 65);
    if (bigCampaign) {
      console.log('\n=== Found Campaign with 65 Assignments ===');
      console.log(`Name: ${bigCampaign.name}`);
      console.log(`Created: ${bigCampaign.created_at}`);

      // Show status breakdown
      const statusCounts = {};
      bigCampaign.assignments.forEach(a => {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      });
      console.log('\nStatus Breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`- ${status}: ${count}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssessmentStats();