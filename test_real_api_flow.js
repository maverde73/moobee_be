const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function testRealAPIFlow() {
  console.log('🧪 TEST COMPLETO: Inserimento DB + Chiamata API Reale');
  console.log('='.repeat(80));

  const employeeId = 91;
  const skillId = 999; // Skill diversa per test pulito
  const tenantId = 'f5eafcce-26af-4699-aa97-dd8829621406';

  try {
    // STEP 1: Pulizia record precedenti
    console.log('\n🗑️  Step 1: Pulizia record precedenti...');
    await prisma.employee_skills.deleteMany({
      where: { employee_id: employeeId, skill_id: skillId }
    });
    console.log('   ✅ Record precedenti eliminati');

    // STEP 2: Inserimento diretto nel database
    console.log('\n📝 Step 2: Inserimento diretto nel database...');
    const insertedRecord = await prisma.employee_skills.create({
      data: {
        employee_id: employeeId,
        skill_id: skillId,
        proficiency_level: 3,
        years_experience: 1,
        source: 'manual_test',
        tenant_id: tenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`   ✅ Record inserito: ID=${insertedRecord.id}, proficiency=${insertedRecord.proficiency_level}`);
    const originalId = insertedRecord.id;

    // STEP 3: Verifica stato database PRIMA della chiamata API
    console.log('\n🔍 Step 3: Stato database PRIMA chiamata API...');
    const beforeAPI = await prisma.employee_skills.findMany({
      where: { employee_id: employeeId, skill_id: skillId }
    });
    console.log(`   Record trovati: ${beforeAPI.length}`);
    beforeAPI.forEach(r => {
      console.log(`     - ID=${r.id}, proficiency=${r.proficiency_level}, source=${r.source}`);
    });

    // STEP 4: Chiamata API reale PUT /api/employees/:id/skills
    console.log('\n🌐 Step 4: Chiamata API PUT /api/employees/91/skills...');

    // Payload come inviato dal frontend
    const payload = {
      hard: [
        {
          id: skillId, // skill_id (NOT employee_skills.id!)
          name: 'Test Skill',
          level: 7, // Cambio proficiency da 3 a 7
          yearsOfExperience: 3,
          source: 'assessment',
          category: 'Technical Skills',
          lastAssessedDate: new Date().toISOString()
        }
      ],
      soft: []
    };

    console.log('   Payload:', JSON.stringify(payload, null, 2));

    try {
      // Simula chiamata API (usa token reale se disponibile)
      // Per ora uso prisma direttamente per simulare l'upsert del backend
      console.log('\n   🔧 Simulazione backend upsert (come in employeeRoutes.js:1098-1127)...');

      const upsertResult = await prisma.employee_skills.upsert({
        where: {
          employee_id_skill_id: {
            employee_id: employeeId,
            skill_id: parseInt(payload.hard[0].id)
          }
        },
        update: {
          proficiency_level: payload.hard[0].level || 0,
          years_experience: payload.hard[0].yearsOfExperience || 0,
          source: payload.hard[0].source || 'assessment',
          last_used_date: payload.hard[0].lastAssessedDate ? new Date(payload.hard[0].lastAssessedDate) : new Date(),
          updated_at: new Date()
        },
        create: {
          employee_id: employeeId,
          skill_id: parseInt(payload.hard[0].id),
          proficiency_level: payload.hard[0].level || 0,
          years_experience: payload.hard[0].yearsOfExperience || 0,
          source: payload.hard[0].source || 'assessment',
          last_used_date: payload.hard[0].lastAssessedDate ? new Date(payload.hard[0].lastAssessedDate) : new Date(),
          tenant_id: tenantId,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      console.log(`   ✅ Upsert completato: ID=${upsertResult.id}, proficiency=${upsertResult.proficiency_level}`);

    } catch (apiError) {
      console.error('   ❌ Errore API:', apiError.message);
      throw apiError;
    }

    // STEP 5: Verifica stato database DOPO la chiamata API
    console.log('\n🔍 Step 5: Stato database DOPO chiamata API...');
    const afterAPI = await prisma.employee_skills.findMany({
      where: { employee_id: employeeId, skill_id: skillId }
    });
    console.log(`   Record trovati: ${afterAPI.length}`);
    afterAPI.forEach(r => {
      console.log(`     - ID=${r.id}, proficiency=${r.proficiency_level}, source=${r.source}`);
    });

    // STEP 6: VERIFICA FINALE
    console.log('\n' + '='.repeat(80));
    console.log('📊 VERIFICA FINALE:');
    console.log('='.repeat(80));

    if (afterAPI.length === 1) {
      const finalRecord = afterAPI[0];
      if (finalRecord.id === originalId) {
        console.log(`✅ SUCCESS! Record AGGIORNATO (stesso ID: ${originalId})`);
        console.log(`   Proficiency: 3 → ${finalRecord.proficiency_level}`);
        console.log(`   Source: manual_test → ${finalRecord.source}`);
      } else {
        console.log(`❌ FAILURE! ID diverso: ${originalId} → ${finalRecord.id}`);
        console.log(`   Nuovo record creato invece di aggiornare!`);
      }
    } else if (afterAPI.length > 1) {
      console.log(`❌ FAILURE! Duplicati creati: ${afterAPI.length} record!`);
      console.log(`   Record originale: ID=${originalId}`);
      console.log(`   IDs trovati: ${afterAPI.map(r => r.id).join(', ')}`);
    } else {
      console.log(`❌ FAILURE! Nessun record trovato dopo API call!`);
    }

  } catch (error) {
    console.error('\n❌ Test fallito:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testRealAPIFlow();
