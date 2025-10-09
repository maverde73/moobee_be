const axios = require('axios');

async function testSkillsAPI() {
  try {
    // Login first
    const loginRes = await axios.post('http://localhost:3000/api/login', {
      email: 'mlamacchia@nexadata.it',
      password: 'Password123!'
    });

    if (!loginRes.data.success) {
      console.error('Login failed:', loginRes.data);
      return;
    }

    const token = loginRes.data.accessToken || loginRes.data.token;
    if (!token) {
      console.error('No token in response:', loginRes.data);
      return;
    }
    console.log('✅ Login successful\n');

    // Fetch skills
    const skillsRes = await axios.get('http://localhost:3000/api/employees/91/skills', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!skillsRes.data.success) {
      console.error('Skills fetch failed:', skillsRes.data);
      return;
    }

    const hardSkills = skillsRes.data.data.hard;
    console.log(`📊 Total hard skills: ${hardSkills.length}\n`);

    // Check for duplicate IDs
    const ids = hardSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    const duplicateCount = ids.length - uniqueIds.size;

    console.log(`🔑 Unique IDs: ${uniqueIds.size}`);
    console.log(`❌ Duplicate IDs: ${duplicateCount}\n`);

    if (duplicateCount > 0) {
      // Find which IDs are duplicated
      const idCounts = {};
      ids.forEach(id => {
        idCounts[id] = (idCounts[id] || 0) + 1;
      });

      const duplicatedIds = Object.entries(idCounts)
        .filter(([id, count]) => count > 1)
        .map(([id, count]) => `${id} (x${count})`);

      console.log('🚨 Duplicated IDs:', duplicatedIds.join(', '));
    } else {
      console.log('✅ No duplicate IDs found!');
    }

    // Show first 5 skills with their IDs
    console.log('\n📋 First 5 skills:');
    hardSkills.slice(0, 5).forEach(skill => {
      console.log(`  ID: ${skill.id} | skill_id: ${skill.skill_id} | ${skill.name}`);
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSkillsAPI();
