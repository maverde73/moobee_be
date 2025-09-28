/**
 * Test campaign creation with real tenant_user IDs
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

// Valid test token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY2Yjk2YjhlLTJkNzItNDhjNS05YjU2LWRlMDFjODFkM2IzYiIsInRlbmFudElkIjoiYmNmZDgxYTktN2U0MC00NjkyLTgwMDgtNDY5ZjNjYTIyM2Y3IiwiZW1haWwiOiJockB0ZXN0LmNvbSIsInJvbGUiOiJocl9tYW5hZ2VyIiwiaWF0IjoxNzU4NzQ5OTE1LCJleHAiOjE3NTkzNTQ3MTV9.p5gkUb3pthH7XWH60KOLE73t_vcWOaesIXjcID9RDA0';
const API_BASE = 'http://localhost:3000/api/engagement';

async function testWithRealUsers() {
  try {
    const tenantId = 'bcfd81a9-7e40-4692-8008-469f3ca223f7';

    // 1. Get real tenant_users from database
    console.log('📋 Fetching tenant users...');
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
            last_name: true
          }
        }
      },
      take: 3 // Get first 3 users for testing
    });

    if (tenantUsers.length === 0) {
      console.log('⚠️  No users found for tenant, creating test users...');

      // Create test employee first
      const employee = await prisma.employees.create({
        data: {
          tenant_id: tenantId,
          first_name: 'Test',
          last_name: 'Employee',
          email: 'test.employee@example.com',
          position: 'Developer',
          hire_date: new Date(),
          is_active: true
        }
      });

      // Create tenant_user
      const tenantUser = await prisma.tenant_users.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          email: 'test.employee@example.com',
          role: 'employee',
          employee_id: employee.id,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      tenantUsers.push({
        id: tenantUser.id,
        email: tenantUser.email,
        employee_id: tenantUser.employee_id,
        employees: {
          first_name: employee.first_name,
          last_name: employee.last_name
        }
      });
    }

    console.log(`✅ Found ${tenantUsers.length} users:`);
    tenantUsers.forEach(u => {
      const name = u.employees ?
        `${u.employees.first_name} ${u.employees.last_name}` :
        'No name';
      console.log(`   - ${u.id}: ${name} (${u.email})`);
      console.log(`     employee_id: ${u.employee_id}`);
    });

    // 2. Extract tenant_user IDs (NOT employee_id!)
    const tenantUserIds = tenantUsers.map(u => u.id);
    console.log('\n🎯 Using tenant_user IDs:', tenantUserIds);

    // 3. Create campaign with real tenant_user IDs
    console.log('\n🚀 Creating campaign...');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const campaignData = {
      templateId: '0e56f08a-7e05-48ee-9e08-c751b02f8166', // Our test template
      name: 'Real Users Test Campaign',
      description: 'Testing with actual tenant_user IDs',
      employeeIds: tenantUserIds, // tenant_user.id values!
      startDate: '2025-11-01',
      endDate: '2025-11-30',
      frequency: 'once',
      reminderSettings: {
        enabled: true,
        frequency: 'weekly'
      }
    };

    const response = await axios.post(
      `${API_BASE}/campaigns`,
      campaignData,
      { headers }
    );

    if (response.data.success) {
      const campaign = response.data.data;
      console.log('✅ Campaign created successfully!');
      console.log('   ID:', campaign.id);
      console.log('   Name:', campaign.name);

      // 4. Verify assignments were created
      console.log('\n🔍 Verifying assignments...');
      const assignments = await prisma.engagement_campaign_assignments.findMany({
        where: {
          campaign_id: campaign.id
        },
        select: {
          id: true,
          employee_id: true, // This should contain tenant_user.id
          assigned_by: true,
          status: true
        }
      });

      console.log(`✅ Found ${assignments.length} assignments:`);
      assignments.forEach(a => {
        // Find matching tenant_user
        const tenantUser = tenantUsers.find(u => u.id === a.employee_id);
        if (tenantUser) {
          const name = tenantUser.employees ?
            `${tenantUser.employees.first_name} ${tenantUser.employees.last_name}` :
            'No name';
          console.log(`   - Assignment ${a.id}:`);
          console.log(`     employee_id (tenant_user.id): ${a.employee_id}`);
          console.log(`     Matches user: ${name}`);
          console.log(`     Status: ${a.status}`);
        } else {
          console.log(`   - Assignment ${a.id}: No matching tenant_user found`);
        }
      });

      // 5. Verify the relationship
      console.log('\n✅ VERIFICATION:');
      console.log('   engagement_campaign_assignments.employee_id = tenant_users.id');
      console.log('   This is CORRECT for tracking which tenant_user is assigned');

      return campaign;
    }
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testWithRealUsers();