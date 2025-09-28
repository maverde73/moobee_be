/**
 * Test campaign creation with Nexadata tenant
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function testNexadataCampaign() {
  try {
    // Nexadata tenant ID from the logs
    const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

    console.log('🏢 Using Nexadata tenant:', tenantId);

    // 1. Get Nexadata users
    console.log('\n📋 Fetching Nexadata users...');
    const tenantUsers = await prisma.tenant_users.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true
      },
      select: {
        id: true,
        email: true,
        employee_id: true,
        employees: {
          select: {
            first_name: true,
            last_name: true,
            position: true
          }
        }
      },
      take: 5 // Get first 5 users
    });

    console.log(`✅ Found ${tenantUsers.length} Nexadata users:`);
    const userIds = [];
    tenantUsers.forEach(u => {
      const name = u.employees ?
        `${u.employees.first_name} ${u.employees.last_name}` :
        'No name';
      console.log(`   - ${u.id}`);
      console.log(`     Name: ${name}`);
      console.log(`     Email: ${u.email}`);
      console.log(`     Position: ${u.employees?.position || 'N/A'}`);
      console.log(`     Employee ID in DB: ${u.employee_id}`);
      userIds.push(u.id);
    });

    if (userIds.length === 0) {
      console.log('❌ No users found for Nexadata tenant');
      return;
    }

    // 2. Find or create engagement template for Nexadata
    console.log('\n📝 Finding engagement template for Nexadata...');
    let template = await prisma.engagement_templates.findFirst({
      where: {
        OR: [
          { tenant_id: tenantId },
          {
            selections: {
              some: {
                tenant_id: tenantId,
                is_active: true
              }
            }
          }
        ],
        status: 'PUBLISHED'
      }
    });

    if (!template) {
      console.log('Creating template for Nexadata...');
      template = await prisma.engagement_templates.create({
        data: {
          tenant_id: tenantId,
          title: 'Nexadata Monthly Engagement',
          description: 'Monthly engagement survey for Nexadata employees',
          type: 'CUSTOM',
          category: 'ENGAGEMENT',
          status: 'PUBLISHED',
          instructions: 'Please complete this monthly engagement survey',
          suggested_frequency: 'monthly',
          estimated_time: 10,
          language: 'it',
          tags: ['nexadata', 'engagement', 'monthly']
        }
      });
      console.log('✅ Created template:', template.id);
    } else {
      console.log('✅ Using existing template:', template.id, '-', template.title);
    }

    // 3. Create campaign via API
    console.log('\n🚀 Creating campaign for Nexadata...');

    // Need to generate a token for Nexadata user
    // For testing, we'll use the API directly
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: 'test-nexadata-hr',
        tenantId: tenantId,
        email: 'hr@nexadata.it',
        role: 'hr_manager'
      },
      process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
      { expiresIn: '7d' }
    );

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const campaignData = {
      templateId: template.id,
      name: 'Nexadata October 2025 Engagement',
      description: 'Monthly engagement survey for Nexadata team',
      employeeIds: userIds.slice(0, 3), // Use first 3 users
      startDate: '2025-10-01',
      endDate: '2025-10-31',
      frequency: 'monthly',
      reminderSettings: {
        enabled: true,
        frequency: 'weekly'
      }
    };

    console.log('\n📤 Sending request with:');
    console.log('   Template ID:', campaignData.templateId);
    console.log('   Employee IDs (tenant_user.id):', campaignData.employeeIds);

    const response = await axios.post(
      'http://localhost:3000/api/engagement/campaigns',
      campaignData,
      { headers }
    );

    if (response.data.success) {
      const campaign = response.data.data;
      console.log('\n✅ Campaign created successfully!');
      console.log('   Campaign ID:', campaign.id);
      console.log('   Name:', campaign.name);
      console.log('   Status:', campaign.status);

      // 4. Verify assignments
      console.log('\n🔍 Verifying assignments in database...');
      const assignments = await prisma.engagement_campaign_assignments.findMany({
        where: {
          campaign_id: campaign.id
        }
      });

      console.log(`✅ Created ${assignments.length} assignments:`);
      for (const assignment of assignments) {
        // Find the tenant_user
        const user = tenantUsers.find(u => u.id === assignment.employee_id);
        if (user) {
          const name = user.employees ?
            `${user.employees.first_name} ${user.employees.last_name}` :
            'No name';
          console.log(`   - Assignment for: ${name} (${user.email})`);
          console.log(`     employee_id field contains: ${assignment.employee_id}`);
          console.log(`     Which is tenant_users.id: ✅ CORRECT`);
        }
      }

      console.log('\n✅ SUCCESS: Campaign created for Nexadata with correct tenant_user.id values!');
      console.log('\n📊 Summary:');
      console.log('   - engagement_campaign_assignments.employee_id = tenant_users.id');
      console.log('   - This allows tracking which tenant_user is assigned to the campaign');
      console.log('   - The tenant_user.employee_id field links to the employees table');

      return campaign;
    }
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('Details:', error.response.data.details);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testNexadataCampaign();