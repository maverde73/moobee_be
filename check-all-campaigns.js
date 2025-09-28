const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllCampaigns() {
  try {
    // Count all assessment campaigns
    const totalCampaigns = await prisma.assessment_campaigns.count();
    console.log(`\nTotal Assessment Campaigns in Database: ${totalCampaigns}`);

    // Find all assessment campaigns with assignments
    const campaigns = await prisma.assessment_campaigns.findMany({
      include: {
        assignments: true,
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log('\n=== All Assessment Campaigns ===\n');

    for (const campaign of campaigns) {
      const completed = campaign.assignments.filter(a => a.status === 'COMPLETED').length;
      const inProgress = campaign.assignments.filter(a => a.status === 'IN_PROGRESS').length;
      const notStarted = campaign.assignments.filter(a => a.status === 'ASSIGNED').length;
      const total = campaign.assignments.length;

      if (total > 0) {  // Only show campaigns with assignments
        console.log(`Campaign: ${campaign.name}`);
        console.log(`Tenant ID: ${campaign.tenant_id}`);
        console.log(`Campaign ID: ${campaign.id}`);
        console.log(`Total Assignments: ${total}`);
        console.log(`- Completed: ${completed}`);
        console.log(`- In Progress: ${inProgress}`);
        console.log(`- Not Started (Assigned): ${notStarted}`);
        console.log(`Status: ${campaign.status}`);
        console.log(`Created: ${campaign.created_at}`);
        console.log('---');
      }
    }

    // Look for the specific campaign with 65 assignments
    const bigCampaign = campaigns.find(c => c.assignments.length === 65);
    if (bigCampaign) {
      console.log('\n=== FOUND: Campaign with 65 Assignments ===');
      console.log(`Name: "${bigCampaign.name}"`);
      console.log(`Tenant: ${bigCampaign.tenant_id}`);
      console.log(`Template ID: ${bigCampaign.template_id}`);
      console.log(`Created: ${bigCampaign.created_at}`);
      console.log('\nDetailed Status:');
      console.log(`- COMPLETED: ${bigCampaign.assignments.filter(a => a.status === 'COMPLETED').length}`);
      console.log(`- IN_PROGRESS: ${bigCampaign.assignments.filter(a => a.status === 'IN_PROGRESS').length}`);
      console.log(`- ASSIGNED: ${bigCampaign.assignments.filter(a => a.status === 'ASSIGNED').length}`);

      // Check unique employee IDs
      const uniqueEmployees = new Set(bigCampaign.assignments.map(a => a.employee_id));
      console.log(`\nUnique Employees: ${uniqueEmployees.size}`);
    } else {
      console.log('\n⚠️ No campaign found with exactly 65 assignments');

      // Show campaigns with high assignment counts
      const largeCampaigns = campaigns.filter(c => c.assignments.length > 10);
      if (largeCampaigns.length > 0) {
        console.log('\n=== Large Campaigns (>10 assignments) ===');
        largeCampaigns.forEach(c => {
          console.log(`- ${c.name}: ${c.assignments.length} assignments (Tenant: ${c.tenant_id})`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllCampaigns();