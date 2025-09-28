const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTestTemplate() {
  try {
    const tenantId = 'bcfd81a9-7e40-4692-8008-469f3ca223f7';

    // Find a global template to select
    const globalTemplate = await prisma.engagement_templates.findFirst({
      where: {
        tenant_id: null,
        status: 'PUBLISHED'
      }
    });

    if (globalTemplate) {
      console.log(`Found global template: ${globalTemplate.id} - ${globalTemplate.title}`);

      // Check if already selected
      const existing = await prisma.tenant_engagement_selections.findFirst({
        where: {
          tenant_id: tenantId,
          template_id: globalTemplate.id
        }
      });

      if (existing) {
        // Update to active
        await prisma.tenant_engagement_selections.update({
          where: { id: existing.id },
          data: { is_active: true }
        });
        console.log('✅ Template selection activated');
      } else {
        // Create selection
        await prisma.tenant_engagement_selections.create({
          data: {
            tenant_id: tenantId,
            template_id: globalTemplate.id,
            is_active: true,
            selected_at: new Date()
          }
        });
        console.log('✅ Template selected for tenant');
      }

      console.log(`\n🎯 Use this template ID in tests: ${globalTemplate.id}`);
      return globalTemplate.id;
    }

    // If no global template, create one for the tenant
    console.log('No global template found, creating one for tenant...');

    const newTemplate = await prisma.engagement_templates.create({
      data: {
        tenant_id: tenantId,
        title: 'Test Engagement Template',
        description: 'Template for testing campaign creation',
        type: 'CUSTOM',
        category: 'ENGAGEMENT',
        status: 'PUBLISHED',
        instructions: 'Complete this engagement survey',
        suggested_frequency: 'monthly',
        estimated_time: 10,
        language: 'it',
        tags: ['test', 'engagement']
      }
    });

    // Add some questions
    await prisma.engagement_questions.createMany({
      data: [
        {
          template_id: newTemplate.id,
          question_text: 'How satisfied are you with your work?',
          question_type: 'LIKERT',
          order: 1,
          required: true,
          metadata: {
            scale_min: 1,
            scale_max: 5,
            scale_labels: {
              1: 'Very Dissatisfied',
              5: 'Very Satisfied'
            }
          }
        },
        {
          template_id: newTemplate.id,
          question_text: 'Would you recommend this company to others?',
          question_type: 'LIKERT',
          order: 2,
          required: true,
          metadata: {
            scale_min: 1,
            scale_max: 5,
            scale_labels: {
              1: 'Definitely Not',
              5: 'Definitely Yes'
            }
          }
        }
      ]
    });

    console.log('✅ Created new template with questions');
    console.log(`\n🎯 Use this template ID in tests: ${newTemplate.id}`);
    return newTemplate.id;

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestTemplate();