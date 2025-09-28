/**
 * Script to update existing assessment templates with default AI configuration
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateExistingTemplates() {
  console.log('🔄 Updating existing assessment templates with AI configuration...');

  try {
    // Get all existing templates
    const templates = await prisma.assessmentTemplate.findMany();
    console.log(`Found ${templates.length} templates to update`);

    for (const template of templates) {
      // Determine best AI model based on template type
      let aiModel = 'gpt-5'; // Default to GPT-5
      let aiProvider = 'openai';
      let aiMaxTokens = 4000;

      // For complex assessments, use more powerful models
      if (template.type === 'big_five' || template.type === 'disc') {
        aiModel = 'gpt-5';
        aiMaxTokens = 8000;
      } else if (template.type === 'belbin' || template.type === 'competency') {
        aiModel = 'claude-opus-4-1-20250805';
        aiProvider = 'anthropic';
        aiMaxTokens = 6000;
      }

      // Build default prompt if not exists
      const defaultPrompt = template.aiPrompt || `Generate ${template.type} assessment questions for the following context:
Name: ${template.name}
Description: ${template.description || 'N/A'}
Suggested Roles: ${template.suggestedRoles?.join(', ') || 'General'}

Create questions that:
1. Are relevant to the assessment type (${template.type})
2. Are appropriate for the suggested roles
3. Use clear and professional language in Italian
4. Include multiple choice options where applicable
5. Test specific competencies or traits`;

      // Update template with AI configuration
      const updated = await prisma.assessmentTemplate.update({
        where: { id: template.id },
        data: {
          aiPrompt: defaultPrompt,
          aiProvider: template.aiModel ? (template.aiModel.includes('claude') ? 'anthropic' : 'openai') : aiProvider,
          aiModel: template.aiModel || aiModel,
          aiTemperature: 0.7,
          aiMaxTokens: aiMaxTokens,
          aiLanguage: 'it',
          aiGenerationCount: 0,
          generationMetadata: {
            updatedAt: new Date().toISOString(),
            updatedBy: 'migration_script',
            originalModel: template.aiModel || null
          }
        }
      });

      console.log(`✅ Updated template: ${updated.name} (${updated.type}) with ${updated.aiProvider}/${updated.aiModel}`);
    }

    // Log summary
    const updatedTemplates = await prisma.assessmentTemplate.groupBy({
      by: ['aiProvider', 'aiModel'],
      _count: true
    });

    console.log('\n📊 Update Summary:');
    updatedTemplates.forEach(group => {
      console.log(`   ${group.aiProvider}/${group.aiModel}: ${group._count} templates`);
    });

    console.log('\n✅ All templates updated successfully!');

  } catch (error) {
    console.error('❌ Error updating templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateExistingTemplates()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });