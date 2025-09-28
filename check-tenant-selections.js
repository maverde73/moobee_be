const prisma = require('./src/config/database');

async function checkTenantSelections() {
  try {
    const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

    // Check tenant selections
    const selections = await prisma.tenant_assessment_selections.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        templateId: true,
        tenant_id: true,
        isActive: true,
        selectedAt: true
      }
    });

    console.log('\n=== TENANT SELECTIONS ===');
    console.log(`Found ${selections.length} selections for tenant ${tenantId}`);
    selections.forEach(sel => {
      console.log(`- Template ID: ${sel.templateId}, isActive: ${sel.isActive}, selectedAt: ${sel.selectedAt}`);
    });

    // Check which ones are active
    const activeCount = selections.filter(s => s.isActive).length;
    const inactiveCount = selections.filter(s => !s.isActive).length;

    console.log(`\nActive: ${activeCount}, Inactive: ${inactiveCount}`);

    // List inactive ones
    if (inactiveCount > 0) {
      console.log('\n⚠️  INACTIVE SELECTIONS FOUND:');
      selections.filter(s => !s.isActive).forEach(sel => {
        console.log(`  - Template ID ${sel.templateId} is INACTIVE`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenantSelections();
