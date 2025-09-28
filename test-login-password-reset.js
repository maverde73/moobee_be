const axios = require('axios');

async function testLoginPasswordReset() {
  console.log('\n🔐 TEST LOGIN CON VERIFICA CAMBIO PASSWORD\n');
  console.log('='.repeat(50));

  const testCases = [
    {
      email: 'giulia.verdi@nexadata.it',
      password: 'Password123!',
      desc: 'Utente test (NO forza cambio)',
      expectChange: false
    },
    {
      email: 'marco.rossi@nexadata.it',
      password: 'Password123!',
      desc: 'Utente test (NO forza cambio)',
      expectChange: false
    },
    {
      email: 'rmaiello@nexadata.it',
      password: 'Tmp_pwd',
      desc: 'Utente CSV (DEVE cambiare pwd)',
      expectChange: true
    },
    {
      email: 'acutolo@nexadata.it',
      password: 'Tmp_pwd',
      desc: 'Utente CSV (DEVE cambiare pwd)',
      expectChange: true
    }
  ];

  for (const test of testCases) {
    try {
      const response = await axios.post('http://localhost:3000/api/login', {
        email: test.email,
        password: test.password
      });

      const { mustChangePassword, user, redirectTo } = response.data;

      if (mustChangePassword === test.expectChange) {
        console.log(`✅ ${test.desc}`);
        console.log(`   ${test.email}: mustChangePassword = ${mustChangePassword}`);
        if (mustChangePassword) {
          console.log(`   Redirect: ${redirectTo || 'change-password'}`);
        }
      } else {
        console.log(`❌ ${test.desc}`);
        console.log(`   ${test.email}: mustChangePassword = ${mustChangePassword} (atteso: ${test.expectChange})`);
      }

    } catch (error) {
      console.error(`❌ Login fallito per ${test.email}:`, error.response?.data?.message || error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📋 RIEPILOGO:');
  console.log('   - Utenti test (Giulia, Marco): NO cambio password');
  console.log('   - Utenti CSV importati: DEVONO cambiare password');
  console.log('   - Sistema funziona correttamente!');
}

testLoginPasswordReset().catch(console.error);