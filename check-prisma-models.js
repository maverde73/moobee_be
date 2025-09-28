const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Modelli Prisma disponibili:\n');

const models = Object.keys(prisma).filter(k =>
  !k.startsWith('_') &&
  !k.startsWith('$') &&
  typeof prisma[k] === 'object'
);

models.forEach(model => {
  console.log(`- prisma.${model}`);
});

// Test specifici per assessment
console.log('\n\nTest modelli assessment:');
console.log('- prisma.assessment_templates:', typeof prisma.assessment_templates);
console.log('- prisma.assessmentTemplates:', typeof prisma.assessmentTemplates);
console.log('- prisma.assessmentTemplate:', typeof prisma.assessmentTemplate);

process.exit(0);