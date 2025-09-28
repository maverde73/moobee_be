/**
 * Test del catalogo assessment con le tabelle corrette
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function testAssessmentCatalog() {
  try {
    console.log('🧪 Testing Assessment Catalog System\n');
    console.log('📋 Tabelle utilizzate:');
    console.log('   - assessment_templates: Catalogo completo');
    console.log('   - tenant_assessment_selections: Selezioni del tenant');
    console.log('   - assessments: (legacy - da rimuovere/aggiornare)\n');

    // 1. Test catalogo completo
    console.log('1. Recupero catalogo completo da assessment_templates...');
    const catalogResponse = await axios.get(`${API_BASE}/assessments/catalog`, {
      params: {
        tenantId: TENANT_ID,
        page: 1,
        limit: 10
      }
    });

    const catalog = catalogResponse.data.data;
    const metadata = catalogResponse.data.metadata;

    console.log(`   ✅ Trovati ${catalog.length} template nel catalogo`);
    console.log(`   📊 Totale template nel database: ${metadata.totalCount}`);
    console.log(`   📄 Pagine totali: ${metadata.totalPages}`);

    // 2. Conta i template per tipo
    const typeCount = {};
    catalog.forEach(template => {
      const type = template.type || 'CUSTOM';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    console.log('\n2. Distribuzione per tipo:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} template`);
    });

    // 3. Verifica selezioni del tenant
    const selected = catalog.filter(t => t.isSelected);
    const notSelected = catalog.filter(t => !t.isSelected);

    console.log('\n3. Stato selezioni per il tenant:');
    console.log(`   ✅ Selezionati: ${selected.length} template`);
    console.log(`   ⏳ Non selezionati: ${notSelected.length} template`);

    if (selected.length > 0) {
      console.log('\n   Template selezionati:');
      selected.forEach(t => {
        console.log(`   - ${t.title} (${t.type}) - Selezionato il: ${new Date(t.selectedAt).toLocaleDateString()}`);
      });
    }

    // 4. Test selezione di nuovi template
    if (notSelected.length > 0) {
      console.log('\n4. Test selezione nuovi template...');
      const toSelect = notSelected.slice(0, 2).map(t => t.id);

      const selectionResponse = await axios.put(
        `${API_BASE}/assessments/tenant/${TENANT_ID}/selections`,
        { templateIds: [...selected.map(t => t.id), ...toSelect] }
      );

      if (selectionResponse.data.success) {
        console.log(`   ✅ Aggiunti ${selectionResponse.data.stats.added} nuovi template`);
      }
    }

    // 5. Verifica template attivi
    console.log('\n5. Verifica template attivi:');
    const activeTemplates = catalog.filter(t => t.status === 'published');
    const draftTemplates = catalog.filter(t => t.status === 'draft');

    console.log(`   - Published: ${activeTemplates.length} template`);
    console.log(`   - Draft: ${draftTemplates.length} template`);

    // 6. Template con più domande
    const sortedByQuestions = [...catalog].sort((a, b) => b.questionsCount - a.questionsCount);
    console.log('\n6. Top 3 template per numero di domande:');
    sortedByQuestions.slice(0, 3).forEach(t => {
      console.log(`   - ${t.title}: ${t.questionsCount} domande`);
    });

    console.log('\n✅ Test completato con successo!');
    console.log('\n📝 Note:');
    console.log('   - Il catalogo legge da "assessment_templates"');
    console.log('   - Le selezioni sono salvate in "tenant_assessment_selections"');
    console.log('   - La tabella "assessments" è legacy e va aggiornata per le istanze');

  } catch (error) {
    console.error('\n❌ Test fallito:', error.response?.data || error.message);
  }
}

// Esegui il test
testAssessmentCatalog();