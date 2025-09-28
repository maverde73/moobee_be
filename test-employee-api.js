// Test with curl
const { exec } = require('child_process');

// Generate a test token
exec('node generate-test-token.js', (error, stdout, stderr) => {
  if (error) {
    console.error('Error generating token:', error);
    return;
  }

  const token = stdout.trim();
  console.log('Got token:', token.substring(0, 20) + '...');

  // Now test the API
  const curlCmd = `curl -s -H "Authorization: Bearer ${token}" "http://localhost:3000/api/employees?page=1&limit=3"`;
  
  exec(curlCmd, (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    try {
      const data = JSON.parse(stdout);
      console.log('\n=== API Response ===');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.success && data.data && data.data.employees) {
        console.log('\n=== Employee Names ===');
        data.data.employees.forEach(emp => {
          console.log(`- name: "${emp.name}"`);
          console.log(`  first_name: "${emp.first_name}"`);
          console.log(`  last_name: "${emp.last_name}"`);
          console.log(`  email: ${emp.email}`);
        });
      }
    } catch (e) {
      console.log('Raw response:', stdout);
    }
  });
});
