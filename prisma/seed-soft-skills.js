const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const prisma = new PrismaClient();

// Le 12 Soft Skills principali
const SOFT_SKILLS = [
  {
    code: 'communication_effective',
    name: 'Comunicazione Efficace',
    nameEn: 'Effective Communication',
    category: 'relational',
    description: 'Capacità di trasmettere messaggi in modo chiaro e appropriato',
    descriptionEn: 'Ability to convey messages clearly and appropriately',
    orderIndex: 1
  },
  {
    code: 'active_listening',
    name: 'Ascolto Attivo',
    nameEn: 'Active Listening',
    category: 'relational',
    description: 'Capacità di prestare piena attenzione all\'interlocutore',
    descriptionEn: 'Ability to pay full attention to the speaker',
    orderIndex: 2
  },
  {
    code: 'empathy',
    name: 'Empatia',
    nameEn: 'Empathy',
    category: 'relational',
    description: 'Capacità di comprendere e sentire le emozioni altrui',
    descriptionEn: 'Ability to understand and feel others\' emotions',
    orderIndex: 3
  },
  {
    code: 'emotional_intelligence',
    name: 'Intelligenza Emotiva',
    nameEn: 'Emotional Intelligence',
    category: 'relational',
    description: 'Capacità di riconoscere e gestire emozioni proprie e altrui',
    descriptionEn: 'Ability to recognize and manage own and others\' emotions',
    orderIndex: 4
  },
  {
    code: 'teamwork',
    name: 'Lavoro di Squadra',
    nameEn: 'Teamwork',
    category: 'collaborative',
    description: 'Capacità di collaborare attivamente per obiettivi comuni',
    descriptionEn: 'Ability to actively collaborate for common goals',
    orderIndex: 5
  },
  {
    code: 'leadership',
    name: 'Leadership',
    nameEn: 'Leadership',
    category: 'collaborative',
    description: 'Capacità di guidare, motivare e ispirare altre persone',
    descriptionEn: 'Ability to guide, motivate and inspire others',
    orderIndex: 6
  },
  {
    code: 'critical_thinking',
    name: 'Pensiero Critico',
    nameEn: 'Critical Thinking',
    category: 'cognitive',
    description: 'Attitudine ad analizzare informazioni in modo oggettivo',
    descriptionEn: 'Aptitude to analyze information objectively',
    orderIndex: 7
  },
  {
    code: 'problem_solving',
    name: 'Problem Solving',
    nameEn: 'Problem Solving',
    category: 'cognitive',
    description: 'Capacità di affrontare problemi trovando soluzioni efficaci',
    descriptionEn: 'Ability to tackle problems finding effective solutions',
    orderIndex: 8
  },
  {
    code: 'flexibility',
    name: 'Flessibilità e Adattabilità',
    nameEn: 'Flexibility and Adaptability',
    category: 'adaptive',
    description: 'Capacità di adattarsi ai cambiamenti mantenendo efficienza',
    descriptionEn: 'Ability to adapt to changes while maintaining efficiency',
    orderIndex: 9
  },
  {
    code: 'time_management',
    name: 'Gestione del Tempo',
    nameEn: 'Time Management',
    category: 'adaptive',
    description: 'Abilità di organizzare e pianificare il proprio lavoro',
    descriptionEn: 'Ability to organize and plan own work',
    orderIndex: 10
  },
  {
    code: 'decision_making',
    name: 'Capacità Decisionale',
    nameEn: 'Decision Making',
    category: 'adaptive',
    description: 'Abilità di prendere decisioni tempestive e informate',
    descriptionEn: 'Ability to make timely and informed decisions',
    orderIndex: 11
  },
  {
    code: 'resilience',
    name: 'Resilienza',
    nameEn: 'Resilience',
    category: 'adaptive',
    description: 'Capacità di far fronte a stress e difficoltà',
    descriptionEn: 'Ability to cope with stress and difficulties',
    orderIndex: 12
  }
];

// Mapping delle soft skills dal CSV ai nostri codici
const CSV_SKILL_MAPPING = {
  'Comunicazione efficace': 'communication_effective',
  'Ascolto attivo': 'active_listening',
  'Empatia e ascolto attivo': 'empathy', // mappato su empatia
  'Intelligenza emotiva': 'emotional_intelligence',
  'Teamworking e collaborazione': 'teamwork',
  'Leadership e influenza': 'leadership',
  'Pensiero critico': 'critical_thinking',
  'Problem solving analitico': 'problem_solving',
  'Creatività e innovazione': 'problem_solving', // mappato su problem solving
  'Adattabilità e flessibilità': 'flexibility',
  'Gestione del tempo e delle priorità': 'time_management',
  'Capacità decisionale': 'decision_making',
  'Resilienza e gestione dello stress': 'resilience',
  'Gestione dei conflitti': 'emotional_intelligence', // mappato su intelligenza emotiva
  'Orientamento ai risultati': 'decision_making' // mappato su capacità decisionale
};

async function seedSoftSkills() {
  console.log('🌱 Seeding Soft Skills...');

  // Pulisci tabelle esistenti (in ordine per rispettare le foreign key)
  await prisma.assessmentSoftSkillScore.deleteMany();
  await prisma.questionSoftSkillMapping.deleteMany();
  await prisma.roleSoftSkill.deleteMany();
  await prisma.tenantSoftSkillProfile.deleteMany();
  await prisma.softSkill.deleteMany();

  // Crea le 12 soft skills
  for (const skill of SOFT_SKILLS) {
    await prisma.softSkill.create({
      data: {
        ...skill,
        evaluationCriteria: {
          bigFive: {},
          disc: {},
          belbin: {}
        }
      }
    });
    console.log(`✅ Created soft skill: ${skill.name}`);
  }
}

async function importRolesSkillsFromCSV() {
  console.log('\n📂 Importing Roles-Skills mapping from CSV...');
  console.log('⚠️ Skipping role mapping as roles table may not be populated yet');
  return; // Skip for now until roles are populated

  try {
    // Leggi il file CSV
    const csvPath = path.join(__dirname, '../../docs/ruoli_softskills.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    // Parse del CSV
    const records = csv.parse(fileContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true
    });

    // Ottieni tutte le soft skills dal database
    const softSkills = await prisma.softSkill.findMany();
    const skillsByCode = {};
    softSkills.forEach(skill => {
      skillsByCode[skill.code] = skill.id;
    });

    // Ottieni tutti i ruoli dal database
    // NOTA: Il modello roles ha @ignore nel Prisma schema, quindi dobbiamo usare raw query
    const roles = await prisma.$queryRaw`SELECT id, "Role" FROM roles WHERE id IS NOT NULL`;
    const rolesByName = {};
    roles.forEach(role => {
      if (role.Role) {
        rolesByName[role.Role.toLowerCase()] = role.id;
      }
    });

    let mappedCount = 0;
    let skippedCount = 0;

    // Per ogni riga del CSV
    for (const record of records) {
      const roleName = record['Ruolo'];
      if (!roleName) continue;

      // Cerca di trovare il ruolo nel database
      const roleNameLower = roleName.toLowerCase().replace(/ /g, '_');
      let roleId = rolesByName[roleNameLower] || rolesByName[roleName.toLowerCase()];

      if (!roleId) {
        // Se non troviamo il ruolo esatto, proviamo match parziali
        const roleKey = Object.keys(rolesByName).find(key =>
          key.includes(roleNameLower) || roleNameLower.includes(key)
        );
        if (roleKey) {
          roleId = rolesByName[roleKey];
        }
      }

      if (!roleId) {
        console.log(`⚠️ Role not found in database: ${roleName}`);
        skippedCount++;
        continue;
      }

      // Mappa le 7 soft skills per questo ruolo
      for (let i = 1; i <= 7; i++) {
        const skillName = record[`Soft Skill ${i}`];
        if (!skillName) continue;

        // Trova il codice della soft skill
        const skillCode = CSV_SKILL_MAPPING[skillName];
        if (!skillCode) {
          console.log(`⚠️ Unknown soft skill in CSV: ${skillName}`);
          continue;
        }

        const skillId = skillsByCode[skillCode];
        if (!skillId) {
          console.log(`⚠️ Soft skill not found in database: ${skillCode}`);
          continue;
        }

        // Crea il mapping ruolo-soft skill
        try {
          await prisma.roleSoftSkill.create({
            data: {
              roleId: roleId,
              softSkillId: skillId,
              priority: i,
              weight: 1.0,
              isRequired: i <= 3 // Le prime 3 sono required
            }
          });
          mappedCount++;
        } catch (error) {
          // Ignora duplicati
          if (!error.message.includes('Unique constraint')) {
            console.error(`Error mapping ${roleName} - ${skillName}:`, error.message);
          }
        }
      }

      console.log(`✅ Mapped skills for role: ${roleName}`);
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   - Roles processed: ${records.length}`);
    console.log(`   - Mappings created: ${mappedCount}`);
    console.log(`   - Roles skipped: ${skippedCount}`);

  } catch (error) {
    console.error('❌ Error importing CSV:', error);
    throw error;
  }
}

async function createDefaultProfiles() {
  console.log('\n👤 Creating default tenant profiles...');

  // Ottieni un tenant di esempio
  const tenant = await prisma.tenants.findFirst();
  if (!tenant) {
    console.log('⚠️ No tenant found, skipping profiles');
    return;
  }

  const softSkills = await prisma.softSkill.findMany();

  // Profilo Developer
  const developerProfile = await prisma.tenantSoftSkillProfile.create({
    data: {
      tenantId: tenant.id,
      profileName: 'Developer Profile',
      description: 'Profilo standard per sviluppatori software',
      roleIds: [],
      softSkillIds: softSkills.map(s => s.id),
      weights: {
        problem_solving: 1.5,
        critical_thinking: 1.3,
        teamwork: 1.2,
        communication_effective: 1.0,
        time_management: 1.1
      },
      isDefault: true
    }
  });

  // Profilo Tech Lead
  const techLeadProfile = await prisma.tenantSoftSkillProfile.create({
    data: {
      tenantId: tenant.id,
      profileName: 'Tech Lead Profile',
      description: 'Profilo per technical leader',
      roleIds: [],
      softSkillIds: softSkills.map(s => s.id),
      weights: {
        leadership: 1.5,
        communication_effective: 1.4,
        decision_making: 1.3,
        problem_solving: 1.2,
        emotional_intelligence: 1.1
      },
      isDefault: false
    }
  });

  console.log('✅ Created default profiles');
}

async function main() {
  try {
    console.log('🚀 Starting Soft Skills Seeding Process...\n');

    // 1. Seed delle soft skills base
    await seedSoftSkills();

    // 2. Import mapping ruoli-skills dal CSV
    await importRolesSkillsFromCSV();

    // 3. Crea profili di default
    await createDefaultProfiles();

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });