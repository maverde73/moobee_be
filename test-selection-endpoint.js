const { PrismaClient } = require('@prisma/client');

// Abilita LOG dettagliato
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

async function testSelectionProcess() {
  console.log('\n========== BEFORE SELECTION ==========');
  
  // Check stato iniziale
  const before = await prisma.tenant_assessment_selections.findMany({
    where: { tenant_id: tenantId },
    select: { templateId: true, isActive: true }
  });
  
  console.log('Initial state:');
  before.forEach(s => console.log(`  Template ${s.templateId}: isActive=${s.isActive}`));

  // Simula selezione di un nuovo assessment (ID 7 che non è ancora selezionato)
  const templateIds = ['7'];  // Solo uno nuovo per test
  
  console.log('\n========== EXECUTING SELECTION ==========');
  console.log(`Adding template IDs: ${templateIds}`);
  
  const existingSelections = await prisma.tenant_assessment_selections.findMany({
    where: { tenant_id: tenantId }
  });

  const existingTemplateIds = existingSelections.map(s => s.templateId);
  const toAdd = templateIds.map(id => parseInt(id)).filter(id => !existingTemplateIds.includes(id));
  
  console.log(`Templates to add: ${toAdd}`);
  
  if (toAdd.length > 0) {
    await prisma.$transaction(async (tx) => {
      console.log('\n--- Starting transaction ---');
      
      // Aggiungi nuove selezioni
      await tx.tenant_assessment_selections.createMany({
        data: toAdd.map(templateId => ({
          tenant_id: tenantId,
          templateId: templateId,
          isActive: true,
          selectedBy: 'test_script'
        })),
        skipDuplicates: true
      });
      
      console.log('--- Transaction complete ---');
    });
  }
  
  console.log('\n========== AFTER SELECTION ==========');
  
  // Check stato finale
  const after = await prisma.tenant_assessment_selections.findMany({
    where: { tenant_id: tenantId },
    select: { templateId: true, isActive: true }
  });
  
  console.log('Final state:');
  after.forEach(s => console.log(`  Template ${s.templateId}: isActive=${s.isActive}`));
  
  // Verifica se qualcosa è diventato false
  const becameFalse = after.filter(a => {
    const beforeState = before.find(b => b.templateId === a.templateId);
    return beforeState && beforeState.isActive === true && a.isActive === false;
  });
  
  if (becameFalse.length > 0) {
    console.log('\n⚠️ WARNING: Some records became FALSE:');
    becameFalse.forEach(s => console.log(`  Template ${s.templateId}`));
  } else {
    console.log('\n✅ No records were set to false');
  }

  await prisma.$disconnect();
}

testSelectionProcess();
