const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAIFields() {
  console.log('📊 Checking AI Configuration in Database...\n');

  try {
    const templates = await prisma.assessmentTemplate.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        aiProvider: true,
        aiModel: true,
        aiLanguage: true,
        aiTemperature: true,
        aiMaxTokens: true,
        aiPrompt: true,
        lastAiGeneration: true,
        aiGenerationCount: true
      }
    });

    console.log(`Found ${templates.length} templates in database:\n`);

    templates.forEach(template => {
      console.log(`📝 Template: ${template.name}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Type: ${template.type}`);
      console.log(`   AI Provider: ${template.aiProvider || 'NOT SET'}`);
      console.log(`   AI Model: ${template.aiModel || 'NOT SET'}`);
      console.log(`   Language: ${template.aiLanguage || 'NOT SET'}`);
      console.log(`   Temperature: ${template.aiTemperature || 'NOT SET'}`);
      console.log(`   Max Tokens: ${template.aiMaxTokens || 'NOT SET'}`);
      console.log(`   Has Custom Prompt: ${template.aiPrompt ? 'YES' : 'NO'}`);
      console.log(`   Generation Count: ${template.aiGenerationCount}`);
      console.log(`   Last Generation: ${template.lastAiGeneration || 'Never'}`);
      console.log('');
    });

    // Check if any templates are missing AI configuration
    const missingConfig = templates.filter(t => !t.aiProvider || !t.aiModel);
    if (missingConfig.length > 0) {
      console.log(`⚠️  ${missingConfig.length} templates missing AI configuration`);
      missingConfig.forEach(t => console.log(`   - ${t.name}`));
    } else {
      console.log('✅ All templates have AI configuration!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAIFields();