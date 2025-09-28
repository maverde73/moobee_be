const axios = require('axios');

async function testLogin(email, password, description) {
  try {
    const response = await axios.post('http://localhost:3000/api/login', {
      email,
      password
    });

    if (response.data.success) {
      const { firstName, lastName, role, position } = response.data.user;
      console.log(`✅ ${description}: ${firstName} ${lastName}`);
      console.log(`   Role: ${role}, Position: ${position || 'N/A'}`);
      return true;
    }
  } catch (error) {
    console.log(`❌ ${description}: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testAllLogins() {
  console.log('\n🔐 TEST LOGIN UTENTI NEXA REIMPORTATI');
  console.log('='.repeat(50));
  console.log('Schema: first_name/last_name SOLO in employees');
  console.log('='.repeat(50) + '\n');

  const testUsers = [
    // HR Users
    { email: 'giulia.verdi@nexadata.it', password: 'Password123!', desc: 'HR Test (Giulia)' },
    { email: 'rmaiello@nexadata.it', password: 'Tmp_pwd', desc: 'HR (Raffaella)' },
    { email: 'mgiurelli@nexadata.it', password: 'Tmp_pwd', desc: 'HR (Massimiliano)' },
    { email: 'afichera@nexadata.it', password: 'Tmp_pwd', desc: 'HR (Anita)' },

    // Regular Employees
    { email: 'marco.rossi@nexadata.it', password: 'Password123!', desc: 'Employee Test (Marco)' },
    { email: 'acutolo@nexadata.it', password: 'Tmp_pwd', desc: 'Employee (Andrea C.)' },
    { email: 'fferrari@nexadata.it', password: 'Tmp_pwd', desc: 'Employee (Francesco)' },
    { email: 'screscenzi@nexadata.it', password: 'Tmp_pwd', desc: 'Employee (Simone)' },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const user of testUsers) {
    const success = await testLogin(user.email, user.password, user.desc);
    if (success) successCount++;
    else failCount++;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RISULTATI TEST LOGIN');
  console.log('='.repeat(50));
  console.log(`✅ Successi: ${successCount}/${testUsers.length}`);
  console.log(`❌ Fallimenti: ${failCount}/${testUsers.length}`);

  if (successCount === testUsers.length) {
    console.log('\n🎉 TUTTI I LOGIN FUNZIONANO CORRETTAMENTE!');
    console.log('   Database migration completata con successo');
    console.log('   Single Source of Truth implementato');
  }
}

testAllLogins().catch(console.error);