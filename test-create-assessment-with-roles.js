const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

async function testCreateAssessment() {
  console.log('🧪 Testing assessment creation with proper role format\n');

  const assessmentData = {
    name: 'Test Assessment - Software Development',
    type: 'big_five',
    description: 'Test assessment for software developers with proper role format',
    instructions: 'Complete all questions honestly',
    // Roles in correct format: "ID:Role Name"
    suggestedRoles: [
      '40:Web And Digital Interface Designer',
      '67:Software Developer',
      '68:Database Architect'
    ],
    suggestedFrequency: 'quarterly',
    aiModel: 'gpt-4',
    aiPrompt: 'Assessment for tech roles',
    isActive: true,
    questions: [
      {
        text: 'Mi piace lavorare in team su progetti complessi',
        category: 'Estroversione',
        type: 'multiple_choice',
        orderIndex: 0,
        isRequired: true,
        options: [
          { text: 'Per niente d\'accordo', value: 1, orderIndex: 0 },
          { text: 'Poco d\'accordo', value: 2, orderIndex: 1 },
          { text: 'Né d\'accordo né in disaccordo', value: 3, orderIndex: 2 },
          { text: 'Abbastanza d\'accordo', value: 4, orderIndex: 3 },
          { text: 'Completamente d\'accordo', value: 5, orderIndex: 4 }
        ]
      },
      {
        text: 'Sono sempre puntuale con le scadenze',
        category: 'Coscienziosità',
        type: 'multiple_choice',
        orderIndex: 1,
        isRequired: true,
        options: [
          { text: 'Per niente d\'accordo', value: 1, orderIndex: 0 },
          { text: 'Poco d\'accordo', value: 2, orderIndex: 1 },
          { text: 'Né d\'accordo né in disaccordo', value: 3, orderIndex: 2 },
          { text: 'Abbastanza d\'accordo', value: 4, orderIndex: 3 },
          { text: 'Completamente d\'accordo', value: 5, orderIndex: 4 }
        ]
      }
    ]
  };

  try {
    console.log('📝 Creating assessment with roles:');
    assessmentData.suggestedRoles.forEach(role => {
      console.log(`   - ${role}`);
    });

    const response = await axios.post(
      `${API_BASE_URL}/assessments/templates`,
      assessmentData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('\n✅ Assessment created successfully!');
      console.log(`   ID: ${response.data.data.id}`);
      console.log(`   Name: ${response.data.data.name}`);
      console.log(`   Type: ${response.data.data.type}`);
      console.log(`   Suggested Roles: ${response.data.data.suggestedRoles.join(', ')}`);

      // Verify the roles were saved correctly
      console.log('\n🔍 Verifying saved roles format:');
      const savedRoles = response.data.data.suggestedRoles;
      savedRoles.forEach(role => {
        if (role.includes(':')) {
          const [id, name] = role.split(':');
          console.log(`   ✅ Role "${name}" (ID: ${id}) - Format correct`);
        } else {
          console.log(`   ❌ Role "${role}" - Format incorrect`);
        }
      });

      return response.data.data.id;
    } else {
      console.log('❌ Failed to create assessment');
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating assessment:', error.message);
    if (error.response?.data) {
      console.error('   Details:', error.response.data);
    }
    return null;
  }
}

async function testUpdateAssessment(templateId) {
  if (!templateId) {
    console.log('⚠️ No template ID provided, skipping update test');
    return;
  }

  console.log('\n🔄 Testing assessment update with new roles...');

  const updateData = {
    name: 'Updated Test Assessment',
    suggestedRoles: [
      '45:Project Manager',
      '70:System Administrator',
      '80:UI/UX Designer'
    ]
  };

  try {
    const response = await axios.put(
      `${API_BASE_URL}/assessments/templates/${templateId}`,
      updateData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('✅ Assessment updated successfully!');
      console.log(`   New roles: ${response.data.data.suggestedRoles.join(', ')}`);
    } else {
      console.log('❌ Failed to update assessment');
    }
  } catch (error) {
    console.error('❌ Error updating assessment:', error.message);
  }
}

async function testGetAssessment(templateId) {
  if (!templateId) return;

  console.log('\n📖 Fetching created assessment to verify...');

  try {
    const response = await axios.get(
      `${API_BASE_URL}/assessments/templates/${templateId}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      const template = response.data.data;
      console.log('✅ Assessment fetched successfully!');
      console.log(`   Name: ${template.name}`);
      console.log(`   Questions: ${template.questions?.length || 0}`);
      console.log(`   Roles: ${template.suggestedRoles?.join(', ') || 'None'}`);
    }
  } catch (error) {
    console.error('❌ Error fetching assessment:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Assessment Creation Tests');
  console.log('=====================================\n');

  // Test 1: Create assessment
  const templateId = await testCreateAssessment();

  // Test 2: Update assessment
  await testUpdateAssessment(templateId);

  // Test 3: Get assessment
  await testGetAssessment(templateId);

  console.log('\n=====================================');
  console.log('✨ Tests completed!');
}

// Run tests
runTests().catch(console.error);