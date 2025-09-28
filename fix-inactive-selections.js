const prisma = require('./src/config/database');

async function fixInactiveSelections() {
  try {
    const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

    console.log('\n=== FIXING INACTIVE SELECTIONS ===');
    
    // Find all inactive selections
    const inactiveSelections = await prisma.tenant_assessment_selections.findMany({
      where: { 
        tenant_id: tenantId,
        isActive: false
      }
    });

    console.log(`Found ${inactiveSelections.length} inactive selections to fix`);

    if (inactiveSelections.length > 0) {
      // Update all to active
      const result = await prisma.tenant_assessment_selections.updateMany({
        where: {
          tenant_id: tenantId,
          isActive: false
        },
        data: {
          isActive: true,
          selectedAt: new Date()
        }
      });

      console.log(`✅ Updated ${result.count} selections to active`);

      // Verify the fix
      const afterFix = await prisma.tenant_assessment_selections.findMany({
        where: { tenant_id: tenantId },
        select: {
          templateId: true,
          isActive: true
        }
      });

      console.log('\n=== AFTER FIX ===');
      afterFix.forEach(sel => {
        console.log(`- Template ID: ${sel.templateId}, isActive: ${sel.isActive}`);
      });

      const stillInactive = afterFix.filter(s => !s.isActive).length;
      if (stillInactive === 0) {
        console.log('\n✅ ALL SELECTIONS ARE NOW ACTIVE!');
      }
    } else {
      console.log('No inactive selections found - all good!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixInactiveSelections();
