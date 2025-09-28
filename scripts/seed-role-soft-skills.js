const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Mapping soft skills italiano dal CSV -> name nel database
// IMPORTANTE: Mapping esatto ai nuovi nomi nel database
const softSkillsNameMapping = {
  // Mapping dal CSV ai nomi esatti nel DB (dalle 12 soft skills importate)
  'Capacità decisionale': 'Capacità Decisionale',
  'Comunicazione efficace': 'Comunicazione Efficace',
  'Teamworking e collaborazione': 'Teamworking e Collaborazione',
  'Problem solving analitico': 'Problem Solving Analitico',
  'Creatività e innovazione': 'Creatività e Innovazione',
  'Adattabilità e flessibilità': 'Adattabilità e Flessibilità',
  'Gestione del tempo e delle priorità': 'Gestione del Tempo e delle Priorità',
  'Resilienza e gestione dello stress': 'Resilienza e Gestione dello Stress',
  'Leadership e influenza': 'Leadership e Influenza',
  'Empatia e ascolto attivo': 'Empatia e Ascolto Attivo',
  'Orientamento ai risultati': 'Orientamento ai Risultati',
  'Gestione dei conflitti': 'Gestione dei Conflitti'
};

// Funzione per ottenere attributi basati sulla priorità
function getPriorityAttributes(priority) {
  const mapping = {
    1: { weight: 1.5, isRequired: true, minScore: 70, targetScore: 85 },
    2: { weight: 1.3, isRequired: true, minScore: 65, targetScore: 80 },
    3: { weight: 1.2, isRequired: true, minScore: 60, targetScore: 75 },
    4: { weight: 1.0, isRequired: false, minScore: 55, targetScore: 70 },
    5: { weight: 0.9, isRequired: false, minScore: 50, targetScore: 65 },
    6: { weight: 0.8, isRequired: false, minScore: 45, targetScore: 60 },
    7: { weight: 0.7, isRequired: false, minScore: 40, targetScore: 55 }
  };
  return mapping[priority];
}

// Funzione per generare descrizione specifica per ruolo
function generateRoleSpecificDescription(roleName, skillName, priority) {
  const priorityDescriptions = {
    1: `Competenza critica per ${roleName}: ${skillName} è fondamentale per eccellere in questo ruolo`,
    2: `Molto importante per il successo come ${roleName}: ${skillName} è altamente rilevante`,
    3: `Importante per le responsabilità di ${roleName}: ${skillName} contribuisce significativamente`,
    4: `Rilevante per il ruolo di ${roleName}: ${skillName} è standard per questa posizione`,
    5: `Utile complemento per ${roleName}: ${skillName} aggiunge valore`,
    6: `Valore aggiunto per ${roleName}: ${skillName} è complementare`,
    7: `Competenza secondaria per ${roleName}: ${skillName} è nice to have`
  };

  return priorityDescriptions[priority];
}

// Funzione per parsare CSV manualmente (senza librerie esterne)
function parseCSV(csvContent, delimiter = ';') {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  const records = [];

  for (const line of lines) {
    // Skip header line if exists
    if (line.startsWith('Ruolo')) continue;

    const fields = line.split(delimiter).map(field => field.trim());
    if (fields.length >= 8) { // Ruolo + 7 soft skills
      records.push(fields);
    }
  }

  return records;
}

async function seedRoleSoftSkills() {
  try {
    console.log('\n🌱 SEEDING ROLE-SOFT SKILLS RELATIONSHIPS\n');
    console.log('='.repeat(60));

    // 1. Verifica se esistono già dati
    const existingCount = await prisma.role_soft_skills.count();
    if (existingCount > 0) {
      console.log(`⚠️  Trovati ${existingCount} record esistenti in role_soft_skills.`);
      console.log('Vuoi eliminare i dati esistenti? Questa operazione non può essere annullata.');
      console.log('Per procedere, esegui: node scripts/seed-role-soft-skills.js --force');

      if (!process.argv.includes('--force')) {
        process.exit(0);
      }

      console.log('\n🗑️  Eliminazione record esistenti...');
      await prisma.role_soft_skills.deleteMany();
      console.log('✅ Record esistenti eliminati.');
    }

    // 2. Leggi il file CSV
    const csvPath = path.join(__dirname, '..', '..', 'docs', 'ruoli_softskills.csv');
    console.log(`\n📄 Lettura file CSV da: ${csvPath}`);

    let csvData;
    try {
      csvData = fs.readFileSync(csvPath, 'utf-8');
    } catch (error) {
      console.error('❌ Errore nella lettura del file CSV:', error.message);
      console.log('Assicurati che il file esista in: docs/ruoli_softskills.csv');
      process.exit(1);
    }

    const records = parseCSV(csvData);
    console.log(`✅ Trovati ${records.length} ruoli nel CSV\n`);

    // 3. Carica mapping ruoli e soft skills dal database
    console.log('📊 Caricamento dati dal database...');
    const roles = await prisma.roles.findMany();
    const softSkills = await prisma.soft_skills.findMany();

    console.log(`   - Ruoli nel database: ${roles.length}`);
    console.log(`   - Soft skills nel database: ${softSkills.length}`);

    // 4. Crea mapping dictionaries con confronto case-insensitive
    const roleMap = {};
    roles.forEach(r => {
      // Usa il campo Role se name è null
      const roleName = r.name || r.Role || r.NameKnown_Role;
      if (roleName) {
        // Aggiungi tutte le varianti: originale, lowercase, e con spazi/underscore
        roleMap[roleName] = r.id;
        roleMap[roleName.toLowerCase()] = r.id;
        roleMap[roleName.toUpperCase()] = r.id;

        // Gestisci anche variazioni di nome
        const withSpaces = roleName.replace(/[-_]/g, ' ');
        roleMap[withSpaces] = r.id;
        roleMap[withSpaces.toLowerCase()] = r.id;

        // Versione con underscore
        const withUnderscore = roleName.replace(/[\s-]/g, '_');
        roleMap[withUnderscore] = r.id;
        roleMap[withUnderscore.toLowerCase()] = r.id;
      }
    });

    const skillMap = {};
    const skillNameToId = {};
    softSkills.forEach(s => {
      skillMap[s.code] = s.id;
      // Mappiamo anche per nome per il matching con CSV
      skillNameToId[s.name] = s.id;
    });

    // 5. Processa ogni riga del CSV
    console.log('\n📝 Elaborazione mappature ruolo-soft skill...\n');
    const roleSoftSkillsData = [];
    const warnings = [];
    let processedRoles = 0;

    for (const row of records) {
      const roleName = row[0];
      let roleId = roleMap[roleName];

      // Prova varianti del nome se non trovato
      if (!roleId) {
        // Prova lowercase
        roleId = roleMap[roleName.toLowerCase()];

        // Prova con underscore invece di spazi
        if (!roleId) {
          const roleNameUnderscore = roleName.replace(/ /g, '_');
          roleId = roleMap[roleNameUnderscore] || roleMap[roleNameUnderscore.toLowerCase()];
        }

        // Prova con dash invece di spazi
        if (!roleId) {
          const roleNameDash = roleName.replace(/ /g, '-');
          roleId = roleMap[roleNameDash] || roleMap[roleNameDash.toLowerCase()];
        }

        // Prova rimuovendo 's' finale per singolare/plurale
        if (!roleId) {
          const singular = roleName.replace(/s$/, '');
          roleId = roleMap[singular] || roleMap[singular.toLowerCase()];
        }
      }

      if (!roleId) {
        warnings.push(`Ruolo non trovato nel database: "${roleName}"`);
        continue;
      }

      processedRoles++;

      // Processa le 7 soft skills
      for (let i = 1; i <= 7; i++) {
        const skillNameCsv = row[i];
        if (!skillNameCsv || skillNameCsv.trim() === '') continue;

        // Mappa il nome del CSV al nome nel database
        const skillNameDb = softSkillsNameMapping[skillNameCsv];
        if (!skillNameDb) {
          warnings.push(`Mapping soft skill non trovato per: "${skillNameCsv}" (ruolo: ${roleName})`);
          continue;
        }

        // Trova l'ID usando il nome nel database
        const skillId = skillNameToId[skillNameDb];
        if (!skillId) {
          warnings.push(`Soft skill non trovata nel database: "${skillNameDb}" (da CSV: "${skillNameCsv}")`);
          continue;
        }

        const attrs = getPriorityAttributes(i);

        roleSoftSkillsData.push({
          roleId: roleId,
          softSkillId: skillId,
          priority: i,
          weight: attrs.weight,
          isRequired: attrs.isRequired,
          minScore: attrs.minScore,
          targetScore: attrs.targetScore,
          description: generateRoleSpecificDescription(roleName, skillNameDb, i)
        });
      }
    }

    console.log(`✅ Elaborati ${processedRoles} ruoli su ${records.length}`);
    console.log(`📊 Creati ${roleSoftSkillsData.length} record da inserire\n`);

    // 6. Mostra warnings se presenti
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      const uniqueWarnings = [...new Set(warnings)];
      uniqueWarnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }

    // 7. Inserisci nel database con progress tracking
    if (roleSoftSkillsData.length > 0) {
      console.log('💾 Inserimento dati nel database...\n');

      // Usa createMany per performance migliore
      // NOTA: Rimuoviamo skipDuplicates per permettere la stessa skill con priorità diverse
      try {
        const result = await prisma.role_soft_skills.createMany({
          data: roleSoftSkillsData
          // skipDuplicates rimosso intenzionalmente
        });

        console.log(`✅ Inseriti ${result.count} record in role_soft_skills`);
      } catch (error) {
        console.error('❌ Errore durante l\'inserimento batch:', error.message);

        // Fallback: inserimento singolo con progress
        console.log('Tentativo di inserimento record singoli...');
        let inserted = 0;
        let skipped = 0;

        for (const data of roleSoftSkillsData) {
          try {
            await prisma.role_soft_skills.create({ data });
            inserted++;
            if (inserted % 50 === 0) {
              console.log(`   Progresso: ${inserted}/${roleSoftSkillsData.length}`);
            }
          } catch (err) {
            if (err.code === 'P2002') { // Unique constraint violation
              skipped++;
            } else {
              console.error(`   Errore inserendo record: ${err.message}`);
            }
          }
        }

        console.log(`\n✅ Inseriti ${inserted} record`);
        if (skipped > 0) {
          console.log(`⏭️  Saltati ${skipped} duplicati`);
        }
      }
    }

    // 8. Verifica finale e statistiche
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 STATISTICHE FINALI:\n');

    const finalCount = await prisma.role_soft_skills.count();
    console.log(`   📈 Totale record in role_soft_skills: ${finalCount}`);

    // Statistiche per priorità
    const priorityStats = await prisma.role_soft_skills.groupBy({
      by: ['priority'],
      _count: true,
      orderBy: { priority: 'asc' }
    });

    console.log('\n   📊 Distribuzione per priorità:');
    priorityStats.forEach(stat => {
      const level = {
        1: 'Critico',
        2: 'Molto Importante',
        3: 'Importante',
        4: 'Rilevante',
        5: 'Utile',
        6: 'Complementare',
        7: 'Secondario'
      }[stat.priority];
      console.log(`      Priorità ${stat.priority} (${level}): ${stat._count} record`);
    });

    // Top soft skills critiche
    const criticalSkills = await prisma.$queryRaw`
      SELECT s.name, COUNT(rs.id) as count
      FROM soft_skills s
      JOIN role_soft_skills rs ON s.id = rs."softSkillId"
      WHERE rs.priority = 1
      GROUP BY s.id, s.name
      ORDER BY count DESC
      LIMIT 5
    `;

    console.log('\n   🎯 Top 5 Soft Skills Critiche:');
    criticalSkills.forEach((skill, index) => {
      console.log(`      ${index + 1}. ${skill.name}: ${skill.count} ruoli`);
    });

    // Verifica ruoli con skills complete
    const rolesWithSkills = await prisma.$queryRaw`
      SELECT r.name, COUNT(rs.id) as skill_count
      FROM roles r
      LEFT JOIN role_soft_skills rs ON r.id = rs."roleId"
      GROUP BY r.id, r.name
      HAVING COUNT(rs.id) > 0
      ORDER BY skill_count DESC
      LIMIT 5
    `;

    console.log('\n   👥 Top 5 Ruoli con più Soft Skills:');
    rolesWithSkills.forEach((role, index) => {
      console.log(`      ${index + 1}. ${role.name}: ${role.skill_count} skills`);
    });

    console.log('\n✅ SEED COMPLETATO CON SUCCESSO!\n');

  } catch (error) {
    console.error('\n❌ ERRORE DURANTE IL SEED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui il seed
seedRoleSoftSkills().catch((error) => {
  console.error('Errore fatale:', error);
  process.exit(1);
});