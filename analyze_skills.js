const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const extractedSkills = [
  {"id": 628, "skill_name": "Angular"},
  {"id": 225, "skill_name": "Bootstrap"},
  {"id": 1365, "skill_name": "React"},
  {"id": 376, "skill_name": "CMS"},
  {"id": 1811, "skill_name": "React Final"},
  {"id": 1811, "skill_name": "React Final Form Array"},
  {"id": 1811, "skill_name": "Redux"},
  {"id": 1811, "skill_name": "ngRedux"},
  {"id": 1811, "skill_name": "CKEditor"},
  {"id": 1811, "skill_name": "ngx-graph"},
  {"id": 1682, "skill_name": "TypeScript"},
  {"id": 821, "skill_name": "JavaScript"},
  {"id": 693, "skill_name": "HTML"},
  {"id": 1597, "skill_name": "SCSS"},
  {"id": 823, "skill_name": "JSON"},
  {"id": 163, "skill_name": "Jira"},
  {"id": 123, "skill_name": "SVN"},
  {"id": 1394, "skill_name": "REST"},
  {"id": 617, "skill_name": "Git"},
  {"id": 1473, "skill_name": "Shell Scripting"},
  {"id": 1203, "skill_name": "Java Web Development"},
  {"id": 1537, "skill_name": "Spring Framework"},
  {"id": 1811, "skill_name": "JdbcDaoSupport"},
  {"id": 675, "skill_name": "Hibernate ORM"},
  {"id": 1189, "skill_name": "Oracle Database"},
  {"id": 1564, "skill_name": "SQL"},
  {"id": 1084, "skill_name": "MySQL"},
  {"id": 1811, "skill_name": "Eclipse"}
];

async function analyzeSkills() {
  console.log('='.repeat(80));
  console.log('ANALISI SKILLS - VERIFICA DATABASE');
  console.log('='.repeat(80));
  console.log('');
  
  const results = {
    found: [],
    notFound: [],
    wrongId: []
  };
  
  for (const skill of extractedSkills) {
    const skillName = skill.skill_name.trim();
    const pythonId = skill.id;
    
    console.log(`\n🔍 Analyzing: "${skillName}" (Python ID: ${pythonId})`);
    
    // Level 1: Exact match on Skill
    let found = await prisma.skills.findFirst({
      where: { Skill: { equals: skillName, mode: 'insensitive' } },
      select: { id: true, Skill: true, NameKnown_Skill: true }
    });
    
    if (found) {
      console.log(`   ✅ FOUND - Level 1 (Skill exact): ID ${found.id} - "${found.Skill}"`);
      if (pythonId !== found.id) {
        console.log(`   ⚠️  Python ID ${pythonId} is WRONG! Correct ID is ${found.id}`);
        results.wrongId.push({ skill_name: skillName, python_id: pythonId, correct_id: found.id, found_in: 'Skill (exact)' });
      } else {
        results.found.push({ skill_name: skillName, id: found.id, found_in: 'Skill (exact)', match: 'CORRECT' });
      }
      continue;
    }
    
    // Level 2: Exact match on NameKnown_Skill
    found = await prisma.skills.findFirst({
      where: { NameKnown_Skill: { equals: skillName, mode: 'insensitive' } },
      select: { id: true, Skill: true, NameKnown_Skill: true }
    });
    
    if (found) {
      console.log(`   ✅ FOUND - Level 2 (NameKnown exact): ID ${found.id} - "${found.Skill}"`);
      if (pythonId !== found.id) {
        console.log(`   ⚠️  Python ID ${pythonId} is WRONG! Correct ID is ${found.id}`);
        results.wrongId.push({ skill_name: skillName, python_id: pythonId, correct_id: found.id, found_in: 'NameKnown_Skill (exact)' });
      } else {
        results.found.push({ skill_name: skillName, id: found.id, found_in: 'NameKnown_Skill (exact)', match: 'CORRECT' });
      }
      continue;
    }
    
    // Level 3: Partial match on Skill
    found = await prisma.skills.findFirst({
      where: { Skill: { contains: skillName, mode: 'insensitive' } },
      select: { id: true, Skill: true }
    });
    
    if (found) {
      console.log(`   ✅ FOUND - Level 3 (Skill partial): ID ${found.id} - "${found.Skill}"`);
      if (pythonId !== found.id) {
        console.log(`   ⚠️  Python ID ${pythonId} is WRONG! Correct ID is ${found.id}`);
        results.wrongId.push({ skill_name: skillName, python_id: pythonId, correct_id: found.id, found_in: 'Skill (partial)' });
      } else {
        results.found.push({ skill_name: skillName, id: found.id, found_in: 'Skill (partial)', match: 'CORRECT' });
      }
      continue;
    }
    
    // Level 4: Partial match on NameKnown_Skill
    found = await prisma.skills.findFirst({
      where: { NameKnown_Skill: { contains: skillName, mode: 'insensitive' } },
      select: { id: true, Skill: true }
    });
    
    if (found) {
      console.log(`   ✅ FOUND - Level 4 (NameKnown partial): ID ${found.id} - "${found.Skill}"`);
      if (pythonId !== found.id) {
        console.log(`   ⚠️  Python ID ${pythonId} is WRONG! Correct ID is ${found.id}`);
        results.wrongId.push({ skill_name: skillName, python_id: pythonId, correct_id: found.id, found_in: 'NameKnown_Skill (partial)' });
      } else {
        results.found.push({ skill_name: skillName, id: found.id, found_in: 'NameKnown_Skill (partial)', match: 'CORRECT' });
      }
      continue;
    }
    
    // Level 5: Search in Synonyms_Skill
    const synonymResult = await prisma.$queryRaw`
      SELECT id, "Skill", "NameKnown_Skill"
      FROM skills
      WHERE EXISTS (
        SELECT 1 FROM unnest("Synonyms_Skill") AS syn
        WHERE LOWER(syn) = LOWER(${skillName})
      )
      LIMIT 1
    `;
    
    if (synonymResult && synonymResult.length > 0) {
      found = synonymResult[0];
      console.log(`   ✅ FOUND - Level 5 (Synonyms): ID ${found.id} - "${found.Skill}"`);
      if (pythonId !== found.id) {
        console.log(`   ⚠️  Python ID ${pythonId} is WRONG! Correct ID is ${found.id}`);
        results.wrongId.push({ skill_name: skillName, python_id: pythonId, correct_id: found.id, found_in: 'Synonyms_Skill' });
      } else {
        results.found.push({ skill_name: skillName, id: found.id, found_in: 'Synonyms_Skill', match: 'CORRECT' });
      }
      continue;
    }
    
    // Not found
    console.log(`   ❌ NOT FOUND in database`);
    results.notFound.push({ skill_name: skillName, python_id: pythonId });
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESOCONTO FINALE');
  console.log('='.repeat(80));
  
  console.log(`\n✅ TROVATE CON ID CORRETTO: ${results.found.length}`);
  results.found.forEach(r => {
    console.log(`   - ${r.skill_name} → ID ${r.id} (${r.found_in})`);
  });
  
  console.log(`\n⚠️  TROVATE MA CON ID SBAGLIATO: ${results.wrongId.length}`);
  results.wrongId.forEach(r => {
    console.log(`   - ${r.skill_name} → Python ID ${r.python_id} (WRONG) | Correct ID ${r.correct_id} (${r.found_in})`);
  });
  
  console.log(`\n❌ NON TROVATE: ${results.notFound.length}`);
  results.notFound.forEach(r => {
    console.log(`   - ${r.skill_name} (Python ID: ${r.python_id})`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`TOTALE: ${extractedSkills.length} skills analizzate`);
  console.log(`  - Corrette: ${results.found.length}`);
  console.log(`  - Da correggere: ${results.wrongId.length}`);
  console.log(`  - Da aggiungere al DB: ${results.notFound.length}`);
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
}

analyzeSkills().catch(console.error);
