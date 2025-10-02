/**
 * Adaptive Engine for Backend
 * @module utils/adaptiveEngine
 * @created 2025-09-30
 */

const { getCoreItemsForModules } = require('./coreItems');
const { filterQuestions } = require('./surveyFilters');
const questionBank = require('../data/questionBank.json');

class AdaptiveEngine {
  constructor() {
    this.questionBank = questionBank.questions || [];
  }

  async generateSurvey(config) {
    const surveyId = this.generateSurveyId();
    const targetLength = config.targetLength || 20;

    let selectedQuestions = [];
    let coreCount = 0;

    // Step 1: Get core items if keepCoreFixed is true
    if (config.keepCoreFixed !== false) {
      const coreItems = getCoreItemsForModules(config.selectedModules);
      selectedQuestions = [...coreItems];
      coreCount = coreItems.length;
    }

    // Step 2: Get pool of questions for selected modules
    const poolQuestions = this.questionBank.filter(q =>
      config.selectedModules.includes(q.moduleId)
    );

    // Step 3: Apply filters for objective and role
    const filteredPool = filterQuestions(
      poolQuestions,
      config.objective,
      config.role
    );

    // Step 4: Remove core items from pool to avoid duplicates
    const nonCorePool = filteredPool.filter(q =>
      !selectedQuestions.some(core => core.id === q.id)
    );

    // Step 5: Select additional questions to reach target length
    const remainingSlots = Math.max(0, targetLength - selectedQuestions.length);
    const additionalQuestions = this.selectDiverseQuestions(
      nonCorePool,
      remainingSlots,
      config
    );

    selectedQuestions = [...selectedQuestions, ...additionalQuestions];

    // Step 6: Sort questions
    const finalQuestions = this.sortQuestions(selectedQuestions);

    return {
      id: surveyId,
      config,
      questions: finalQuestions,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalQuestions: finalQuestions.length,
        coreQuestions: coreCount,
        adaptedQuestions: finalQuestions.length - coreCount,
        aiRefinement: false
      }
    };
  }

  selectDiverseQuestions(pool, count, config) {
    if (pool.length === 0 || count <= 0) {
      return [];
    }

    const selected = [];
    const moduleCount = new Map();
    const usedTags = new Set();

    // Initialize module count
    config.selectedModules.forEach(m => moduleCount.set(m, 0));

    // Select questions with diversity
    for (const question of pool) {
      if (selected.length >= count) break;

      const moduleQCount = moduleCount.get(question.moduleId) || 0;
      const avgQuestionsPerModule = count / config.selectedModules.length;
      const isModuleUnderrepresented = moduleQCount < avgQuestionsPerModule * 1.5;

      const questionTags = question.tags || [];
      const hasNewTags = questionTags.some(tag => !usedTags.has(tag));

      if (isModuleUnderrepresented || hasNewTags) {
        selected.push(question);
        moduleCount.set(question.moduleId, moduleQCount + 1);
        questionTags.forEach(tag => usedTags.add(tag));
      }
    }

    // Fill remaining slots
    if (selected.length < count) {
      const remaining = pool.filter(q =>
        !selected.some(s => s.id === q.id)
      );
      selected.push(...remaining.slice(0, count - selected.length));
    }

    return selected.slice(0, count);
  }

  sortQuestions(questions) {
    const moduleOrder = [
      'motivation',
      'communication',
      'leadership',
      'wellbeing',
      'belonging_psychsafe',
      'growth_recognition',
      'motivation_fit'
    ];

    return questions.sort((a, b) => {
      const moduleIndexA = moduleOrder.indexOf(a.moduleId);
      const moduleIndexB = moduleOrder.indexOf(b.moduleId);

      if (moduleIndexA !== moduleIndexB) {
        return moduleIndexA - moduleIndexB;
      }

      if (a.isCore && !b.isCore) return -1;
      if (!a.isCore && b.isCore) return 1;

      return (a.order || 999) - (b.order || 999);
    });
  }

  generateSurveyId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `survey_${timestamp}_${random}`;
  }

  validateConfig(config) {
    const errors = [];

    if (!config.selectedModules || config.selectedModules.length === 0) {
      errors.push('Seleziona almeno un modulo');
    }

    if (config.targetLength && config.targetLength < 5) {
      errors.push('Il questionario deve avere almeno 5 domande');
    }

    if (config.targetLength && config.targetLength > 50) {
      errors.push('Il questionario non può superare le 50 domande');
    }

    return errors;
  }

  performSafetyCheck(text) {
    const warnings = [];
    const blockedItems = [];

    const proprietaryTerms = [
      'Gallup Q12',
      'Q12',
      'Utrecht Work Engagement Scale',
      'UWES',
      'Maslach Burnout Inventory',
      'MBI',
      'engagement scale proprietary',
      'Copyright Gallup',
      '© Gallup'
    ];

    for (const term of proprietaryTerms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        blockedItems.push(term);
        warnings.push(`Contenuto proprietario rilevato: ${term}`);
      }
    }

    return {
      isValid: blockedItems.length === 0,
      warnings,
      blockedItems
    };
  }
}

module.exports = {
  adaptiveEngine: new AdaptiveEngine(),
  AdaptiveEngine
};