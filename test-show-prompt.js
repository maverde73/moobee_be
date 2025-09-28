/**
 * Test script per visualizzare il prompt completo con soft skills
 */

const axios = require('axios');

async function showGeneratedPrompt() {
  console.log('🔍 Showing generated prompt with soft skills...\n');

  // Dati di test con soft skills per il ruolo Bioinformatics Scientists (ID: 37)
  const testData = {
    type: 'big-five',
    name: 'Assessment Big Five per Bioinformatics Scientists',
    description: 'Valutazione personalità per ruolo scientifico',
    count: 10,
    language: 'it',
    questionType: 'multiple_choice',
    suggestedRoles: ['37:Bioinformatics Scientists'],
    roleSoftSkills: [
      {
        roleId: 37,
        roleName: 'Bioinformatics Scientists',
        skills: [
          {
            name: 'Capacità Decisionale',
            nameEn: 'Decision Making',
            priority: 1,
            minScore: 85,
            category: 'adaptive'
          },
          {
            name: 'Resilienza',
            nameEn: 'Resilience',
            priority: 2,
            minScore: 80,
            category: 'adaptive'
          },
          {
            name: 'Comunicazione Efficace',
            nameEn: 'Effective Communication',
            priority: 3,
            minScore: 75,
            category: 'relational'
          },
          {
            name: 'Lavoro di Squadra',
            nameEn: 'Teamwork',
            priority: 4,
            minScore: 70,
            category: 'collaborative'
          },
          {
            name: 'Problem Solving',
            nameEn: 'Problem Solving',
            priority: 5,
            minScore: 65,
            category: 'cognitive'
          },
          {
            name: 'Pensiero Critico',
            nameEn: 'Critical Thinking',
            priority: 6,
            minScore: 60,
            category: 'cognitive'
          },
          {
            name: 'Adattabilità',
            nameEn: 'Adaptability',
            priority: 7,
            minScore: 55,
            category: 'adaptive'
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(
      'http://localhost:3000/api/assessments/ai/generate-questions',
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success && response.data.data.aiConfig && response.data.data.aiConfig.prompt) {
      console.log('📄 PROMPT GENERATO PER L\'AI:\n');
      console.log('=' . repeat(80));
      console.log(response.data.data.aiConfig.prompt);
      console.log('=' . repeat(80));

      // Analizza il contenuto del prompt
      const prompt = response.data.data.aiConfig.prompt;
      console.log('\n📊 ANALISI DEL PROMPT:');
      console.log('- Contiene sezione soft skills:', prompt.includes('RUOLI TARGET') ? '✅ Sì' : '❌ No');
      console.log('- Contiene skills critici:', prompt.includes('SOFT SKILLS CRITICI') ? '✅ Sì' : '❌ No');
      console.log('- Contiene skills importanti:', prompt.includes('SOFT SKILLS IMPORTANTI') ? '✅ Sì' : '❌ No');
      console.log('- Contiene skills complementari:', prompt.includes('SOFT SKILLS COMPLEMENTARI') ? '✅ Sì' : '❌ No');

      // Conta le menzioni dei soft skills
      const skillsMentioned = [];
      testData.roleSoftSkills[0].skills.forEach(skill => {
        if (prompt.includes(skill.name)) {
          skillsMentioned.push(skill.name);
        }
      });

      console.log('\n✅ Soft skills menzionati nel prompt:');
      skillsMentioned.forEach(skill => {
        console.log(`  - ${skill}`);
      });

      console.log(`\n📈 Totale: ${skillsMentioned.length} su ${testData.roleSoftSkills[0].skills.length} soft skills inclusi`);

    } else {
      console.error('❌ Non è stato possibile recuperare il prompt');
    }

  } catch (error) {
    console.error('❌ Errore:', error.response?.data || error.message);
  }
}

// Run the test
showGeneratedPrompt()
  .then(() => {
    console.log('\n✅ Analisi completata!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test fallito:', error);
    process.exit(1);
  });