// Script per correggere solo i modelli essenziali in Prisma schema

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// Aggiungi mapping per assessment_templates -> assessmentTemplate
schema = schema.replace('model assessment_templates {', 'model assessmentTemplate {');
schema = schema.replace(
  'assessment_generation_logs_TemplateGenerationLog                                            assessment_generation_logs[]   @relation("TemplateGenerationLog")\n}',
  'assessment_generation_logs_TemplateGenerationLog                                            assessment_generation_logs[]   @relation("TemplateGenerationLog")\n\n  @@map("assessment_templates")\n}'
);

// Aggiungi mapping per assessment_questions -> assessmentQuestion
schema = schema.replace('model assessment_questions {', 'model assessmentQuestion {');
schema = schema.replace(
  '  question_soft_skill_mappings question_soft_skill_mappings[]\n}',
  '  question_soft_skill_mappings question_soft_skill_mappings[]\n\n  @@map("assessment_questions")\n}'
);

// Aggiungi mapping per assessment_options -> assessmentOption
schema = schema.replace('model assessment_options {', 'model assessmentOption {');
// Aggiungiamo @@map alla fine del modello assessment_options
const optionsRegex = /(model assessmentOption \{[^}]+\})/s;
schema = schema.replace(optionsRegex, (match) => {
  return match.replace('}', '\n  @@map("assessment_options")\n}');
});

// Aggiungi mapping per soft_skills -> softSkill
schema = schema.replace('model soft_skills {', 'model softSkill {');
schema = schema.replace(
  '  user_soft_skills             user_soft_skills[]\n}',
  '  userSkills             userSoftSkill[]\n\n  @@map("soft_skills")\n}'
);

// Aggiungi mapping per role_soft_skills -> roleSoftSkill
schema = schema.replace('model role_soft_skills {', 'model roleSoftSkill {');
schema = schema.replace(
  'model roleSoftSkill {',
  'model roleSoftSkill {'
);

// Aggiungi mapping per user_soft_skills -> userSoftSkill
schema = schema.replace('model user_soft_skills {', 'model userSoftSkill {');
const userSoftSkillsRegex = /(model userSoftSkill \{[^}]+\})/s;
schema = schema.replace(userSoftSkillsRegex, (match) => {
  return match.replace('}', '\n  @@map("user_soft_skills")\n}');
});

// Aggiorna le relazioni
schema = schema.replace(/assessment_templates assessment_templates/g, 'template assessmentTemplate');
schema = schema.replace(/assessment_questions assessment_questions/g, 'question assessmentQuestion');
schema = schema.replace(/assessment_questions                                                                        assessment_questions\[\]/g, 'questions                                                                        assessmentQuestion[]');
schema = schema.replace(/assessment_options           assessment_options\[\]/g, 'options           assessmentOption[]');
schema = schema.replace(/soft_skills          soft_skills/g, 'softSkill          softSkill');
schema = schema.replace(/role_soft_skills             role_soft_skills\[\]/g, 'roleSoftSkills             roleSoftSkill[]');
schema = schema.replace(/user_soft_skills              user_soft_skills\[\]/g, 'userSkills              userSoftSkill[]');

fs.writeFileSync(schemaPath, schema);
console.log('✅ Schema updated with essential model mappings');