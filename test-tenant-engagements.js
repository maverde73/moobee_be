const axios = require('axios');
const jwt = require('jsonwebtoken');

// Generate test token for Nexadata tenant
const token = jwt.sign(
  {
    id: 'test-hr-manager',
    tenantId: 'f5eafcce-26af-4699-aa97-dd8829621406', // Nexadata
    email: 'hr@nexadata.it',
    role: 'hr_manager'
  },
  process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
  { expiresIn: '1h' }
);

async function testTenantEngagements() {
  console.log('🔍 Testing tenant engagement endpoints\n');

  try {
    // Test 1: Get ALL templates (catalog view)
    console.log('1️⃣ Testing catalog view (catalog=true)');
    const catalogResponse = await axios.get('http://localhost:3000/api/engagement/templates', {
      headers: { Authorization: `Bearer ${token}` },
      params: { catalog: 'true', limit: 100 }
    });
    console.log(`   ✅ Catalog templates: ${catalogResponse.data.data?.length || 0}`);

    // Test 2: Get ONLY tenant's selected templates
    console.log('\n2️⃣ Testing tenant-only view (tenant_only=true)');
    const tenantResponse = await axios.get('http://localhost:3000/api/engagement/templates', {
      headers: { Authorization: `Bearer ${token}` },
      params: { tenant_only: 'true', limit: 100 }
    });
    console.log(`   ✅ Tenant templates: ${tenantResponse.data.data?.length || 0}`);

    if (tenantResponse.data.data?.length > 0) {
      console.log('   Templates:');
      tenantResponse.data.data.forEach(t => {
        console.log(`     - ${t.id}: ${t.title || t.name}`);
      });
    } else {
      console.log('   ⚠️ No templates found for this tenant');

      // Check if there are selections in the database
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const selections = await prisma.tenant_engagement_selections.findMany({
        where: {
          tenant_id: 'f5eafcce-26af-4699-aa97-dd8829621406',
          is_active: true
        }
      });

      console.log(`\n   📊 Selections in DB: ${selections.length}`);
      if (selections.length > 0) {
        console.log('   Template IDs in selections:');
        selections.forEach(s => {
          console.log(`     - ${s.template_id}`);
        });
      }

      await prisma.$disconnect();
    }

    // Test 3: Check tenant selections endpoint
    console.log('\n3️⃣ Testing tenant selections endpoint');
    const selectionsResponse = await axios.get(
      'http://localhost:3000/api/tenants/f5eafcce-26af-4699-aa97-dd8829621406/engagement-selections',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log(`   ✅ Selections: ${selectionsResponse.data.data?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testTenantEngagements();