const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplates() {
  try {
    const tenantId = 'bcfd81a9-7e40-4692-8008-469f3ca223f7';

    // Check templates owned by tenant
    const ownedTemplates = await prisma.engagement_templates.findMany({
      where: {
        tenant_id: tenantId
      },
      select: {
        id: true,
        title: true,
        tenant_id: true
      }
    });

    console.log(`\n✅ Templates owned by tenant ${tenantId}:`);
    console.log(ownedTemplates);

    // Check templates selected by tenant
    const selectedTemplates = await prisma.tenant_engagement_selections.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true
      },
      include: {
        template: {
          select: {
            id: true,
            title: true,
            tenant_id: true
          }
        }
      }
    });

    console.log(`\n✅ Templates selected by tenant ${tenantId}:`);
    selectedTemplates.forEach(sel => {
      console.log(`- ${sel.template.id}: ${sel.template.title} (owner: ${sel.template.tenant_id || 'global'})`);
    });

    // Check if specific template is accessible
    const templateId = '19fbf70e-ce61-442a-b747-2a33401c7887';
    const accessibleTemplate = await prisma.engagement_templates.findFirst({
      where: {
        id: templateId,
        OR: [
          { tenant_id: tenantId },
          { tenant_id: null },
          {
            selections: {
              some: {
                tenant_id: tenantId,
                template_id: templateId,
                is_active: true
              }
            }
          }
        ]
      }
    });

    console.log(`\n🔍 Template ${templateId} accessible: ${accessibleTemplate ? 'YES' : 'NO'}`);

    // Get any accessible template for testing
    const anyTemplate = await prisma.engagement_templates.findFirst({
      where: {
        OR: [
          { tenant_id: tenantId },
          { tenant_id: null },
          {
            selections: {
              some: {
                tenant_id: tenantId,
                is_active: true
              }
            }
          }
        ]
      }
    });

    if (anyTemplate) {
      console.log(`\n🎯 Use this template ID for testing: ${anyTemplate.id}`);
      console.log(`   Title: ${anyTemplate.title}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates();