const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed predefiniti per assessment templates globali
 * Questi template saranno disponibili per tutti i tenant
 */
const assessmentTemplates = [
  {
    name: 'Big Five Personality Assessment',
    type: 'big_five',
    description: 'Valutazione completa della personalità basata sul modello Big Five (OCEAN)',
    instructions: 'Rispondi a tutte le domande in base a come ti comporti normalmente, non come vorresti comportarti.',
    suggestedRoles: ['all'],
    suggestedFrequency: 'yearly',
    aiPrompt: 'Generate personality assessment questions based on Big Five model',
    aiModel: 'gpt-5',
    questions: [
      {
        text: 'Mi sento a mio agio in situazioni sociali con molte persone',
        category: 'Extraversion',
        type: 'likert_scale',
        orderIndex: 1,
        options: [
          { text: 'Fortemente in disaccordo', value: 1, orderIndex: 1 },
          { text: 'In disaccordo', value: 2, orderIndex: 2 },
          { text: 'Neutrale', value: 3, orderIndex: 3 },
          { text: "D'accordo", value: 4, orderIndex: 4 },
          { text: "Fortemente d'accordo", value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Tendo a fidarmi facilmente delle persone',
        category: 'Agreeableness',
        type: 'likert_scale',
        orderIndex: 2,
        options: [
          { text: 'Fortemente in disaccordo', value: 1, orderIndex: 1 },
          { text: 'In disaccordo', value: 2, orderIndex: 2 },
          { text: 'Neutrale', value: 3, orderIndex: 3 },
          { text: "D'accordo", value: 4, orderIndex: 4 },
          { text: "Fortemente d'accordo", value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Sono sempre puntuale agli appuntamenti',
        category: 'Conscientiousness',
        type: 'likert_scale',
        orderIndex: 3,
        options: [
          { text: 'Fortemente in disaccordo', value: 1, orderIndex: 1 },
          { text: 'In disaccordo', value: 2, orderIndex: 2 },
          { text: 'Neutrale', value: 3, orderIndex: 3 },
          { text: "D'accordo", value: 4, orderIndex: 4 },
          { text: "Fortemente d'accordo", value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Mi preoccupo facilmente per le cose',
        category: 'Neuroticism',
        type: 'likert_scale',
        orderIndex: 4,
        options: [
          { text: 'Fortemente in disaccordo', value: 1, orderIndex: 1 },
          { text: 'In disaccordo', value: 2, orderIndex: 2 },
          { text: 'Neutrale', value: 3, orderIndex: 3 },
          { text: "D'accordo", value: 4, orderIndex: 4 },
          { text: "Fortemente d'accordo", value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Mi piace esplorare nuove idee e concetti',
        category: 'Openness',
        type: 'likert_scale',
        orderIndex: 5,
        options: [
          { text: 'Fortemente in disaccordo', value: 1, orderIndex: 1 },
          { text: 'In disaccordo', value: 2, orderIndex: 2 },
          { text: 'Neutrale', value: 3, orderIndex: 3 },
          { text: "D'accordo", value: 4, orderIndex: 4 },
          { text: "Fortemente d'accordo", value: 5, orderIndex: 5 }
        ]
      }
    ]
  },
  {
    name: 'DiSC Behavioral Assessment',
    type: 'disc',
    description: 'Valutazione comportamentale DiSC per identificare stili di comunicazione e lavoro',
    instructions: 'Scegli le risposte che meglio descrivono il tuo comportamento tipico sul lavoro.',
    suggestedRoles: ['manager', 'team_lead', 'sales'],
    suggestedFrequency: 'quarterly',
    aiPrompt: 'Generate DiSC behavioral assessment questions',
    aiModel: 'gpt-5',
    questions: [
      {
        text: 'In una situazione di conflitto, tendo a:',
        category: 'Behavioral',
        type: 'multiple_choice',
        orderIndex: 1,
        options: [
          { text: 'Affrontare direttamente il problema e cercare una soluzione rapida', value: 1, orderIndex: 1 },
          { text: 'Cercare di mediare e trovare un compromesso che soddisfi tutti', value: 2, orderIndex: 2 },
          { text: 'Analizzare attentamente tutti i fatti prima di agire', value: 3, orderIndex: 3 },
          { text: 'Mantenere la calma e cercare di ridurre le tensioni', value: 4, orderIndex: 4 }
        ]
      },
      {
        text: 'Quando lavoro in team, preferisco:',
        category: 'Teamwork',
        type: 'multiple_choice',
        orderIndex: 2,
        options: [
          { text: 'Prendere il comando e guidare il gruppo verso gli obiettivi', value: 1, orderIndex: 1 },
          { text: 'Motivare e ispirare gli altri con entusiasmo', value: 2, orderIndex: 2 },
          { text: 'Supportare il team e assicurare che tutti si sentano inclusi', value: 3, orderIndex: 3 },
          { text: 'Fornire analisi dettagliate e garantire la qualità del lavoro', value: 4, orderIndex: 4 }
        ]
      },
      {
        text: 'Il mio approccio alle decisioni è:',
        category: 'Decision Making',
        type: 'multiple_choice',
        orderIndex: 3,
        options: [
          { text: 'Veloce e basato sui risultati desiderati', value: 1, orderIndex: 1 },
          { text: 'Intuitivo e basato sulle persone coinvolte', value: 2, orderIndex: 2 },
          { text: 'Ponderato e basato sulla stabilità', value: 3, orderIndex: 3 },
          { text: 'Metodico e basato sui dati', value: 4, orderIndex: 4 }
        ]
      }
    ]
  },
  {
    name: 'Belbin Team Roles Assessment',
    type: 'belbin',
    description: 'Identificazione dei ruoli preferiti nel team secondo il modello Belbin',
    instructions: 'Indica quanto spesso adotti questi comportamenti quando lavori in team.',
    suggestedRoles: ['all'],
    suggestedFrequency: 'once',
    aiPrompt: 'Generate Belbin team roles assessment questions',
    aiModel: 'claude-3',
    questions: [
      {
        text: 'In un progetto di team, tendo a:',
        category: 'Team Contribution',
        type: 'multiple_choice',
        orderIndex: 1,
        options: [
          { text: 'Generare idee creative e innovative', value: 1, orderIndex: 1 },
          { text: 'Trasformare le idee in piani pratici', value: 2, orderIndex: 2 },
          { text: 'Assicurare che il lavoro sia completato nei tempi', value: 3, orderIndex: 3 },
          { text: 'Coordinare le attività del team', value: 4, orderIndex: 4 },
          { text: 'Cercare risorse e contatti esterni', value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Il mio punto di forza principale nel team è:',
        category: 'Strengths',
        type: 'multiple_choice',
        orderIndex: 2,
        options: [
          { text: 'Creatività e pensiero originale', value: 1, orderIndex: 1 },
          { text: 'Valutazione obiettiva delle opzioni', value: 2, orderIndex: 2 },
          { text: 'Conoscenza specialistica approfondita', value: 3, orderIndex: 3 },
          { text: 'Capacità di motivare e ispirare', value: 4, orderIndex: 4 },
          { text: 'Attenzione ai dettagli e alla qualità', value: 5, orderIndex: 5 }
        ]
      }
    ]
  },
  {
    name: 'Competenze di Leadership',
    type: 'competency',
    description: 'Valutazione delle competenze chiave di leadership',
    instructions: 'Valuta il tuo livello di competenza in ciascuna area.',
    suggestedRoles: ['manager', 'team_lead', 'executive'],
    suggestedFrequency: 'quarterly',
    questions: [
      {
        text: 'Capacità di comunicare una visione chiara al team',
        category: 'Vision',
        type: 'likert_scale',
        orderIndex: 1,
        options: [
          { text: 'Principiante', value: 1, orderIndex: 1 },
          { text: 'In sviluppo', value: 2, orderIndex: 2 },
          { text: 'Competente', value: 3, orderIndex: 3 },
          { text: 'Esperto', value: 4, orderIndex: 4 },
          { text: 'Master', value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Capacità di delegare efficacemente',
        category: 'Delegation',
        type: 'likert_scale',
        orderIndex: 2,
        options: [
          { text: 'Principiante', value: 1, orderIndex: 1 },
          { text: 'In sviluppo', value: 2, orderIndex: 2 },
          { text: 'Competente', value: 3, orderIndex: 3 },
          { text: 'Esperto', value: 4, orderIndex: 4 },
          { text: 'Master', value: 5, orderIndex: 5 }
        ]
      },
      {
        text: 'Capacità di dare feedback costruttivo',
        category: 'Feedback',
        type: 'likert_scale',
        orderIndex: 3,
        options: [
          { text: 'Principiante', value: 1, orderIndex: 1 },
          { text: 'In sviluppo', value: 2, orderIndex: 2 },
          { text: 'Competente', value: 3, orderIndex: 3 },
          { text: 'Esperto', value: 4, orderIndex: 4 },
          { text: 'Master', value: 5, orderIndex: 5 }
        ]
      }
    ]
  }
];

async function seedAssessments() {
  console.log('🌱 Seeding assessment templates...');

  for (const template of assessmentTemplates) {
    const { questions, ...templateData } = template;

    try {
      // Crea il template
      const createdTemplate = await prisma.assessmentTemplate.create({
        data: {
          ...templateData,
          createdBy: 'SYSTEM_SEED',
          questions: {
            create: questions.map(q => ({
              text: q.text,
              category: q.category,
              type: q.type,
              orderIndex: q.orderIndex,
              isRequired: true,
              options: {
                create: q.options.map(opt => ({
                  text: opt.text,
                  value: opt.value,
                  orderIndex: opt.orderIndex,
                  isCorrect: false
                }))
              }
            }))
          }
        },
        include: {
          questions: {
            include: {
              options: true
            }
          }
        }
      });

      console.log(`✅ Created template: ${createdTemplate.name}`);
      console.log(`   - ${createdTemplate.questions.length} questions`);
      console.log(`   - Type: ${createdTemplate.type}`);
    } catch (error) {
      console.error(`❌ Error creating template ${template.name}:`, error.message);
    }
  }

  console.log('\n✨ Assessment seeding completed!');
}

// Esegui il seed
seedAssessments()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });