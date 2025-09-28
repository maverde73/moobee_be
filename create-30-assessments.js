const prisma = require('./src/config/database');

// Gruppi logici di ruoli (2-3 ruoli per gruppo che hanno senso insieme)
const roleGroups = [
  // Gruppo 1: Sviluppatori e Web
  { roles: ["44:Software Developer", "32:Web Developer", "40:Web and Digital Interface Designer"], type: "big_five", name: "Assessment Team Sviluppo Web" },
  
  // Gruppo 2: Data Science  
  { roles: ["42:Data Scientist", "37:Bioinformatics Scientist", "38:Biostatistician"], type: "disc", name: "Assessment Data Science Team" },
  
  // Gruppo 3: Sicurezza IT
  { roles: ["36:Information Security Analyst", "46:Information Security Engineer", "49:Digital Forensics Analyst"], type: "belbin", name: "Assessment Security Team" },
  
  // Gruppo 4: Network e Sistemi
  { roles: ["1:Network and Computer Systems Administrator", "13:Computer Network Architect", "24:Computer Network Support Specialist"], type: "big_five", name: "Assessment Network Infrastructure" },
  
  // Gruppo 5: Database
  { roles: ["10:Database Architect", "34:Database Administrator", "35:Data Warehousing Specialist"], type: "disc", name: "Assessment Database Team" },
  
  // Gruppo 6: Management IT
  { roles: ["9:Computer and Information Systems Manager", "14:Information Technology Project Manager", "21:Security Manager"], type: "belbin", name: "Assessment IT Management" },
  
  // Gruppo 7: Robotica
  { roles: ["5:Robotics Engineer", "45:Robotics Technician", "25:Mechatronics Engineer"], type: "big_five", name: "Assessment Robotics Division" },
  
  // Gruppo 8: Testing e QA
  { roles: ["31:Software Quality Assurance Analyst", "33:Quality Control Analyst", "41:Validation Engineer"], type: "disc", name: "Assessment Quality Assurance" },
  
  // Gruppo 9: Ricerca e Analisi
  { roles: ["12:Operations Research Analyst", "22:Business Intelligence Analyst", "23:Computer and Information Research Scientist"], type: "belbin", name: "Assessment Research & Analytics" },
  
  // Gruppo 10: Sistemi e Architettura
  { roles: ["15:Computer Systems Engineer", "19:Computer Systems Analyst", "28:Computer Hardware Engineer"], type: "big_five", name: "Assessment Systems Architecture" },
  
  // Gruppo 11: Programmazione
  { roles: ["39:Computer Programmer", "6:CNC Tool Programmer", "7:Blockchain Engineer"], type: "disc", name: "Assessment Programming Team" },
  
  // Gruppo 12: GIS e Remote Sensing
  { roles: ["3:GIS Technologist", "4:Remote Sensing Scientist", "2:RFID Device Specialist"], type: "belbin", name: "Assessment Geospatial Tech" },
  
  // Gruppo 13: Penetration e Security Testing
  { roles: ["8:Penetration Tester", "26:Security Management Specialist", "49:Digital Forensics Analyst"], type: "big_five", name: "Assessment Security Testing" },
  
  // Gruppo 14: Web Administration
  { roles: ["43:Web Administrator", "32:Web Developer", "22:Business Intelligence Analyst"], type: "disc", name: "Assessment Web Operations" },
  
  // Gruppo 15: Ingegneria Avanzata
  { roles: ["16:Photonics Engineer", "17:Nanosystems Engineer", "48:Microsystems Engineer"], type: "belbin", name: "Assessment Advanced Engineering" },
  
  // Gruppo 16: Statistiche
  { roles: ["29:Statistical Assistant", "30:Statistician", "38:Biostatistician"], type: "big_five", name: "Assessment Statistical Team" },
  
  // Gruppo 17: Biotech IT
  { roles: ["11:Bioinformatics Technician", "37:Bioinformatics Scientist", "18:Health Informatics Specialist"], type: "disc", name: "Assessment BioTech IT" },
  
  // Gruppo 18: Telecomunicazioni
  { roles: ["27:Telecommunications Engineering Specialist", "1:Network Administrator", "13:Computer Network Architect"], type: "belbin", name: "Assessment Telecom Team" },
  
  // Gruppo 19: Quality Management
  { roles: ["20:Quality Control Systems Manager", "33:Quality Control Analyst", "41:Validation Engineer"], type: "big_five", name: "Assessment Quality Management" },
  
  // Gruppo 20: Energy Tech
  { roles: ["47:Fuel Cell Engineer", "16:Photonics Engineer", "5:Robotics Engineer"], type: "disc", name: "Assessment Energy Technology" },
  
  // Gruppo 21: Gaming e Design
  { roles: ["50:Video Game Designer", "40:Web and Digital Interface Designer", "44:Software Developer"], type: "belbin", name: "Assessment Game Development" },
  
  // Gruppo 22: Infrastructure Security
  { roles: ["21:Security Manager", "36:Information Security Analyst", "8:Penetration Tester"], type: "big_five", name: "Assessment Infrastructure Security" },
  
  // Gruppo 23: Data Management
  { roles: ["35:Data Warehousing Specialist", "42:Data Scientist", "10:Database Architect"], type: "disc", name: "Assessment Data Management" },
  
  // Gruppo 24: Systems Integration
  { roles: ["19:Computer Systems Analyst", "15:Computer Systems Engineer", "14:IT Project Manager"], type: "belbin", name: "Assessment Systems Integration" },
  
  // Gruppo 25: Research Scientists
  { roles: ["4:Remote Sensing Scientist", "23:Computer and Information Research Scientist", "37:Bioinformatics Scientist"], type: "big_five", name: "Assessment Research Scientists" },
  
  // Gruppo 26: Technical Support
  { roles: ["24:Computer Network Support Specialist", "29:Statistical Assistant", "11:Bioinformatics Technician"], type: "disc", name: "Assessment Technical Support" },
  
  // Gruppo 27: Emerging Tech
  { roles: ["7:Blockchain Engineer", "17:Nanosystems Engineer", "48:Microsystems Engineer"], type: "belbin", name: "Assessment Emerging Technologies" },
  
  // Gruppo 28: Development Operations
  { roles: ["44:Software Developer", "31:Software Quality Assurance Analyst", "43:Web Administrator"], type: "big_five", name: "Assessment DevOps Team" },
  
  // Gruppo 29: Analytics Team
  { roles: ["22:Business Intelligence Analyst", "42:Data Scientist", "12:Operations Research Analyst"], type: "disc", name: "Assessment Analytics Division" },
  
  // Gruppo 30: Engineering Management
  { roles: ["14:IT Project Manager", "9:Computer and Information Systems Manager", "20:Quality Control Systems Manager"], type: "belbin", name: "Assessment Engineering Leadership" }
];

async function createAssessments() {
  try {
    console.log('🚀 Inizio creazione di 30 assessment...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < roleGroups.length; i++) {
      const group = roleGroups[i];
      
      try {
        // Prepara i dati per il template
        const templateData = {
          name: group.name,
          type: group.type,
          description: `Assessment professionale per ${group.name.replace('Assessment ', '')} - Valutazione competenze per team specializzato`,
          isActive: true,
          suggestedRoles: group.roles,
          targetSoftSkillIds: [],
          createdBy: 'System',
          scoringAlgorithm: 'weighted',
          softSkillsEnabled: true,
          aiProvider: 'openai',
          aiModel: 'gpt-5',
          aiTemperature: '0.7',
          aiMaxTokens: 16000,
          aiLanguage: 'it',
          suggestedFrequency: group.type === 'belbin' ? 'annual' : group.type === 'disc' ? 'semi_annual' : 'quarterly',
          aiPrompt: `Genera un assessment ${group.type.toUpperCase()} professionale per i seguenti ruoli: ${group.roles.map(r => r.split(':')[1]).join(', ')}.
          
L'assessment deve essere specifico per valutare le competenze necessarie in questi ruoli.
Utilizza un linguaggio professionale in italiano.
${group.type === 'big_five' ? 'Valuta i 5 tratti della personalità nel contesto lavorativo.' : ''}
${group.type === 'disc' ? 'Valuta i 4 profili comportamentali DISC: Dominanza, Influenza, Stabilità, Coscienziosità.' : ''}
${group.type === 'belbin' ? 'Identifica i ruoli di team secondo il modello Belbin.' : ''}

Genera domande pertinenti e professionali per questi specifici ruoli.`,
          instructions: `Questo assessment è progettato per valutare le competenze e l'adattabilità per i ruoli di ${group.roles.map(r => r.split(':')[1]).join(', ')}.`
        };
        
        // Crea l'assessment nel database
        const assessment = await prisma.assessmentTemplate.create({
          data: templateData
        });
        
        successCount++;
        console.log(`✅ [${i + 1}/30] Creato: ${group.name} (ID: ${assessment.id}, Tipo: ${group.type})`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ [${i + 1}/30] Errore creando ${group.name}:`, error.message);
      }
    }
    
    console.log('\n📊 Riepilogo:');
    console.log(`✅ Assessment creati con successo: ${successCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    console.log('\n🎯 Distribuzione per tipo:');
    console.log(`   - Big Five: 10 assessment`);
    console.log(`   - DISC: 10 assessment`);
    console.log(`   - Belbin: 10 assessment`);
    
  } catch (error) {
    console.error('Errore generale:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAssessments();
