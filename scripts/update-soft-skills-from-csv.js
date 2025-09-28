const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Funzione per parsare il CSV
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  const records = [];

  // Salta l'header e l'ultima riga vuota
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line === '14→') continue;

    // Parse con split per punto e virgola
    const fields = line.split(';');
    if (fields.length >= 9) {
      records.push({
        id: parseInt(fields[0]),
        nomeIT: fields[1],
        nomeEN: fields[2],
        descrizioneIT: fields[3],
        categoria: fields[4],
        attivo: fields[5] === 'VERO',
        codice: fields[6],
        descrizioneEN: fields[7],
        mapping: fields[8]
      });
    }
  }

  return records;
}

// Funzione per parsare il mapping JSON-like
function parseMapping(mappingStr) {
  try {
    // Sostituisci ' con " per avere JSON valido
    const jsonStr = mappingStr.replace(/'/g, '"');
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('Impossibile parsare mapping:', mappingStr);
    return {};
  }
}

async function updateSoftSkills() {
  try {
    console.log('\n🔄 AGGIORNAMENTO SOFT SKILLS DAL CSV\n');
    console.log('='.repeat(60));

    // 1. Leggi il file CSV
    const csvPath = path.join(__dirname, '..', '..', 'docs', 'softskill_12_mappatura.csv');
    console.log(`\n📄 Lettura file CSV da: ${csvPath}`);

    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(csvData);
    console.log(`✅ Trovate ${records.length} soft skills nel CSV\n`);

    // 2. Verifica soft skills esistenti
    const existingSkills = await prisma.soft_skills.findMany();
    console.log(`📊 Soft skills esistenti nel database: ${existingSkills.length}`);

    // 3. Aggiorna ogni soft skill
    console.log('\n💾 Aggiornamento soft skills...\n');

    let updated = 0;
    let created = 0;
    let errors = 0;

    for (const record of records) {
      try {
        // Trova la skill esistente per codice
        const existing = existingSkills.find(s => s.code === record.codice);

        // Prepara i dati di aggiornamento
        const evaluationCriteria = parseMapping(record.mapping);

        const data = {
          code: record.codice,
          name: record.nomeIT,
          nameEn: record.nomeEN,
          description: record.descrizioneIT,
          descriptionEn: record.descrizioneEN,
          category: record.categoria,
          isActive: record.attivo,
          evaluationCriteria: evaluationCriteria,
          orderIndex: record.id
        };

        if (existing) {
          // Aggiorna skill esistente
          await prisma.soft_skills.update({
            where: { id: existing.id },
            data: data
          });
          console.log(`✅ Aggiornata: ${record.nomeIT} (${record.codice})`);
          updated++;
        } else {
          // Crea nuova skill
          await prisma.soft_skills.create({
            data: data
          });
          console.log(`➕ Creata: ${record.nomeIT} (${record.codice})`);
          created++;
        }

      } catch (error) {
        console.error(`❌ Errore con ${record.nomeIT}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RIEPILOGO:');
    console.log(`   ✅ Soft skills aggiornate: ${updated}`);
    console.log(`   ➕ Soft skills create: ${created}`);
    if (errors > 0) {
      console.log(`   ❌ Errori: ${errors}`);
    }

    // 4. Verifica finale
    const finalCount = await prisma.soft_skills.count();
    console.log(`\n📈 Totale soft skills nel database: ${finalCount}`);

    // 5. Mostra alcune skills aggiornate
    const samples = await prisma.soft_skills.findMany({
      take: 3,
      orderBy: { orderIndex: 'asc' }
    });

    console.log('\n📋 Esempi di soft skills aggiornate:');
    samples.forEach(skill => {
      console.log(`\n   ${skill.name} (${skill.code})`);
      console.log(`   Categoria: ${skill.category}`);
      console.log(`   Mapping DiSC: ${skill.evaluationCriteria?.disc ? Object.keys(skill.evaluationCriteria.disc).join(', ') : 'N/A'}`);
      console.log(`   Mapping Belbin: ${skill.evaluationCriteria?.belbin ? Object.keys(skill.evaluationCriteria.belbin).join(', ') : 'N/A'}`);
      console.log(`   Mapping Big Five: ${skill.evaluationCriteria?.bigFive ? Object.keys(skill.evaluationCriteria.bigFive).join(', ') : 'N/A'}`);
    });

    console.log('\n✅ AGGIORNAMENTO COMPLETATO!\n');

  } catch (error) {
    console.error('\n❌ ERRORE DURANTE L\'AGGIORNAMENTO:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui l'aggiornamento
updateSoftSkills().catch((error) => {
  console.error('Errore fatale:', error);
  process.exit(1);
});