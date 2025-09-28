/**
 * Script per ottenere un token di autenticazione valido
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE}/login`, {
      email: 'superadmin@test.com',
      password: 'Test123!'
    });

    if (response.data.access_token) {
      console.log('✅ Token ottenuto con successo!\n');
      console.log('Token da usare in seed-engagement-templates.js:');
      console.log('----------------------------------------');
      console.log(response.data.access_token);
      console.log('----------------------------------------\n');
      console.log('Copia il token sopra e sostituiscilo nella variabile AUTH_TOKEN in seed-engagement-templates.js');
      return response.data.access_token;
    }
  } catch (error) {
    console.error('❌ Errore nel login:', error.response?.data || error.message);
    console.log('\nProva con queste credenziali nel file:');
    console.log('email: rmaiello@nexadata.it');
    console.log('password: password123');
  }
}

getAuthToken();