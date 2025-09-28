const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTemplateOptions() {
  const templateId = 'cmfpmgl0q000019h36ta6bcbw';

  try {
    // Get template with questions
    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: templateId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          take: 5 // Check first 5 questions
        }
      }
    });

    if (!template) {
      console.log('Template not found!');
      return;
    }

    console.log('='.repeat(80));
    console.log(`Template: ${template.name}`);
    console.log(`Type: ${template.type}`);
    console.log('='.repeat(80));

    // Check each question
    template.questions.forEach((question, index) => {
      console.log(`\nQuestion ${index + 1}:`);
      console.log(`  Text: ${question.text}`);
      console.log(`  Type: ${question.type}`);
      console.log(`  Category: ${question.category}`);

      // Parse and display options
      const options = question.options || [];
      console.log(`  Options (${options.length}):`);

      if (Array.isArray(options)) {
        options.forEach(opt => {
          console.log(`    - "${opt.text}" (value: ${opt.value})`);
        });
      } else {
        console.log('    ⚠️ Options is not an array:', typeof options);
      }

      // Check if it has Likert scale
      const hasLikert = options.some(opt =>
        opt.text && (
          opt.text.includes('accordo') ||
          opt.text.includes('Accordo') ||
          opt.text.includes('Neutrale')
        )
      );

      console.log(`  Has Likert scale: ${hasLikert ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplateOptions();