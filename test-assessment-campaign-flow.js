/**
 * Test Assessment Campaign Flow
 * Created: September 25, 2025
 *
 * Script to test the complete assessment campaign creation flow
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Use Nexadata tenant for testing
const TENANT_ID = 'f5eafcce-26af-4699-aa97-dd8829621406'; // Nexadata

// Generate test token
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  {
    id: 'test-hr-manager',
    tenantId: TENANT_ID,
    email: 'hr@nexadata.it',
    role: 'hr_manager'
  },
  process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
  { expiresIn: '7d' }
);

const API_BASE = 'http://localhost:3000/api/assessment/campaigns';

async function testAssessmentCampaignFlow() {
  try {
    console.log('🎯 Testing Assessment Campaign Creation Flow\n');
    console.log('='.repeat(50));

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 1: Create a test assessment template if needed
    console.log('\n1️⃣ Checking for assessment template...');
    let assessmentTemplate = await prisma.assessment_templates.findFirst({
      where: {
        isActive: true,
        type: 'BIG_FIVE'
      }
    });

    if (!assessmentTemplate) {
      console.log('Creating test assessment template...');
      assessmentTemplate = await prisma.assessment_templates.create({
        data: {
          name: 'Test Big Five Assessment',
          type: 'BIG_FIVE',
          description: 'Test assessment for campaign flow',
          isActive: true,
          suggestedRoles: ['Developer', 'Manager'],
          scoringAlgorithm: 'weighted',
          softSkillsEnabled: true,
          updatedAt: new Date(),
          createdAt: new Date()
        }
      });

      // Add some questions
      await prisma.assessment_questions.createMany({
        data: [
          {
            templateId: assessmentTemplate.id,
            text: 'I enjoy working in teams',
            type: 'LIKERT',
            order: 1
          },
          {
            templateId: assessmentTemplate.id,
            text: 'I prefer structured work environments',
            type: 'LIKERT',
            order: 2
          }
        ]
      });
    }

    console.log('✅ Using assessment template:', assessmentTemplate.id, '-', assessmentTemplate.name);

    // Step 2: Get test employees (tenant_users)
    console.log('\n2️⃣ Getting test employees...');
    let tenantUsers = await prisma.tenant_users.findMany({
      where: {
        tenant_id: TENANT_ID, // Use Nexadata tenant
        is_active: true
      },
      take: 3
    });

    if (tenantUsers.length === 0) {
      console.log('No tenant users found. Creating test users...');

      // Create test employee
      const employee = await prisma.employees.create({
        data: {
          tenant_id: TENANT_ID, // Use Nexadata tenant
          first_name: 'Test',
          last_name: 'Employee',
          email: 'test@example.com',
          position: 'Developer',
          hire_date: new Date(),
          is_active: true
        }
      });

      // Create tenant_user
      const { v4: uuidv4 } = require('uuid');
      const tenantUser = await prisma.tenant_users.create({
        data: {
          id: uuidv4(),
          tenant_id: TENANT_ID, // Use Nexadata tenant
          email: 'test@example.com',
          role: 'employee',
          employee_id: employee.id,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      tenantUsers = [tenantUser];
    }

    const employeeIds = tenantUsers.map(u => u.id);
    console.log('✅ Using', employeeIds.length, 'employees for test');

    // Step 3: Check for conflicts
    console.log('\n3️⃣ Checking for conflicts...');
    const conflictCheck = await axios.post(
      `${API_BASE}/check-conflicts`,
      {
        employeeIds,
        startDate: '2025-12-01',
        deadline: '2025-12-31',
        assessmentType: assessmentTemplate.type
      },
      { headers }
    );

    console.log('Conflicts:', conflictCheck.data.hasConflicts ? 'YES' : 'NO');
    if (conflictCheck.data.warnings?.length > 0) {
      console.log('Warnings:', conflictCheck.data.warnings.length);
    }

    // Step 4: Create campaign
    console.log('\n4️⃣ Creating assessment campaign...');
    const campaignData = {
      templateId: assessmentTemplate.id,
      name: 'Test Assessment Campaign - December 2025',
      description: 'Testing the assessment campaign flow',
      employeeIds,
      startDate: '2025-12-01',
      deadline: '2025-12-31',
      frequency: 'once',
      mandatory: true,
      allowRetakes: false,
      maxAttempts: 1,
      notificationSettings: {
        sendOnAssignment: true,
        sendReminders: true,
        reminderFrequency: 7,
        channels: ['email', 'in_app']
      }
    };

    const createResponse = await axios.post(
      API_BASE,
      campaignData,
      { headers }
    );

    if (createResponse.data.success) {
      const campaign = createResponse.data.data;
      console.log('✅ Campaign created!');
      console.log('   ID:', campaign.id);
      console.log('   Name:', campaign.name);
      console.log('   Status:', campaign.status);
      console.log('   Message:', createResponse.data.message);

      // Step 5: Get campaign stats
      console.log('\n5️⃣ Getting campaign statistics...');
      const statsResponse = await axios.get(
        `${API_BASE}/${campaign.id}/stats`,
        { headers }
      );

      if (statsResponse.data.success) {
        const stats = statsResponse.data.data;
        console.log('   Total assigned:', stats.totalAssigned);
        console.log('   Not started:', stats.notStarted);
        console.log('   In progress:', stats.inProgress);
        console.log('   Completed:', stats.completed);
        console.log('   Completion rate:', stats.completionRate, '%');
      }

      // Step 6: Verify assignments in database
      console.log('\n6️⃣ Verifying assignments in database...');
      const assignments = await prisma.assessment_campaign_assignments.findMany({
        where: {
          campaign_id: campaign.id
        }
      });

      console.log('✅ Found', assignments.length, 'assignments:');
      assignments.forEach((a, i) => {
        const user = tenantUsers.find(u => u.id === a.employee_id);
        console.log(`   ${i + 1}. Employee:`, user?.email || a.employee_id);
        console.log(`      Status:`, a.status);
        console.log(`      Assigned by:`, a.assigned_by);
      });

      console.log('\n' + '='.repeat(50));
      console.log('✅ Assessment campaign flow test completed successfully!');
      console.log('\n📊 Summary:');
      console.log('   - Campaign created with ID:', campaign.id);
      console.log('   - Assigned to', assignments.length, 'employees');
      console.log('   - Ready for employees to start assessments');

      return campaign;
    }
  } catch (error) {
    console.error('\n❌ Error in assessment campaign flow:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Message:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
console.log('🚀 Starting Assessment Campaign Test');
console.log('   Date:', new Date().toLocaleString());
console.log('   Backend URL:', API_BASE);
testAssessmentCampaignFlow();