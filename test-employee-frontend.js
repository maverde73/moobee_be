const axios = require('axios');

async function testEmployeeDetailFrontend() {
  console.log('\n🔍 TEST EMPLOYEE DETAIL FRONTEND\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Login to get token
    console.log('\n1️⃣ Login con Roberta Maiello (Nexa Data HR)...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'rmaiello@nexadata.it',
      password: 'Password123!'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login fallito');
      return;
    }

    const { accessToken } = loginResponse.data;
    console.log('✅ Login riuscito, token ottenuto');

    // Step 2: Test employee endpoint with token
    console.log('\n2️⃣ Test GET /api/employees/166...');
    const employeeResponse = await axios.get('http://localhost:3000/api/employees/166', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (employeeResponse.data.success) {
      const employee = employeeResponse.data.data;
      console.log('✅ Dati employee ricevuti:');
      console.log('   - ID:', employee.id);
      console.log('   - Nome:', employee.first_name, employee.last_name);
      console.log('   - Email:', employee.email);
      console.log('   - Tenant:', employee.tenant_id);
      console.log('   - Department:', employee.departments?.department_name || 'N/D');

      if (employee.tenant_user) {
        console.log('\n📋 User Info:');
        console.log('   - Role:', employee.tenant_user.role);
        console.log('   - Is Active:', employee.tenant_user.is_active);
      }

      if (employee.employee_skills?.length > 0) {
        console.log(`\n⭐ Skills: ${employee.employee_skills.length} skills trovate`);
      }

      if (employee.employee_roles?.length > 0) {
        console.log(`👔 Roles: ${employee.employee_roles.length} roles trovati`);
      }

      console.log('\n✅ API funziona correttamente, i dati sono disponibili per il frontend');
    } else {
      console.log('❌ Risposta non valida:', employeeResponse.data);
    }

  } catch (error) {
    console.error('❌ Errore:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST COMPLETATO');
  console.log('\n📝 Per testare visivamente:');
  console.log('   1. Vai su http://localhost:5173/login');
  console.log('   2. Clicca su "Giulia Verdi (HR)"');
  console.log('   3. Vai su http://localhost:5173/employee/166');
  console.log('   4. Dovresti vedere i dati di Christian Abd El Messih');
}

testEmployeeDetailFrontend().catch(console.error);