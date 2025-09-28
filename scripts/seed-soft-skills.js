const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Le 12 Soft Skills con tutti i dati necessari
const softSkillsData = [
  {
    code: 'communication_effective',
    name: 'Comunicazione Efficace',
    nameEn: 'Effective Communication',
    description: 'Capacità di trasmettere messaggi in modo chiaro e appropriato al contesto e interlocutore, comprendendo sia il linguaggio verbale sia non verbale. Include saper adattare il registro al pubblico e ascoltare feedback.',
    descriptionEn: 'Ability to convey messages clearly and appropriately to context and audience, understanding both verbal and non-verbal language. Includes adapting register to audience and listening to feedback.',
    category: 'relational',
    orderIndex: 1,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        extraversion: 0.7,
        agreeableness: 0.3
      },
      disc: {
        influence: 0.8,
        steadiness: 0.2
      },
      belbin: {
        resource_investigator: 0.6,
        coordinator: 0.4
      }
    }
  },
  {
    code: 'active_listening',
    name: 'Ascolto Attivo',
    nameEn: 'Active Listening',
    description: 'Capacità di prestare piena attenzione all\'interlocutore, mostrando ricettività e comprendendo sia le parole sia le emozioni espresse. Comporta fare domande pertinenti e riformulare per verificare la comprensione.',
    descriptionEn: 'Ability to pay full attention to the speaker, showing receptivity and understanding both words and emotions expressed. Involves asking relevant questions and paraphrasing to verify understanding.',
    category: 'relational',
    orderIndex: 2,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        agreeableness: 0.6,
        extraversion: -0.2
      },
      disc: {
        steadiness: 0.7,
        influence: 0.3
      },
      belbin: {
        team_worker: 0.8,
        coordinator: 0.2
      }
    }
  },
  {
    code: 'empathy',
    name: 'Empatia',
    nameEn: 'Empathy',
    description: 'Capacità di comprendere e sentire le emozioni e i punti di vista altrui, adattando il proprio comportamento di conseguenza. Un dipendente empatico sa mettersi nei panni di colleghi e clienti, favorendo un clima di fiducia.',
    descriptionEn: 'Ability to understand and feel the emotions and perspectives of others, adapting one\'s behavior accordingly. An empathetic employee can put themselves in colleagues\' and clients\' shoes, fostering a climate of trust.',
    category: 'relational',
    orderIndex: 3,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        agreeableness: 0.8,
        openness: 0.2
      },
      disc: {
        steadiness: 0.7,
        influence: 0.3
      },
      belbin: {
        team_worker: 0.9,
        coordinator: 0.1
      }
    }
  },
  {
    code: 'emotional_intelligence',
    name: 'Intelligenza Emotiva',
    nameEn: 'Emotional Intelligence',
    description: 'Capacità di riconoscere, comprendere e gestire le proprie emozioni e quelle altrui. Include la consapevolezza di sé, l\'autocontrollo emotivo, la motivazione, l\'empatia e le abilità sociali nell\'influenzare positivamente le dinamiche interpersonali.',
    descriptionEn: 'Ability to recognize, understand and manage one\'s own emotions and those of others. Includes self-awareness, emotional self-control, motivation, empathy and social skills in positively influencing interpersonal dynamics.',
    category: 'adaptive',
    orderIndex: 4,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        neuroticism: -0.7,
        agreeableness: 0.5,
        conscientiousness: 0.3
      },
      disc: {
        steadiness: 0.5,
        influence: 0.5
      },
      belbin: {
        coordinator: 0.6,
        team_worker: 0.4
      }
    }
  },
  {
    code: 'teamwork',
    name: 'Lavoro di Squadra',
    nameEn: 'Teamwork',
    description: 'Capacità di collaborare attivamente con gli altri per il raggiungimento di un obiettivo comune. Implica cooperazione, condivisione delle informazioni, rispetto dei ruoli e affidabilità reciproca all\'interno di un team.',
    descriptionEn: 'Ability to actively collaborate with others to achieve a common goal. Involves cooperation, information sharing, respect for roles and mutual reliability within a team.',
    category: 'collaborative',
    orderIndex: 5,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        agreeableness: 0.8,
        extraversion: 0.4
      },
      disc: {
        steadiness: 0.6,
        influence: 0.4
      },
      belbin: {
        team_worker: 0.7,
        coordinator: 0.3
      }
    }
  },
  {
    code: 'leadership',
    name: 'Leadership',
    nameEn: 'Leadership',
    description: 'Capacità di guidare, motivare e ispirare altre persone verso un obiettivo. Si manifesta nell\'assumersi responsabilità, nel dare l\'esempio, nel prendere decisioni difficili e nell\'aiutare il gruppo a crescere.',
    descriptionEn: 'Ability to guide, motivate and inspire others towards a goal. Manifests in taking responsibility, leading by example, making difficult decisions and helping the group grow.',
    category: 'relational',
    orderIndex: 6,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        extraversion: 0.7,
        conscientiousness: 0.5,
        neuroticism: -0.3
      },
      disc: {
        dominance: 0.7,
        influence: 0.3
      },
      belbin: {
        coordinator: 0.5,
        shaper: 0.5
      }
    }
  },
  {
    code: 'critical_thinking',
    name: 'Pensiero Critico',
    nameEn: 'Critical Thinking',
    description: 'Attitudine ad analizzare informazioni in modo oggettivo, mettere in discussione assunti e giungere a conclusioni logiche. Una persona con pensiero critico evita bias cognitivi, valuta pro e contro e argomenta le proprie decisioni basandosi sui fatti.',
    descriptionEn: 'Attitude to analyze information objectively, question assumptions and reach logical conclusions. A person with critical thinking avoids cognitive biases, weighs pros and cons and argues decisions based on facts.',
    category: 'cognitive',
    orderIndex: 7,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        openness: 0.8,
        agreeableness: -0.2
      },
      disc: {
        compliance: 0.7,
        dominance: 0.3
      },
      belbin: {
        monitor_evaluator: 0.7,
        plant: 0.3
      }
    }
  },
  {
    code: 'problem_solving',
    name: 'Problem Solving',
    nameEn: 'Problem Solving',
    description: 'Capacità di affrontare problemi e situazioni complesse trovando soluzioni efficaci e sostenibili. Coinvolge sia creatività (nel generare idee nuove) sia approccio analitico (nell\'identificare cause radice e valutare le opzioni).',
    descriptionEn: 'Ability to tackle problems and complex situations by finding effective and sustainable solutions. Involves both creativity (in generating new ideas) and analytical approach (in identifying root causes and evaluating options).',
    category: 'cognitive',
    orderIndex: 8,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        openness: 0.7,
        conscientiousness: 0.5
      },
      disc: {
        dominance: 0.5,
        compliance: 0.5
      },
      belbin: {
        plant: 0.5,
        implementer: 0.3,
        shaper: 0.2
      }
    }
  },
  {
    code: 'adaptability',
    name: 'Flessibilità e Adattabilità',
    nameEn: 'Flexibility and Adaptability',
    description: 'Capacità di adattarsi ai cambiamenti (es. nuove priorità, imprevisti, evoluzione tecnologica) mantenendo efficienza e atteggiamento positivo. Una persona flessibile è in grado di modificare piani e comportamenti di fronte a nuove informazioni o contesti.',
    descriptionEn: 'Ability to adapt to changes (e.g. new priorities, unexpected events, technological evolution) while maintaining efficiency and positive attitude. A flexible person can modify plans and behaviors when faced with new information or contexts.',
    category: 'adaptive',
    orderIndex: 9,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        openness: 0.7,
        neuroticism: -0.5
      },
      disc: {
        influence: 0.5,
        dominance: 0.5
      },
      belbin: {
        resource_investigator: 0.7,
        implementer: -0.3
      }
    }
  },
  {
    code: 'time_management',
    name: 'Gestione del Tempo',
    nameEn: 'Time Management',
    description: 'Abilità di organizzare e pianificare il proprio lavoro in modo da rispettare scadenze e priorità. Comprende l\'uso efficace del tempo, la definizione di priorità, l\'evitare procrastinazione e la capacità di concentrazione.',
    descriptionEn: 'Ability to organize and plan one\'s work to meet deadlines and priorities. Includes effective use of time, setting priorities, avoiding procrastination and ability to concentrate.',
    category: 'cognitive',
    orderIndex: 10,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        conscientiousness: 0.9,
        neuroticism: -0.1
      },
      disc: {
        compliance: 0.6,
        dominance: 0.4
      },
      belbin: {
        completer_finisher: 0.6,
        implementer: 0.4
      }
    }
  },
  {
    code: 'decision_making',
    name: 'Capacità Decisionale',
    nameEn: 'Decision Making',
    description: 'Abilità di prendere decisioni tempestive e informate, anche in condizioni di incertezza. Include valutare le alternative, considerare rischi e conseguenze, e assumersi la responsabilità delle scelte fatte.',
    descriptionEn: 'Ability to make timely and informed decisions, even under uncertainty. Includes evaluating alternatives, considering risks and consequences, and taking responsibility for choices made.',
    category: 'cognitive',
    orderIndex: 11,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        neuroticism: -0.6,
        extraversion: 0.5,
        conscientiousness: 0.4
      },
      disc: {
        dominance: 0.8,
        compliance: 0.2
      },
      belbin: {
        shaper: 0.6,
        coordinator: 0.4
      }
    }
  },
  {
    code: 'resilience',
    name: 'Resilienza',
    nameEn: 'Resilience',
    description: 'Capacità di far fronte a stress, difficoltà e cambiamenti senza venirne sopraffatti, recuperando rapidamente energia e motivazione. Si traduce nel non abbattersi di fronte agli ostacoli ma riorganizzarsi e andare avanti con rinnovata determinazione.',
    descriptionEn: 'Ability to cope with stress, difficulties and changes without being overwhelmed, quickly recovering energy and motivation. Translates into not being discouraged by obstacles but reorganizing and moving forward with renewed determination.',
    category: 'adaptive',
    orderIndex: 12,
    isActive: true,
    evaluationCriteria: {
      bigFive: {
        neuroticism: -0.8,
        conscientiousness: 0.5
      },
      disc: {
        steadiness: 0.6,
        dominance: 0.4
      },
      belbin: {
        shaper: 0.6,
        completer_finisher: 0.4
      }
    }
  }
];

async function seedSoftSkills() {
  try {
    console.log('\n🌱 SEEDING SOFT SKILLS DATABASE\n');
    console.log('='.repeat(60));

    // Prima verifica se ci sono già soft skills nel database
    const existingCount = await prisma.soft_skills.count();
    if (existingCount > 0) {
      console.log(`⚠️  Trovate ${existingCount} soft skills esistenti nel database.`);
      console.log('Vuoi eliminare i dati esistenti? Questa operazione non può essere annullata.');
      console.log('Per procedere, esegui: node scripts/seed-soft-skills.js --force');

      if (!process.argv.includes('--force')) {
        process.exit(0);
      }

      console.log('\n🗑️  Eliminazione soft skills esistenti...');
      await prisma.soft_skills.deleteMany();
      console.log('✅ Soft skills esistenti eliminate.');
    }

    console.log('\n📝 Inserimento delle 12 Soft Skills...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const skillData of softSkillsData) {
      try {
        const skill = await prisma.soft_skills.create({
          data: skillData
        });

        console.log(`✅ ${skill.orderIndex}. ${skill.name} (${skill.code})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Errore inserendo ${skillData.name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RIEPILOGO OPERAZIONE:');
    console.log(`   ✅ Soft skills inserite con successo: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Soft skills con errori: ${errorCount}`);
    }

    // Verifica finale
    const finalCount = await prisma.soft_skills.count();
    console.log(`\n📈 Totale soft skills nel database: ${finalCount}`);

    // Mostra un esempio di soft skill inserita
    if (finalCount > 0) {
      const example = await prisma.soft_skills.findFirst({
        where: { code: 'communication_effective' }
      });

      if (example) {
        console.log('\n📋 ESEMPIO DI SOFT SKILL INSERITA:');
        console.log('   Nome:', example.name);
        console.log('   Nome EN:', example.nameEn);
        console.log('   Categoria:', example.category);
        console.log('   Criteri di valutazione:',
          example.evaluationCriteria ? 'Configurati' : 'Non configurati');
      }
    }

    console.log('\n✅ SEED COMPLETATO CON SUCCESSO!\n');

  } catch (error) {
    console.error('\n❌ ERRORE DURANTE IL SEED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui il seed
seedSoftSkills().catch((error) => {
  console.error('Errore fatale:', error);
  process.exit(1);
});