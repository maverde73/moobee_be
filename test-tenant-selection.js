/**
 * Script di test per la selezione degli assessment da parte del tenant
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testTenantSelection() {
  try {
    console.log('🧪 Testing Tenant Assessment Selection...\n');

    // 1. Recupera tutti gli assessment disponibili
    console.log('1. Fetching available assessments...');
    const assessmentsResponse = await axios.get(`${API_BASE}/assessments`, {
      params: {
        page: 1,
        limit: 10,
        status: 'published'
      }
    });

    const assessments = assessmentsResponse.data.data;
    console.log(`   Found ${assessments.length} assessments`);

    if (assessments.length === 0) {
      console.log('   ❌ No assessments found. Please run the seed script first.');
      return;
    }

    // 2. Seleziona i primi 3 assessment
    const selectedIds = assessments.slice(0, 3).map(a => a.id);
    const tenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // UUID valido dal database

    console.log(`\n2. Selecting ${selectedIds.length} assessments for tenant ${tenantId}...`);
    console.log('   Selected IDs:', selectedIds);

    const selectionResponse = await axios.put(
      `${API_BASE}/assessments/tenant/${tenantId}/selections`,
      {
        templateIds: selectedIds
      }
    );

    console.log(`   ✅ Selection successful!`);
    console.log(`   - Added: ${selectionResponse.data.stats.added}`);
    console.log(`   - Reactivated: ${selectionResponse.data.stats.reactivated}`);
    console.log(`   - Deactivated: ${selectionResponse.data.stats.deactivated}`);

    // 3. Verifica le selezioni
    console.log(`\n3. Verifying tenant selections...`);
    const verificationsResponse = await axios.get(
      `${API_BASE}/assessments/tenant/${tenantId}/selections`
    );

    console.log(`   ✅ Found ${verificationsResponse.data.data.length} active selections`);

    // 4. Recupera il catalogo con lo stato di selezione
    console.log(`\n4. Fetching catalog with selection status...`);
    const catalogResponse = await axios.get(`${API_BASE}/assessments/catalog`, {
      params: {
        tenantId
      }
    });

    const withSelectionStatus = catalogResponse.data.data;
    const selected = withSelectionStatus.filter(a => a.isSelected);
    const notSelected = withSelectionStatus.filter(a => !a.isSelected);

    console.log(`   ✅ Catalog loaded successfully`);
    console.log(`   - Selected: ${selected.length} assessments`);
    console.log(`   - Not selected: ${notSelected.length} assessments`);

    // 5. Mostra un esempio di assessment selezionato
    if (selected.length > 0) {
      console.log('\n5. Example of selected assessment:');
      const example = selected[0];
      console.log(`   - Title: ${example.title}`);
      console.log(`   - Type: ${example.type}`);
      console.log(`   - Is Selected: ${example.isSelected}`);
      console.log(`   - Selected At: ${example.selectedAt}`);
    }

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url
    });
  }
}

// Esegui il test
testTenantSelection();