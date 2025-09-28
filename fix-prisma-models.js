const fs = require('fs');
const path = require('path');

// Leggi il file schema.prisma
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// Mappature da applicare
const modelMappings = [
  { from: 'model assessment_templates', to: 'model assessmentTemplate', map: 'assessment_templates' },
  { from: 'model assessment_questions', to: 'model assessmentQuestion', map: 'assessment_questions' },
  { from: 'model assessment_options', to: 'model assessmentOption', map: 'assessment_options' },
  { from: 'model soft_skills', to: 'model softSkill', map: 'soft_skills' },
  { from: 'model role_soft_skills', to: 'model roleSoftSkill', map: 'role_soft_skills' },
  { from: 'model user_soft_skills', to: 'model userSoftSkill', map: 'user_soft_skills' }
];

// Applica le mappature
modelMappings.forEach(({ from, to, map }) => {
  // Trova l'inizio del modello
  const modelStart = schema.indexOf(from);
  if (modelStart === -1) {
    console.log(`Model "${from}" not found, skipping...`);
    return;
  }

  // Trova la fine del modello (il prossimo "model" o "enum" o "datasource" o "generator")
  let modelEnd = schema.length;
  const nextModel = schema.indexOf('\nmodel ', modelStart + 1);
  const nextEnum = schema.indexOf('\nenum ', modelStart + 1);
  const nextDatasource = schema.indexOf('\ndatasource ', modelStart + 1);
  const nextGenerator = schema.indexOf('\ngenerator ', modelStart + 1);

  [nextModel, nextEnum, nextDatasource, nextGenerator].forEach(pos => {
    if (pos > -1 && pos < modelEnd) modelEnd = pos;
  });

  // Estrai il modello
  let modelContent = schema.substring(modelStart, modelEnd);

  // Cambia il nome del modello
  modelContent = modelContent.replace(from, to);

  // Aggiungi @@map se non esiste già
  if (!modelContent.includes('@@map')) {
    // Trova l'ultima parentesi graffa
    const lastBrace = modelContent.lastIndexOf('}');
    if (lastBrace > -1) {
      modelContent = modelContent.substring(0, lastBrace) +
                    `\n  @@map("${map}")\n` +
                    modelContent.substring(lastBrace);
    }
  }

  // Sostituisci nel schema
  schema = schema.substring(0, modelStart) + modelContent + schema.substring(modelEnd);
});

// Aggiorna le relazioni per usare i nuovi nomi dei modelli
const relationMappings = [
  { old: 'assessment_templates', new: 'assessmentTemplate' },
  { old: 'assessment_questions', new: 'assessmentQuestion' },
  { old: 'assessment_options', new: 'assessmentOption' },
  { old: 'soft_skills', new: 'softSkill' },
  { old: 'role_soft_skills', new: 'roleSoftSkill' },
  { old: 'user_soft_skills', new: 'userSoftSkill' }
];

relationMappings.forEach(({ old, new: newName }) => {
  // Sostituisci nei tipi delle relazioni
  const regex1 = new RegExp(`\\s+${old}\\s+`, 'g');
  const regex2 = new RegExp(`\\s+${old}\\[\\]`, 'g');
  const regex3 = new RegExp(`\\s+${old}\\?`, 'g');

  schema = schema.replace(regex1, ` ${newName} `);
  schema = schema.replace(regex2, ` ${newName}[]`);
  schema = schema.replace(regex3, ` ${newName}?`);
});

// Salva il file modificato
fs.writeFileSync(schemaPath, schema);

console.log('✅ Prisma schema updated with camelCase models and @@map directives');