/**
 * Script per importare TUTTI i ruoli e soft skills dal CSV
 * Include i pesi (priorità) corretti per ogni mapping
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');

// Mapping dei nomi dei soft skills dal CSV agli ID reali nel database
const SOFTSKILL_MAPPING = {
  'Capacità decisionale': 'cmfo594bl000aahyw5znp2fou',  // Decision Making
  'Gestione dei conflitti': 'cmfo594cn000bahywhlt8lj4q',  // Resilienza (più vicino a conflict management)
  'Comunicazione efficace': 'cmfo594140000ahywibge3y3y',  // Effective Communication
  'Teamworking e collaborazione': 'cmfo5945s0004ahywzeprlg7d',  // Teamwork
  'Problem solving analitico': 'cmfo5948o0007ahywrjusdg0a',  // Problem Solving
  'Creatività e innovazione': 'cmfo5947q0006ahywbhaxl13t',  // Pensiero Critico (più vicino a creativity)
  'Adattabilità e flessibilità': 'cmfo5949l0008ahyw2wlx6o0k',  // Flessibilità e Adattabilità
  'Gestione del tempo e delle priorità': 'cmfo594aj0009ahywya4pq66d',  // Gestione del Tempo
  'Resilienza e gestione dello stress': 'cmfo594cn000bahywhlt8lj4q',  // Resilienza
  'Leadership e influenza': 'cmfo5946u0005ahywdl6lihc5',  // Leadership
  'Empatia e ascolto attivo': 'cmfo594400002ahywe3h3ep82',  // Empatia (+ Ascolto attivo)
  'Orientamento ai risultati': 'cmfo594bl000aahyw5znp2fou'  // Capacità Decisionale (orientamento)
};

// Pesi basati sulla posizione (1-7 soft skills per ruolo)
const PRIORITY_BY_POSITION = {
  1: 1,  // Priorità massima
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7   // Priorità minima
};

// Min score basato sulla priorità
const MIN_SCORE_BY_PRIORITY = {
  1: 85,  // Critico
  2: 80,  // Molto importante
  3: 75,  // Importante
  4: 70,  // Rilevante
  5: 65,  // Utile
  6: 60,  // Supportivo
  7: 55   // Complementare
};

async function importRoleSoftSkills() {
  try {
    console.log('🚀 Inizio importazione completa ruoli-softskills dal CSV...\n');

    // Leggi il file CSV
    const csvPath = path.join(__dirname, '../../docs/ruoli_softskills.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    console.log(`📄 File CSV letto: ${lines.length} righe totali\n`);

    // Salta l'header
    const dataLines = lines.slice(1);
    console.log(`📊 Ruoli da processare: ${dataLines.length}\n`);

    // Prima, ottieni tutti i soft skills dal database
    const softSkills = await prisma.softSkill.findMany();
    const softSkillMap = {};
    softSkills.forEach(skill => {
      softSkillMap[skill.id] = skill;
    });

    // Ottieni tutti i ruoli dal database usando raw query
    const roles = await prisma.$queryRaw`
      SELECT id, "Role" as name, "NameKnown_Role" as known_name
      FROM roles
    `;

    const roleMap = {};
    roles.forEach(role => {
      // Normalizza il nome del ruolo per il matching
      const normalizedName = role.name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
      roleMap[normalizedName] = role.id;

      // Aggiungi anche varianti del nome
      if (role.known_name) {
        const normalizedKnown = role.known_name
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s]/g, '')
          .trim();
        roleMap[normalizedKnown] = role.id;
      }
    });

    console.log(`📁 Trovati ${Object.keys(roleMap).length} ruoli nel database\n`);

    // Pulisci i mapping esistenti
    console.log('🧹 Pulizia mapping esistenti...');
    await prisma.roleSoftSkill.deleteMany({});
    console.log('✅ Mapping esistenti rimossi\n');

    let totalMappings = 0;
    let skippedRoles = [];
    let processedRoles = [];

    // Processa ogni riga del CSV
    for (const line of dataLines) {
      const columns = line.split(';').map(col => col.trim());
      const roleName = columns[0];

      if (!roleName) continue;

      // Normalizza il nome del ruolo per il matching
      const normalizedRoleName = roleName
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();

      // Cerca il ruolo nel database
      const roleId = roleMap[normalizedRoleName];

      if (!roleId) {
        console.log(`⚠️  Ruolo non trovato nel DB: "${roleName}"`);
        skippedRoles.push(roleName);
        continue;
      }

      console.log(`\n🔄 Processando ruolo: "${roleName}" (ID: ${roleId})`);

      // Processa ogni soft skill (colonne 2-8)
      let mappingsForRole = 0;
      for (let i = 1; i <= 7; i++) {
        const skillName = columns[i];
        if (!skillName || skillName.trim() === '') continue;

        const skillId = SOFTSKILL_MAPPING[skillName];
        if (!skillId) {
          console.log(`  ⚠️  Soft skill non mappato: "${skillName}"`);
          continue;
        }

        if (!softSkillMap[skillId]) {
          console.log(`  ⚠️  Soft skill non trovato nel DB: "${skillId}"`);
          continue;
        }

        // Crea il mapping con la priorità basata sulla posizione
        const priority = PRIORITY_BY_POSITION[i];
        const minScore = MIN_SCORE_BY_PRIORITY[priority];

        try {
          await prisma.roleSoftSkill.create({
            data: {
              roleId: roleId,
              softSkillId: skillId,
              priority: priority,
              minScore: minScore,
              weight: 1.0,  // Peso di default
              isRequired: priority <= 3,  // Richiesto se priorità alta (1-3)
              createdAt: new Date()
            }
          });

          mappingsForRole++;
          totalMappings++;
          console.log(`  ✅ Aggiunto: ${skillName} (${skillId}) - Priorità: ${priority}, Min Score: ${minScore}`);
        } catch (error) {
          console.log(`  ❌ Errore aggiunta: ${skillName} - ${error.message}`);
        }
      }

      console.log(`  📊 Mappings aggiunti per questo ruolo: ${mappingsForRole}`);
      processedRoles.push({ name: roleName, mappings: mappingsForRole });
    }

    // Report finale
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORT FINALE IMPORTAZIONE');
    console.log('='.repeat(60));
    console.log(`✅ Ruoli processati con successo: ${processedRoles.length}`);
    console.log(`⚠️  Ruoli non trovati nel database: ${skippedRoles.length}`);
    console.log(`📝 Totale mapping creati: ${totalMappings}`);
    console.log(`📊 Media mapping per ruolo: ${(totalMappings / processedRoles.length).toFixed(1)}`);

    if (skippedRoles.length > 0) {
      console.log('\n⚠️  Ruoli saltati (non trovati nel DB):');
      skippedRoles.forEach(role => console.log(`  - ${role}`));
    }

    // Verifica finale
    const finalCount = await prisma.roleSoftSkill.count();
    const uniqueRoles = await prisma.roleSoftSkill.findMany({
      distinct: ['roleId'],
      select: { roleId: true }
    });

    console.log('\n📈 Verifica finale database:');
    console.log(`  - Totale mapping nel DB: ${finalCount}`);
    console.log(`  - Ruoli unici con soft skills: ${uniqueRoles.length}`);

    // Mostra distribuzione priorità
    const priorityDistribution = await prisma.$queryRaw`
      SELECT priority, COUNT(*) as count
      FROM role_soft_skills
      GROUP BY priority
      ORDER BY priority
    `;

    console.log('\n📊 Distribuzione priorità:');
    priorityDistribution.forEach(p => {
      console.log(`  - Priorità ${p.priority}: ${p.count} mappings`);
    });

  } catch (error) {
    console.error('\n❌ Errore durante l\'importazione:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui l'importazione
importRoleSoftSkills()
  .then(() => {
    console.log('\n✅ Importazione completata con successo!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });