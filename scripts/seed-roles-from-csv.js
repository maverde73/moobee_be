const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Funzione per parsare CSV
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

async function seedRoles() {
  try {
    console.log('\n🌱 SEEDING ROLES FROM CSV\n');
    console.log('='.repeat(60));

    // 1. Leggi il file CSV
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

    // 2. Estrai ruoli unici dal CSV
    const roleNamesFromCSV = records.map(row => row[0]).filter(Boolean);
    const uniqueRoles = [...new Set(roleNamesFromCSV)];
    console.log(`📊 Ruoli unici da inserire: ${uniqueRoles.length}`);

    // 3. Verifica ruoli esistenti
    const existingRoles = await prisma.roles.findMany();
    const existingRoleNames = existingRoles.map(r => r.name);
    console.log(`   Ruoli già esistenti nel database: ${existingRoles.length}`);

    // 4. Determina quali ruoli inserire
    const rolesToInsert = uniqueRoles.filter(roleName =>
      !existingRoleNames.includes(roleName) &&
      !existingRoleNames.includes(roleName.replace(/ /g, '_')) &&
      !existingRoleNames.includes(roleName.replace(/ /g, '-'))
    );

    console.log(`   Nuovi ruoli da inserire: ${rolesToInsert.length}`);

    if (rolesToInsert.length === 0) {
      console.log('\n✅ Tutti i ruoli sono già presenti nel database!');
    } else {
      console.log('\n📝 Inserimento nuovi ruoli...\n');

      let inserted = 0;
      let errors = 0;

      for (const roleName of rolesToInsert) {
        try {
          // Crea una descrizione basata sul nome del ruolo
          const description = generateRoleDescription(roleName);

          const newRole = await prisma.roles.create({
            data: {
              name: roleName,
              description: description,
              level: determineRoleLevel(roleName),
              department: 'IT', // Tutti i ruoli nel CSV sono IT
              isActive: true
            }
          });

          console.log(`✅ Inserito: ${newRole.name} (ID: ${newRole.id})`);
          inserted++;
        } catch (error) {
          console.error(`❌ Errore inserendo ${roleName}:`, error.message);
          errors++;
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log(`\n📊 RIEPILOGO:`);
      console.log(`   ✅ Ruoli inseriti con successo: ${inserted}`);
      if (errors > 0) {
        console.log(`   ❌ Errori durante l'inserimento: ${errors}`);
      }
    }

    // 5. Verifica finale
    const finalCount = await prisma.roles.count();
    console.log(`\n📈 Totale ruoli nel database: ${finalCount}`);

    // Mostra alcuni esempi
    const exampleRoles = await prisma.roles.findMany({
      take: 10,
      orderBy: { name: 'asc' }
    });

    console.log('\n📋 Primi 10 ruoli nel database:');
    exampleRoles.forEach(role => {
      console.log(`   - ${role.name} (ID: ${role.id}, Level: ${role.level || 'N/A'})`);
    });

    console.log('\n✅ SEED RUOLI COMPLETATO!\n');

  } catch (error) {
    console.error('\n❌ ERRORE DURANTE IL SEED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Funzione per generare descrizione del ruolo
function generateRoleDescription(roleName) {
  const descriptions = {
    'Software Developer': 'Sviluppa e mantiene applicazioni software secondo le specifiche',
    'Data Scientist': 'Analizza dati complessi per estrarre insights e supportare decisioni aziendali',
    'DevOps Engineer': 'Gestisce infrastrutture e pipeline CI/CD per deployment continuo',
    'Cloud Architect': 'Progetta e implementa architetture cloud scalabili e sicure',
    'Business Analyst': 'Analizza processi aziendali e definisce requisiti per soluzioni IT',
    'Product Manager': 'Gestisce il ciclo di vita del prodotto e coordina team cross-funzionali',
    'UI/UX Designer': 'Progetta interfacce utente intuitive e user experience ottimali',
    'System Administrator': 'Gestisce e mantiene sistemi IT e infrastrutture aziendali',
    'Database Administrator': 'Amministra database garantendo performance e sicurezza dei dati',
    'Network Engineer': 'Progetta e gestisce infrastrutture di rete aziendali',
    'Security Analyst': 'Monitora e protegge sistemi da minacce di sicurezza informatica',
    'Quality Assurance Engineer': 'Garantisce la qualità del software attraverso test sistematici',
    'Technical Writer': 'Crea documentazione tecnica chiara e completa',
    'Project Manager': 'Gestisce progetti IT garantendo tempi, budget e qualità',
    'Machine Learning Engineer': 'Sviluppa e implementa modelli di machine learning',
    'Data Engineer': 'Costruisce e mantiene pipeline di dati e data warehouse',
    'Mobile Developer': 'Sviluppa applicazioni native e cross-platform per dispositivi mobili',
    'Full Stack Developer': 'Sviluppa applicazioni complete frontend e backend',
    'AI Research Scientist': 'Conduce ricerca avanzata in intelligenza artificiale',
    'Blockchain Developer': 'Sviluppa applicazioni e smart contracts su blockchain',
    'Site Reliability Engineer': 'Garantisce affidabilità e performance dei servizi',
    'IoT Developer': 'Sviluppa soluzioni per dispositivi Internet of Things',
    'Game Developer': 'Progetta e sviluppa videogiochi e meccaniche di gioco',
    'Scrum Master': 'Facilita processi agili e rimuove impedimenti per il team',
    'Technical Lead': 'Guida tecnicamente il team e prende decisioni architetturali',
    'Solutions Architect': 'Progetta soluzioni IT complete per requisiti di business',
    'Data Analyst': 'Analizza dati per fornire insights e report aziendali',
    'IT Support Specialist': 'Fornisce supporto tecnico e risolve problemi IT',
    'Web Developer': 'Sviluppa applicazioni e siti web responsive',
    'Cybersecurity Engineer': 'Implementa misure di sicurezza e protegge infrastrutture',
    'Cloud Engineer': 'Implementa e gestisce soluzioni cloud',
    'API Developer': 'Progetta e sviluppa API RESTful e GraphQL',
    'ETL Developer': 'Sviluppa processi di estrazione, trasformazione e caricamento dati',
    'Embedded Systems Engineer': 'Sviluppa software per sistemi embedded',
    'IT Consultant': 'Fornisce consulenza strategica su soluzioni IT',
    'Release Manager': 'Gestisce il processo di rilascio del software',
    'Platform Engineer': 'Costruisce e mantiene piattaforme di sviluppo',
    'Computer Vision Engineer': 'Sviluppa sistemi di visione artificiale',
    'NLP Engineer': 'Sviluppa soluzioni di elaborazione del linguaggio naturale',
    'Infrastructure Engineer': 'Progetta e gestisce infrastrutture IT',
    'Automation Engineer': 'Automatizza processi e workflow aziendali',
    'BI Developer': 'Sviluppa soluzioni di Business Intelligence',
    'Robotics Engineer': 'Progetta e programma sistemi robotici',
    'AR/VR Developer': 'Sviluppa esperienze in realtà aumentata e virtuale',
    'IT Auditor': 'Verifica conformità e sicurezza dei sistemi IT',
    'Penetration Tester': 'Esegue test di sicurezza per identificare vulnerabilità',
    'Systems Analyst': 'Analizza e ottimizza sistemi informativi aziendali',
    'IT Trainer': 'Forma personale su tecnologie e processi IT',
    'Chief Technology Officer': 'Definisce strategia tecnologica e innovazione aziendale',
    'IT Operations Manager': 'Gestisce operazioni IT quotidiane e team tecnici'
  };

  return descriptions[roleName] || `Professionista IT specializzato in ${roleName}`;
}

// Funzione per determinare il livello del ruolo
function determineRoleLevel(roleName) {
  if (roleName.includes('Chief') || roleName.includes('CTO')) return 'executive';
  if (roleName.includes('Manager') || roleName.includes('Lead') || roleName.includes('Architect')) return 'senior';
  if (roleName.includes('Senior') || roleName.includes('Principal')) return 'senior';
  if (roleName.includes('Junior') || roleName.includes('Trainee')) return 'junior';
  if (roleName.includes('Engineer') || roleName.includes('Developer') || roleName.includes('Analyst')) return 'mid';
  return 'mid'; // default
}

// Esegui il seed
seedRoles().catch((error) => {
  console.error('Errore fatale:', error);
  process.exit(1);
});