const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const prisma = new PrismaClient();

// Mapping delle soft skills dal CSV ai nostri codici
// NOTA: Il CSV ha problemi di encoding con caratteri accentati (�)
const CSV_SKILL_MAPPING = {
  'Comunicazione efficace': 'communication_effective',
  'Ascolto attivo': 'active_listening',
  'Empatia e ascolto attivo': 'empathy',
  'Intelligenza emotiva': 'emotional_intelligence',
  'Teamworking e collaborazione': 'teamwork',
  'Leadership e influenza': 'leadership',
  'Pensiero critico': 'critical_thinking',
  'Problem solving analitico': 'problem_solving',
  'Creatività e innovazione': 'problem_solving',
  'Creativit� e innovazione': 'problem_solving',  // Con encoding issue
  'Adattabilità e flessibilità': 'flexibility',
  'Adattabilit� e flessibilit�': 'flexibility',  // Con encoding issue
  'Gestione del tempo e delle priorità': 'time_management',
  'Gestione del tempo e delle priorit�': 'time_management',  // Con encoding issue
  'Capacità decisionale': 'decision_making',
  'Capacit� decisionale': 'decision_making',  // Con encoding issue
  'Resilienza e gestione dello stress': 'resilience',
  'Gestione dei conflitti': 'emotional_intelligence',
  'Orientamento ai risultati': 'decision_making'
};

async function importRolesFromCSV() {
  console.log('📂 IMPORTAZIONE CSV RUOLI-SKILLS\n');
  console.log('================================\n');

  try {
    // 1. Leggi il file CSV
    const csvPath = path.join(__dirname, '../../docs/ruoli_softskills.csv');
    console.log('📄 Lettura file:', csvPath);
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    // 2. Parse del CSV
    const records = csv.parse(fileContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      encoding: 'utf-8'
    });
    console.log(`✅ CSV letto: ${records.length} righe trovate\n`);

    // 3. Ottieni tutte le soft skills dal database
    const softSkills = await prisma.softSkill.findMany();
    const skillsByCode = {};
    softSkills.forEach(skill => {
      skillsByCode[skill.code] = skill.id;
    });
    console.log(`✅ Soft skills caricate: ${softSkills.length}\n`);

    // 4. Ottieni tutti i ruoli dal database usando raw query
    const roles = await prisma.$queryRaw`
      SELECT id, "Role"
      FROM roles
      WHERE id IS NOT NULL
    `;

    // Crea mappa dei ruoli per nome
    const rolesByName = {};
    roles.forEach(role => {
      if (role.Role) {
        // Normalizza il nome del ruolo
        const normalizedName = role.Role
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ');
        rolesByName[normalizedName] = role.id;
      }
    });
    console.log(`✅ Ruoli caricati dal DB: ${roles.length}\n`);

    // 5. Prepara mapping per batch insert
    const mappingsToInsert = [];
    let mappedRoles = 0;
    let skippedRoles = 0;
    let totalMappings = 0;

    console.log('🔄 Elaborazione mappings...\n');

    for (const record of records) {
      const csvRoleName = record['Ruolo'];
      if (!csvRoleName) continue;

      // Normalizza nome ruolo dal CSV
      const normalizedCsvRole = csvRoleName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

      // Cerca corrispondenza esatta
      let roleId = rolesByName[normalizedCsvRole];

      // Se non trova match esatto, prova match parziali
      if (!roleId) {
        // Rimuovi 's' finale per singolare/plurale
        const singular = normalizedCsvRole.replace(/s$/, '');
        roleId = rolesByName[singular] || rolesByName[singular + 's'];
      }

      if (!roleId) {
        // Cerca match parziale
        const foundKey = Object.keys(rolesByName).find(key =>
          key.includes(normalizedCsvRole) ||
          normalizedCsvRole.includes(key) ||
          key.replace(/s$/, '') === normalizedCsvRole.replace(/s$/, '')
        );
        if (foundKey) {
          roleId = rolesByName[foundKey];
        }
      }

      if (!roleId) {
        console.log(`⚠️  Ruolo non trovato: "${csvRoleName}"`);
        skippedRoles++;
        continue;
      }

      mappedRoles++;

      // Processa le 7 soft skills per questo ruolo
      for (let i = 1; i <= 7; i++) {
        const skillName = record[`Soft Skill ${i}`];
        if (!skillName || !skillName.trim()) continue;

        const skillCode = CSV_SKILL_MAPPING[skillName.trim()];
        if (!skillCode) {
          console.log(`   ⚠️ Skill non mappata: "${skillName}"`);
          continue;
        }

        const skillId = skillsByCode[skillCode];
        if (!skillId) continue;

        mappingsToInsert.push({
          roleId: roleId,
          softSkillId: skillId,
          priority: i,
          weight: i <= 3 ? 1.5 : 1.0, // Peso maggiore per prime 3
          isRequired: i <= 3
        });
        totalMappings++;
      }
    }

    console.log('\n📊 Riepilogo parsing:');
    console.log(`   ✅ Ruoli mappati: ${mappedRoles}/${records.length}`);
    console.log(`   ⚠️ Ruoli saltati: ${skippedRoles}`);
    console.log(`   📌 Mappings da creare: ${totalMappings}\n`);

    // 6. Inserimento batch nel database
    if (mappingsToInsert.length > 0) {
      console.log('💾 Inserimento nel database...');

      // Prima elimina eventuali mapping esistenti
      await prisma.roleSoftSkill.deleteMany({});
      console.log('   ✅ Pulizia tabella completata');

      // Inserisci in batch
      const batchSize = 100;
      let inserted = 0;

      for (let i = 0; i < mappingsToInsert.length; i += batchSize) {
        const batch = mappingsToInsert.slice(i, i + batchSize);
        await prisma.roleSoftSkill.createMany({
          data: batch,
          skipDuplicates: true
        });
        inserted += batch.length;
        process.stdout.write(`\r   ⏳ Inseriti: ${inserted}/${mappingsToInsert.length}`);
      }

      console.log(`\n   ✅ Inserimento completato: ${inserted} mappings\n`);
    }

    // 7. Verifica finale
    const finalCount = await prisma.roleSoftSkill.count();
    const roleWithSkills = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "roleId") as count
      FROM role_soft_skills
    `;

    console.log('✅ IMPORTAZIONE COMPLETATA');
    console.log('==========================');
    console.log(`📊 Totale mappings nel DB: ${finalCount}`);
    console.log(`👥 Ruoli con skills: ${roleWithSkills[0].count}`);

    // Mostra esempio
    if (finalCount > 0) {
      const example = await prisma.$queryRaw`
        SELECT r."Role", s.name as skill_name, rs.priority
        FROM role_soft_skills rs
        JOIN roles r ON r.id = rs."roleId"
        JOIN soft_skills s ON s.id = rs."softSkillId"
        WHERE r."Role" IS NOT NULL
        ORDER BY r."Role", rs.priority
        LIMIT 7
      `;

      console.log('\n📋 Esempio mapping (primo ruolo):');
      example.forEach(e => {
        console.log(`   ${e.priority}. ${e.Role} → ${e.skill_name}`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERRORE IMPORT:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui import
importRolesFromCSV()
  .then(() => {
    console.log('\n✨ Import completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import fallito:', error);
    process.exit(1);
  });