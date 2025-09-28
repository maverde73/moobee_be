/**
 * Script di Import per Mapping Ruoli-SoftSkills
 *
 * Questo script importa il mapping tra ruoli IT e soft skills richiesti
 * basandosi sulla matrice definita nel documento di specifica.
 *
 * Uso: node scripts/import-role-softskills-mapping.js
 */

const prisma = require('../src/config/database');
const fs = require('fs');
const path = require('path');

// Mapping dei soft skills con i loro ID corretti dal database
const SOFT_SKILLS = {
  'communication': 'cmfo594140000ahywibge3y3y',       // Effective Communication
  'active_listening': 'cmfo5942x0001ahywcqlvh5wu',    // Active Listening
  'empathy': 'cmfo594400002ahywe3h3ep82',             // Empathy
  'emotional_intelligence': 'cmfo5944w0003ahyws92o0w00', // Emotional Intelligence
  'teamwork': 'cmfo5945s0004ahywzeprlg7d',            // Teamwork
  'leadership': 'cmfo5946u0005ahywdl6lihc5',          // Leadership
  'critical_thinking': 'cmfo5947q0006ahywbhaxl13t',   // Critical Thinking
  'problem_solving': 'cmfo5948o0007ahywrjusdg0a',     // Problem Solving
  'adaptability': 'cmfo5949l0008ahyw2wlx6o0k',        // Flexibility and Adaptability
  'time_management': 'cmfo594aj0009ahywya4pq66d',     // Time Management
  'decision_making': 'cmfo594bl000aahyw5znp2fou',     // Decision Making
  'resilience': 'cmfo594cn000bahywhlt8lj4q',          // Resilience
  // Alias per soft skills che non esistono, mappati a simili
  'creativity': 'cmfo5947q0006ahywbhaxl13t',          // Usa Critical Thinking come proxy
  'learning_agility': 'cmfo5949l0008ahyw2wlx6o0k'    // Usa Adaptability come proxy
};

// Mapping dei ruoli con le loro priorità per soft skills
// Priorità: 1 (critico) - 7 (supportivo)
const ROLE_SKILLS_MAPPING = [
  // Software Development Roles
  { roleId: 15, roleName: 'Software Developer', skills: [
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'teamwork', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'learning_agility', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'communication', priority: 3, weight: 1.0, minScore: 50 },
    { skill: 'time_management', priority: 4, weight: 0.9, minScore: 40 }
  ]},

  { roleId: 14, roleName: 'Full Stack Developer', skills: [
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'adaptability', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'learning_agility', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'critical_thinking', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'teamwork', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'time_management', priority: 3, weight: 1.0, minScore: 50 }
  ]},

  { roleId: 19, roleName: 'DevOps Engineer', skills: [
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'adaptability', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'teamwork', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'resilience', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'communication', priority: 4, weight: 0.9, minScore: 50 }
  ]},

  // Data & Analytics Roles
  { roleId: 26, roleName: 'Data Scientist', skills: [
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 80 },
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'creativity', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'learning_agility', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'communication', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'decision_making', priority: 3, weight: 1.0, minScore: 55 }
  ]},

  { roleId: 27, roleName: 'Data Analyst', skills: [
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'problem_solving', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'communication', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'time_management', priority: 3, weight: 1.0, minScore: 50 },
    { skill: 'teamwork', priority: 4, weight: 0.9, minScore: 45 },
    { skill: 'adaptability', priority: 5, weight: 0.8, minScore: 40 }
  ]},

  { roleId: 37, roleName: 'Bioinformatics Scientists', skills: [
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 80 },
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 80 },
    { skill: 'learning_agility', priority: 2, weight: 1.3, minScore: 70 },
    { skill: 'creativity', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'resilience', priority: 3, weight: 1.0, minScore: 60 },
    { skill: 'communication', priority: 4, weight: 0.9, minScore: 50 }
  ]},

  // Management Roles
  { roleId: 1, roleName: 'IT Manager', skills: [
    { skill: 'leadership', priority: 1, weight: 1.5, minScore: 80 },
    { skill: 'communication', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'decision_making', priority: 2, weight: 1.3, minScore: 70 },
    { skill: 'emotional_intelligence', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'problem_solving', priority: 3, weight: 1.0, minScore: 60 },
    { skill: 'teamwork', priority: 3, weight: 1.0, minScore: 60 }
  ]},

  { roleId: 2, roleName: 'Project Manager', skills: [
    { skill: 'leadership', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'communication', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'time_management', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'problem_solving', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'adaptability', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'emotional_intelligence', priority: 3, weight: 1.0, minScore: 55 }
  ]},

  { roleId: 22, roleName: 'Product Manager', skills: [
    { skill: 'leadership', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'communication', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'decision_making', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'creativity', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'critical_thinking', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'adaptability', priority: 3, weight: 1.0, minScore: 55 }
  ]},

  // Security & Infrastructure
  { roleId: 20, roleName: 'Cloud Architect', skills: [
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'creativity', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'communication', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'leadership', priority: 3, weight: 1.0, minScore: 50 },
    { skill: 'adaptability', priority: 4, weight: 0.9, minScore: 45 }
  ]},

  { roleId: 21, roleName: 'Security Manager', skills: [
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 80 },
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'decision_making', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'resilience', priority: 2, weight: 1.3, minScore: 70 },
    { skill: 'leadership', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'communication', priority: 3, weight: 1.0, minScore: 60 }
  ]},

  // Support & Operations
  { roleId: 8, roleName: 'IT Support Specialist', skills: [
    { skill: 'communication', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 65 },
    { skill: 'emotional_intelligence', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'teamwork', priority: 3, weight: 1.0, minScore: 50 },
    { skill: 'adaptability', priority: 3, weight: 1.0, minScore: 50 },
    { skill: 'resilience', priority: 4, weight: 0.9, minScore: 45 }
  ]},

  { roleId: 7, roleName: 'Systems Administrator', skills: [
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'critical_thinking', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'time_management', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'resilience', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'adaptability', priority: 4, weight: 0.9, minScore: 50 },
    { skill: 'communication', priority: 5, weight: 0.8, minScore: 45 }
  ]},

  // QA & Testing
  { roleId: 24, roleName: 'QA Engineer', skills: [
    { skill: 'critical_thinking', priority: 1, weight: 1.5, minScore: 75 },
    { skill: 'problem_solving', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'time_management', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'communication', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'teamwork', priority: 3, weight: 1.0, minScore: 50 },
    { skill: 'resilience', priority: 4, weight: 0.9, minScore: 45 }
  ]},

  // Design & UX
  { roleId: 17, roleName: 'UX/UI Designer', skills: [
    { skill: 'creativity', priority: 1, weight: 1.5, minScore: 80 },
    { skill: 'communication', priority: 1, weight: 1.5, minScore: 70 },
    { skill: 'emotional_intelligence', priority: 2, weight: 1.3, minScore: 65 },
    { skill: 'critical_thinking', priority: 2, weight: 1.3, minScore: 60 },
    { skill: 'teamwork', priority: 3, weight: 1.0, minScore: 55 },
    { skill: 'adaptability', priority: 4, weight: 0.9, minScore: 50 }
  ]}
];

async function importRoleSoftSkillsMapping() {
  console.log('🚀 Inizio import mapping ruoli-soft skills...\n');

  try {
    // Prima verifichiamo che i soft skills esistano
    console.log('📋 Verifica soft skills nel database...');
    const existingSoftSkills = await prisma.softSkill.findMany();
    console.log(`✅ Trovati ${existingSoftSkills.length} soft skills\n`);

    // Creiamo una mappa per ID soft skills
    const softSkillsMap = {};
    existingSoftSkills.forEach(skill => {
      // Mappiamo per nome normalizzato
      const normalizedName = skill.nameEn?.toLowerCase().replace(/\s+/g, '_') ||
                           skill.name.toLowerCase().replace(/\s+/g, '_');
      softSkillsMap[normalizedName] = skill.id;
    });

    // Prima eliminiamo i mapping esistenti (opzionale)
    console.log('🗑️  Pulizia mapping esistenti...');
    const deleted = await prisma.roleSoftSkill.deleteMany();
    console.log(`   Eliminati ${deleted.count} mapping esistenti\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    // Processiamo ogni ruolo
    for (const roleMapping of ROLE_SKILLS_MAPPING) {
      console.log(`\n📌 Processing role: ${roleMapping.roleName} (ID: ${roleMapping.roleId})`);

      // Verifichiamo che il ruolo esista
      const roles = await prisma.$queryRaw`
        SELECT id, "Role", "NameKnown_Role"
        FROM roles
        WHERE id = ${roleMapping.roleId}
        LIMIT 1
      `;

      if (!roles || roles.length === 0) {
        console.log(`   ⚠️  Ruolo ${roleMapping.roleId} non trovato - skip`);
        totalSkipped++;
        continue;
      }

      // Creiamo i mapping per ogni soft skill del ruolo
      for (const skillMapping of roleMapping.skills) {
        const softSkillId = softSkillsMap[skillMapping.skill] || SOFT_SKILLS[skillMapping.skill];

        if (!softSkillId) {
          console.log(`   ⚠️  Soft skill '${skillMapping.skill}' non trovato - skip`);
          totalSkipped++;
          continue;
        }

        try {
          const created = await prisma.roleSoftSkill.create({
            data: {
              roleId: roleMapping.roleId,
              softSkillId: softSkillId,
              priority: skillMapping.priority,
              weight: skillMapping.weight,
              isRequired: skillMapping.priority <= 2, // Critico se priorità 1-2
              minScore: skillMapping.minScore
            }
          });

          console.log(`   ✅ Mappato: ${skillMapping.skill} (priority ${skillMapping.priority})`);
          totalCreated++;
        } catch (error) {
          console.log(`   ❌ Errore mapping ${skillMapping.skill}: ${error.message}`);
          totalSkipped++;
        }
      }
    }

    // Aggiungiamo anche mapping per ruoli generici se non presenti
    console.log('\n📋 Aggiunta mapping generici per ruoli senza mapping specifico...');

    // Ruoli generici con soft skills base
    const genericSkills = [
      { skill: 'communication', priority: 3, weight: 1.0, minScore: 40 },
      { skill: 'teamwork', priority: 3, weight: 1.0, minScore: 40 },
      { skill: 'problem_solving', priority: 4, weight: 0.9, minScore: 35 },
      { skill: 'adaptability', priority: 5, weight: 0.8, minScore: 30 }
    ];

    // Trova ruoli senza mapping
    const rolesWithoutMapping = await prisma.$queryRaw`
      SELECT r.id, r."Role", r."NameKnown_Role"
      FROM roles r
      WHERE NOT EXISTS (
        SELECT 1 FROM role_soft_skills rs WHERE rs."roleId" = r.id
      )
      LIMIT 10
    `;

    for (const role of rolesWithoutMapping) {
      console.log(`\n   Adding generic skills to: ${role.Role || role.NameKnown_Role} (ID: ${role.id})`);

      for (const skillMapping of genericSkills) {
        const softSkillId = softSkillsMap[skillMapping.skill] || SOFT_SKILLS[skillMapping.skill];

        if (softSkillId) {
          try {
            await prisma.roleSoftSkill.create({
              data: {
                roleId: role.id,
                softSkillId: softSkillId,
                priority: skillMapping.priority,
                weight: skillMapping.weight,
                isRequired: false,
                minScore: skillMapping.minScore
              }
            });
            totalCreated++;
          } catch (error) {
            // Ignora errori duplicati
          }
        }
      }
    }

    // Report finale
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORT FINALE');
    console.log('='.repeat(60));
    console.log(`✅ Mapping creati: ${totalCreated}`);
    console.log(`⚠️  Mapping saltati: ${totalSkipped}`);

    // Verifica finale
    const finalCount = await prisma.roleSoftSkill.count();
    const uniqueRoles = await prisma.roleSoftSkill.groupBy({
      by: ['roleId'],
      _count: true
    });

    console.log(`\n📈 Statistiche Database:`);
    console.log(`   - Totale mapping: ${finalCount}`);
    console.log(`   - Ruoli con mapping: ${uniqueRoles.length}`);
    console.log(`   - Media skills per ruolo: ${(finalCount / uniqueRoles.length).toFixed(1)}`);

  } catch (error) {
    console.error('\n❌ Errore durante import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esecuzione
importRoleSoftSkillsMapping()
  .then(() => {
    console.log('\n✨ Import completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });