/**
 * Script per mappare le domande degli assessment ai soft skills
 * Crea le relazioni QuestionSoftSkillMapping basate sul tipo di assessment
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Traduzioni categorie IT → EN
const CATEGORY_TRANSLATIONS = {
  // Big Five
  'Estroversione': 'Extraversion',
  'Amicalità': 'Agreeableness',
  'Stabilità emotiva': 'Neuroticism',
  'Coscienziosità': 'Conscientiousness',
  'Apertura mentale': 'Openness',
  // DiSC
  'Dominanza': 'Dominance',
  'Influenza': 'Influence',
  'Stabilità': 'Steadiness',
  'Conformità': 'Compliance',
  // Belbin
  'Creativo': 'Plant',
  'Esploratore di risorse': 'Resource Investigator',
  'Coordinatore': 'Coordinator',
  'Modellatore': 'Shaper',
  'Valutatore': 'Monitor Evaluator',
  'Collaboratore': 'Teamworker',
  'Implementatore': 'Implementer',
  'Perfezionista': 'Completer Finisher',
  'Specialista': 'Specialist'
};

// Mapping tra modelli psicometrici e soft skills
const ASSESSMENT_MAPPINGS = {
  BIG_FIVE: {
    // Extraversion
    'Extraversion': {
      high: [
        { skill: 'Leadership', weight: 0.8 },
        { skill: 'Comunicazione Efficace', weight: 0.9 },
        { skill: 'Lavoro di Squadra', weight: 0.7 }
      ],
      low: [
        { skill: 'Ascolto Attivo', weight: 0.6 },
        { skill: 'Pensiero Critico', weight: 0.5 }
      ]
    },
    // Conscientiousness
    'Conscientiousness': {
      high: [
        { skill: 'Gestione del Tempo', weight: 0.9 },
        { skill: 'Capacità Decisionale', weight: 0.7 },
        { skill: 'Problem Solving', weight: 0.7 }
      ],
      low: [
        { skill: 'Flessibilità e Adattabilità', weight: -0.5 }
      ]
    },
    // Openness
    'Openness': {
      high: [
        { skill: 'Problem Solving', weight: 0.8 },
        { skill: 'Flessibilità e Adattabilità', weight: 0.9 },
        { skill: 'Pensiero Critico', weight: 0.7 }
      ],
      low: []
    },
    // Agreeableness
    'Agreeableness': {
      high: [
        { skill: 'Empatia', weight: 0.9 },
        { skill: 'Lavoro di Squadra', weight: 0.8 },
        { skill: 'Ascolto Attivo', weight: 0.8 }
      ],
      low: [
        { skill: 'Leadership', weight: 0.5 },
        { skill: 'Capacità Decisionale', weight: 0.6 }
      ]
    },
    // Neuroticism (reversed for emotional stability)
    'Neuroticism': {
      high: [
        { skill: 'Resilienza', weight: -0.8 },
        { skill: 'Intelligenza Emotiva', weight: -0.7 }
      ],
      low: [
        { skill: 'Resilienza', weight: 0.9 },
        { skill: 'Intelligenza Emotiva', weight: 0.8 },
        { skill: 'Gestione del Tempo', weight: 0.6 }
      ]
    }
  },

  DISC: {
    'Dominance': {
      skills: [
        { skill: 'Leadership', weight: 0.9 },
        { skill: 'Capacità Decisionale', weight: 0.9 },
        { skill: 'Resilienza', weight: 0.7 }
      ]
    },
    'Influence': {
      skills: [
        { skill: 'Comunicazione Efficace', weight: 0.9 },
        { skill: 'Lavoro di Squadra', weight: 0.8 },
        { skill: 'Empatia', weight: 0.7 }
      ]
    },
    'Steadiness': {
      skills: [
        { skill: 'Ascolto Attivo', weight: 0.9 },
        { skill: 'Lavoro di Squadra', weight: 0.8 },
        { skill: 'Empatia', weight: 0.8 }
      ]
    },
    'Compliance': {
      skills: [
        { skill: 'Pensiero Critico', weight: 0.9 },
        { skill: 'Problem Solving', weight: 0.8 },
        { skill: 'Gestione del Tempo', weight: 0.7 }
      ]
    }
  },

  BELBIN: {
    'Plant': {
      skills: [
        { skill: 'Problem Solving', weight: 0.9 },
        { skill: 'Pensiero Critico', weight: 0.8 },
        { skill: 'Flessibilità e Adattabilità', weight: 0.7 }
      ]
    },
    'Resource Investigator': {
      skills: [
        { skill: 'Comunicazione Efficace', weight: 0.9 },
        { skill: 'Flessibilità e Adattabilità', weight: 0.8 },
        { skill: 'Lavoro di Squadra', weight: 0.7 }
      ]
    },
    'Coordinator': {
      skills: [
        { skill: 'Leadership', weight: 0.9 },
        { skill: 'Capacità Decisionale', weight: 0.8 },
        { skill: 'Lavoro di Squadra', weight: 0.8 }
      ]
    },
    'Shaper': {
      skills: [
        { skill: 'Leadership', weight: 0.8 },
        { skill: 'Resilienza', weight: 0.9 },
        { skill: 'Capacità Decisionale', weight: 0.7 }
      ]
    },
    'Monitor Evaluator': {
      skills: [
        { skill: 'Pensiero Critico', weight: 0.9 },
        { skill: 'Capacità Decisionale', weight: 0.8 },
        { skill: 'Problem Solving', weight: 0.8 }
      ]
    },
    'Teamworker': {
      skills: [
        { skill: 'Lavoro di Squadra', weight: 0.9 },
        { skill: 'Empatia', weight: 0.9 },
        { skill: 'Ascolto Attivo', weight: 0.8 }
      ]
    },
    'Implementer': {
      skills: [
        { skill: 'Gestione del Tempo', weight: 0.9 },
        { skill: 'Problem Solving', weight: 0.7 },
        { skill: 'Resilienza', weight: 0.7 }
      ]
    },
    'Completer Finisher': {
      skills: [
        { skill: 'Gestione del Tempo', weight: 0.9 },
        { skill: 'Pensiero Critico', weight: 0.7 },
        { skill: 'Capacità Decisionale', weight: 0.6 }
      ]
    },
    'Specialist': {
      skills: [
        { skill: 'Problem Solving', weight: 0.8 },
        { skill: 'Pensiero Critico', weight: 0.8 },
        { skill: 'Flessibilità e Adattabilità', weight: 0.6 }
      ]
    }
  },

  COMPETENCY: {
    // Per i competency-based, mappa direttamente alle soft skills
    'Leadership': [{ skill: 'Leadership', weight: 1.0 }],
    'Communication': [{ skill: 'Comunicazione Efficace', weight: 1.0 }],
    'Teamwork': [{ skill: 'Lavoro di Squadra', weight: 1.0 }],
    'Problem Solving': [{ skill: 'Problem Solving', weight: 1.0 }],
    'Time Management': [{ skill: 'Gestione del Tempo', weight: 1.0 }],
    'Adaptability': [{ skill: 'Flessibilità e Adattabilità', weight: 1.0 }],
    'Critical Thinking': [{ skill: 'Pensiero Critico', weight: 1.0 }],
    'Decision Making': [{ skill: 'Capacità Decisionale', weight: 1.0 }],
    'Empathy': [{ skill: 'Empatia', weight: 1.0 }],
    'Active Listening': [{ skill: 'Ascolto Attivo', weight: 1.0 }],
    'Emotional Intelligence': [{ skill: 'Intelligenza Emotiva', weight: 1.0 }],
    'Resilience': [{ skill: 'Resilienza', weight: 1.0 }]
  }
};

async function mapQuestionsToSoftSkills() {
  console.log('🔄 Inizio mapping domande → soft skills...\n');

  try {
    // 1. Recupera tutti i soft skills
    const softSkills = await prisma.softSkill.findMany();
    const skillMap = new Map(softSkills.map(s => [s.name, s.id]));
    console.log(`✅ Trovati ${softSkills.length} soft skills nel database\n`);

    // 2. Recupera tutti i template con le domande
    const templates = await prisma.assessmentTemplate.findMany({
      include: {
        questions: true
      }
    });

    let totalMappings = 0;

    // 3. Per ogni template, crea i mapping
    for (const template of templates) {
      console.log(`📋 Processing template: ${template.name} (${template.type})`);

      const assessmentType = template.type.toUpperCase().replace('-', '_');
      const mappingConfig = ASSESSMENT_MAPPINGS[assessmentType];

      if (!mappingConfig) {
        console.log(`  ⚠️  No mapping configuration found for ${assessmentType}\n`);
        continue;
      }

      // Per ogni domanda del template
      for (const question of template.questions) {
        const originalCategory = question.category || 'General';
        // Traduci la categoria se necessario
        const category = CATEGORY_TRANSLATIONS[originalCategory] || originalCategory;
        let skillMappings = [];

        // Determina quali soft skills mappare basandosi sulla categoria
        if (assessmentType === 'BIG_FIVE') {
          const categoryMapping = mappingConfig[category];
          if (categoryMapping) {
            // Combina high e low mappings
            skillMappings = [
              ...(categoryMapping.high || []),
              ...(categoryMapping.low || [])
            ];
          }
        } else if (assessmentType === 'DISC') {
          const categoryMapping = mappingConfig[category];
          if (categoryMapping) {
            skillMappings = categoryMapping.skills || [];
          }
        } else if (assessmentType === 'BELBIN') {
          // Per Belbin, usa la categoria come ruolo del team
          const roleMapping = mappingConfig[category];
          if (roleMapping) {
            skillMappings = roleMapping.skills || [];
          }
        } else if (assessmentType === 'COMPETENCY') {
          // Per competency, mappa direttamente
          const competencyMapping = mappingConfig[category];
          if (competencyMapping) {
            skillMappings = competencyMapping;
          }
        }

        // Crea i mapping nel database
        for (const mapping of skillMappings) {
          const softSkillId = skillMap.get(mapping.skill);

          if (!softSkillId) {
            console.log(`  ⚠️  Soft skill "${mapping.skill}" not found in database`);
            continue;
          }

          // Verifica se il mapping esiste già
          const existingMapping = await prisma.questionSoftSkillMapping.findUnique({
            where: {
              questionId_softSkillId: {
                questionId: question.id,
                softSkillId: softSkillId
              }
            }
          });

          if (!existingMapping) {
            await prisma.questionSoftSkillMapping.create({
              data: {
                questionId: question.id,
                softSkillId: softSkillId,
                mappingType: mapping.weight > 0 ? 'positive' : 'negative',
                weight: Math.abs(mapping.weight),
                modelType: assessmentType.toLowerCase(),
                modelDimension: category
              }
            });
            totalMappings++;
          }
        }
      }

      console.log(`  ✅ Mappate ${template.questions.length} domande\n`);
    }

    console.log(`\n✅ Completato! Create ${totalMappings} mappature domande-soft skills`);

    // 4. Verifica e report
    const mappingCount = await prisma.questionSoftSkillMapping.count();
    const questionCount = await prisma.assessmentQuestion.count();

    console.log(`\n📊 Statistiche finali:`);
    console.log(`  - Totale domande nel sistema: ${questionCount}`);
    console.log(`  - Totale mappature create: ${mappingCount}`);
    console.log(`  - Media mappature per domanda: ${(mappingCount / questionCount).toFixed(2)}`);

  } catch (error) {
    console.error('❌ Errore durante il mapping:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
mapQuestionsToSoftSkills()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });