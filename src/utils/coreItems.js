/**
 * Core Items for Backend
 * @module utils/coreItems
 * @created 2025-09-30
 */

const CORE_ITEMS = {
  motivation: [
    {
      id: 'core_motivation_1',
      moduleId: 'motivation',
      text: 'Mi sento motivato ad impegnarmi nel mio lavoro',
      scale: 'Likert5',
      reverse: false,
      tags: ['motivation', 'engagement', 'commitment'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 1
    },
    {
      id: 'core_motivation_2',
      moduleId: 'motivation',
      text: 'Il mio lavoro mi offre opportunità di realizzazione personale',
      scale: 'Likert5',
      reverse: false,
      tags: ['motivation', 'fulfillment', 'personal_growth'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 2
    }
  ],
  communication: [
    {
      id: 'core_communication_1',
      moduleId: 'communication',
      text: 'Le informazioni importanti vengono condivise tempestivamente nel mio team',
      scale: 'Likert5',
      reverse: false,
      tags: ['communication', 'information_sharing', 'transparency'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 3
    },
    {
      id: 'core_communication_2',
      moduleId: 'communication',
      text: 'Mi sento ascoltato quando esprimo idee o preoccupazioni',
      scale: 'Likert5',
      reverse: false,
      tags: ['communication', 'voice', 'listening'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 4
    }
  ],
  leadership: [
    {
      id: 'core_leadership_1',
      moduleId: 'leadership',
      text: 'Il mio responsabile dimostra fiducia nelle mie capacità',
      scale: 'Likert5',
      reverse: false,
      tags: ['leadership', 'trust', 'support'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 5
    },
    {
      id: 'core_leadership_2',
      moduleId: 'leadership',
      text: 'Ricevo direzione chiara sulle priorità e gli obiettivi',
      scale: 'Likert5',
      reverse: false,
      tags: ['leadership', 'clarity', 'direction', 'goals'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 6
    }
  ],
  wellbeing: [
    {
      id: 'core_wellbeing_1',
      moduleId: 'wellbeing',
      text: 'Riesco a mantenere un equilibrio sano tra lavoro e vita privata',
      scale: 'Likert5',
      reverse: false,
      tags: ['wellbeing', 'work_life_balance', 'balance'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 7
    },
    {
      id: 'core_wellbeing_2',
      moduleId: 'wellbeing',
      text: 'Il carico di lavoro è gestibile e sostenibile',
      scale: 'Likert5',
      reverse: false,
      tags: ['wellbeing', 'workload', 'sustainability'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 8
    }
  ],
  belonging_psychsafe: [
    {
      id: 'core_belonging_psychsafe_1',
      moduleId: 'belonging_psychsafe',
      text: 'Mi sento parte integrante del mio team',
      scale: 'Likert5',
      reverse: false,
      tags: ['belonging', 'inclusion', 'team'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 9
    },
    {
      id: 'core_belonging_psychsafe_2',
      moduleId: 'belonging_psychsafe',
      text: 'Mi sento libero di esprimere opinioni diverse senza timore di conseguenze negative',
      scale: 'Likert5',
      reverse: false,
      tags: ['psychsafe', 'voice', 'trust', 'openness'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 10
    }
  ],
  growth_recognition: [
    {
      id: 'core_growth_recognition_1',
      moduleId: 'growth_recognition',
      text: 'Ho opportunità di sviluppare nuove competenze nel mio ruolo',
      scale: 'Likert5',
      reverse: false,
      tags: ['growth', 'learning', 'development', 'skills'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 11
    },
    {
      id: 'core_growth_recognition_2',
      moduleId: 'growth_recognition',
      text: 'Il mio contributo viene riconosciuto e apprezzato',
      scale: 'Likert5',
      reverse: false,
      tags: ['recognition', 'appreciation', 'value'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 12
    }
  ],
  motivation_fit: [
    {
      id: 'core_motivation_fit_1',
      moduleId: 'motivation_fit',
      text: 'I valori della mia organizzazione sono allineati con i miei valori personali',
      scale: 'Likert5',
      reverse: false,
      tags: ['fit', 'values', 'alignment', 'culture'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 13
    },
    {
      id: 'core_motivation_fit_2',
      moduleId: 'motivation_fit',
      text: 'Il mio ruolo attuale utilizza bene le mie competenze e capacità',
      scale: 'Likert5',
      reverse: false,
      tags: ['fit', 'skills', 'role', 'utilization'],
      source: 'Original',
      license: 'MIT',
      locale: 'it',
      isCore: true,
      order: 14
    }
  ]
};

function getCoreItemsForModules(moduleIds) {
  const items = [];

  for (const moduleId of moduleIds) {
    const moduleItems = CORE_ITEMS[moduleId];
    if (moduleItems) {
      items.push(...moduleItems);
    }
  }

  return items;
}

function getCoreItemsCount(moduleIds) {
  return moduleIds.reduce((count, moduleId) => {
    const moduleItems = CORE_ITEMS[moduleId];
    return count + (moduleItems ? moduleItems.length : 0);
  }, 0);
}

module.exports = {
  CORE_ITEMS,
  getCoreItemsForModules,
  getCoreItemsCount
};