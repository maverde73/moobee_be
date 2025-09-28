/**
 * Template prompts per la generazione di assessment con AI
 * @module assessmentPrompts
 */

const assessmentPrompts = {
  /**
   * Prompts per Big Five personality assessment
   */
  bigFive: {
    system: `Sei un esperto/a di psicometria e assessment del personale specializzato nel modello Big Five (OCEAN).
    Genera domande di assessment scientificamente valide che misurano:
    - Estroversione
    - Amicalità (Gradevolezza)
    - Stabilità emotiva (Nevroticismo inverso)
    - Coscienziosità
    - Apertura mentale`,

    generateQuestions: (params) => {
      let prompt = `Sei un esperto/a di psicometria e assessment del personale. Genera un questionario breve basato sui Big Five per contesti di selezione e sviluppo professionale.

REQUISITI BASE:
- Lingua: italiano, registro professionale, livello B1–B2.
- Tratti: Estroversione, Amicalità, Stabilità emotiva, Coscienziosità, Apertura mentale.
- Scala di risposta (Likert a 5 punti):
  1 = Per niente d'accordo
  2 = Poco d'accordo
  3 = Né d'accordo né in disaccordo
  4 = Abbastanza d'accordo
  5 = Completamente d'accordo
- Qualità degli item: una sola idea per frase; evitare negazioni doppie; 8–18 parole; contesto lavorativo; nessun riferimento a età, genere, origine, salute o altri aspetti protetti.
- Controllo bias di acquiescenza: per ciascun tratto inserisci esattamente 2 item in direzione inversa (cioè punteggio alto = livello basso del tratto).`;

      // Aggiungi personalizzazione se presente
      if (params.customization) {
        prompt += `\n\nREQUISITI PERSONALIZZATI:\n${params.customization}`;
      }

      // Aggiungi soft skills dei ruoli se presenti
      if (params.roleSoftSkills && Array.isArray(params.roleSoftSkills) && params.roleSoftSkills.length > 0) {
        prompt += `\n\n===== RUOLI TARGET E SOFT SKILLS RICHIESTI =====\n`;

        params.roleSoftSkills.forEach(role => {
          prompt += `\n📋 **${role.roleName}**\n`;

          // Soft skills critici (priorità 1-2)
          const criticalSkills = role.skills.filter(s => s.priority <= 2);
          if (criticalSkills.length > 0) {
            prompt += `SOFT SKILLS CRITICI (devono essere valutati approfonditamente):\n`;
            criticalSkills.forEach(skill => {
              prompt += `  • ${skill.name} (${skill.nameEn}) - Minimo richiesto: ${skill.minScore}%\n`;
            });
          }

          // Soft skills importanti (priorità 3-4)
          const importantSkills = role.skills.filter(s => s.priority >= 3 && s.priority <= 4);
          if (importantSkills.length > 0) {
            prompt += `SOFT SKILLS IMPORTANTI:\n`;
            importantSkills.forEach(skill => {
              prompt += `  • ${skill.name} - Minimo: ${skill.minScore}%\n`;
            });
          }

          // Soft skills complementari (priorità 5+)
          const complementarySkills = role.skills.filter(s => s.priority >= 5);
          if (complementarySkills.length > 0) {
            prompt += `SOFT SKILLS COMPLEMENTARI:\n`;
            complementarySkills.forEach(skill => {
              prompt += `  • ${skill.name}\n`;
            });
          }
        });

        prompt += `\n⚠️ IMPORTANTE: Le domande generate devono permettere di valutare accuratamente questi soft skills specifici per i ruoli indicati. Assicurati che ci siano domande sufficienti per ciascuna area critica.\n`;
      } else {
        prompt += `\n\nIMPORTANTE: Se sono specificati dei RUOLI TARGET, le domande devono essere particolarmente rilevanti per valutare le caratteristiche di personalità utili per quei ruoli specifici.\n`;
      }

      prompt += `\nFORMATO OUTPUT:
Genera esattamente ${params.count || 20} domande in formato JSON array.
Ogni domanda deve avere i campi: text, category (uno dei 5 tratti), type: "multiple_choice", options (array con le 5 opzioni Likert con text e value).`;

      return prompt;
    },

    evaluateProfile: (responses) => `
      Analyze these Big Five assessment responses and provide:
      1. Score for each dimension (0-100)
      2. Personality profile description
      3. Workplace strengths based on profile
      4. Potential challenges and growth areas
      5. Team role recommendations
      6. Career path suggestions

      Responses: ${JSON.stringify(responses)}

      Return detailed psychological profile in JSON format.
    `
  },

  /**
   * Prompts per DiSC assessment
   */
  disc: {
    system: `Sei un esperto/a di assessment comportamentale DiSC.
    Genera domande che identificano accuratamente:
    - Dominanza (D): Orientato ai risultati, deciso, diretto
    - Influenza (i): Entusiasta, ottimista, collaborativo
    - Stabilità (S): Paziente, supportivo, stabile
    - Coscienziosità (C): Analitico, accurato, orientato ai dettagli`,

    generateQuestions: (params) => {
      let prompt = `Sei un/a esperto/a di psicometria e assessment del personale. Genera un questionario breve basato sul modello DISC per contesti di selezione e sviluppo professionale.

REQUISITI BASE:
- Lingua: italiano, registro professionale, livello B1–B2.
- Dimensioni DISC: Dominanza, Influenza, Stabilità, Coscienziosità.
- Scala di risposta (Likert a 5 punti):
  1 = Per niente d'accordo
  2 = Poco d'accordo
  3 = Né d'accordo né in disaccordo
  4 = Abbastanza d'accordo
  5 = Completamente d'accordo
- Qualità degli item: una sola idea per frase; evitare negazioni doppie; 8–18 parole; contesto lavorativo realistico; nessun riferimento a età, genere, origine, salute o altri aspetti protetti.
- Controllo bias di acquiescenza: per ciascuna dimensione inserisci item in direzione inversa.`;

      // Aggiungi personalizzazione se presente
      if (params.customization) {
        prompt += `\n\nREQUISITI PERSONALIZZATI:\n${params.customization}`;
      }

      // Aggiungi soft skills dei ruoli se presenti
      if (params.roleSoftSkills && Array.isArray(params.roleSoftSkills) && params.roleSoftSkills.length > 0) {
        prompt += `\n\n===== RUOLI TARGET E SOFT SKILLS RICHIESTI =====\n`;

        params.roleSoftSkills.forEach(role => {
          prompt += `\n📋 **${role.roleName}**\n`;
          const criticalSkills = role.skills.filter(s => s.priority <= 2);
          if (criticalSkills.length > 0) {
            prompt += `SOFT SKILLS CRITICI:\n`;
            criticalSkills.forEach(skill => {
              prompt += `  • ${skill.name} (${skill.nameEn}) - Minimo richiesto: ${skill.minScore}%\n`;
            });
          }
        });

        prompt += `\n⚠️ IMPORTANTE: Le domande devono essere particolarmente rilevanti per valutare i comportamenti utili per questi ruoli specifici.\n`;
      } else {
        prompt += `\n\nIMPORTANTE: Se sono specificati dei RUOLI TARGET, le domande devono essere particolarmente rilevanti per valutare i comportamenti utili per quei ruoli specifici.\n`;
      }

      prompt += `\nFORMATO OUTPUT:
Genera esattamente ${params.count || 20} domande in formato JSON array.
Ogni domanda deve avere i campi: text, category (una delle 4 dimensioni DISC), type: "multiple_choice", options (array con le 5 opzioni scala Likert con text e value).`;

      return prompt;
    },

    evaluateProfile: (responses) => `
      Analyze DiSC assessment responses to determine:
      1. Primary DiSC style and percentage
      2. Secondary style if applicable
      3. Full DiSC profile breakdown (D%, i%, S%, C%)
      4. Communication style preferences
      5. Motivators and stressors
      6. Ideal work environment
      7. Leadership approach
      8. Team collaboration tips

      Responses: ${JSON.stringify(responses)}

      Provide comprehensive DiSC profile analysis in JSON.
    `
  },

  /**
   * Prompts per Belbin Team Roles
   */
  belbin: {
    system: `Sei un esperto/a della teoria dei Ruoli di Belbin nel team.
    Genera domande che identificano i 9 ruoli del team:
    - Orientati all'azione: Shaper, Implementer, Completer-Finisher
    - Orientati alle persone: Coordinator, Team Worker, Resource Investigator
    - Orientati al pensiero: Plant, Monitor-Evaluator, Specialist`,

    generateQuestions: (params) => {
      let prompt = `Sei un esperto/a di psicometria e assessment del personale. Genera un questionario breve basato sui Ruoli di Belbin per contesti di selezione e sviluppo professionale.

REQUISITI BASE:
- Lingua: italiano, registro professionale, livello B1–B2.
- Ruoli: Plant (Creativo), Monitor Valutatore, Coordinatore, Risolutore di risorse, Implementatore, Completer Finisher, Teamworker, Shaper (Modellatore), Specialista.
- Scala di risposta (Likert a 5 punti):
  1 = Per niente d'accordo
  2 = Poco d'accordo
  3 = Né d'accordo né in disaccordo
  4 = Abbastanza d'accordo
  5 = Completamente d'accordo
- Qualità degli item: una sola idea per frase; evitare negazioni doppie; 8–18 parole; contesto lavorativo; nessun riferimento a età, genere, origine, salute o altri aspetti protetti.
- Controllo bias di acquiescenza: per ciascun ruolo inserisci item in direzione inversa.`;

      // Aggiungi personalizzazione se presente
      if (params.customization) {
        prompt += `\n\nREQUISITI PERSONALIZZATI:\n${params.customization}`;
      }

      // Aggiungi soft skills dei ruoli se presenti
      if (params.roleSoftSkills && Array.isArray(params.roleSoftSkills) && params.roleSoftSkills.length > 0) {
        prompt += `\n\n===== RUOLI TARGET E SOFT SKILLS RICHIESTI =====\n`;

        params.roleSoftSkills.forEach(role => {
          prompt += `\n📋 **${role.roleName}**\n`;
          const criticalSkills = role.skills.filter(s => s.priority <= 2);
          if (criticalSkills.length > 0) {
            prompt += `SOFT SKILLS CRITICI:\n`;
            criticalSkills.forEach(skill => {
              prompt += `  • ${skill.name} (${skill.nameEn}) - Minimo richiesto: ${skill.minScore}%\n`;
            });
          }
        });

        prompt += `\n⚠️ IMPORTANTE: Le domande devono essere particolarmente rilevanti per identificare i ruoli di team più adatti per queste posizioni specifiche.\n`;
      } else {
        prompt += `\n\nIMPORTANTE: Se sono specificati dei RUOLI TARGET, le domande devono essere particolarmente rilevanti per identificare i ruoli di team più adatti per quelle posizioni specifiche.\n`;
      }

      prompt += `\nFORMATO OUTPUT:
Genera esattamente ${params.count || 15} domande in formato JSON array.
Ogni domanda deve avere i campi: text, category (uno dei 9 ruoli Belbin), type: "multiple_choice", options (array con le 5 opzioni Likert con text e value).`;

      return prompt;
    },

    evaluateProfile: (responses) => `
      Analyze Belbin assessment to identify:
      1. Primary team role (highest score)
      2. Secondary team role
      3. Complete role profile (all 9 roles scored)
      4. Team contribution strengths
      5. Potential blind spots
      6. Ideal team composition
      7. Role flexibility assessment

      Responses: ${JSON.stringify(responses)}

      Provide detailed Belbin team role analysis in JSON.
    `
  },



  /**
   * Prompts per validazione e improvement
   */
  validation: {
    reviewQuestions: (questions) => `
      Review these assessment questions for:
      1. Psychological validity
      2. Cultural sensitivity
      3. Clarity and comprehension
      4. Bias detection
      5. Appropriate difficulty

      Questions: ${JSON.stringify(questions)}

      Provide specific improvement suggestions for each issue found.
    `,

    generateScoring: (assessmentType, questions) => `
      Create a comprehensive scoring rubric for this ${assessmentType} assessment.

      Include:
      1. Scoring algorithm
      2. Normalization method
      3. Interpretation guidelines
      4. Benchmark scores
      5. Result categories/profiles

      Questions: ${JSON.stringify(questions)}

      Return detailed scoring system in JSON format.
    `
  },

  /**
   * Prompts per report generation
   */
  reporting: {
    generateReport: (assessmentData) => `
      Create a professional assessment report for:

      Employee: ${assessmentData.employeeName}
      Assessment Type: ${assessmentData.type}
      Date: ${assessmentData.date}
      Scores: ${JSON.stringify(assessmentData.scores)}

      Include:
      1. Executive Summary
      2. Detailed Results by Category
      3. Strengths Analysis (top 5)
      4. Development Areas (top 3)
      5. Peer Comparison (if available)
      6. Personalized Recommendations
      7. Action Plan Template
      8. Resources for Development

      Format in professional Markdown with clear sections.
      Tone: Constructive, encouraging, and actionable.
    `,

    generateFeedback: (scores, type) => `
      Generate personalized feedback for ${type} assessment results.

      Scores: ${JSON.stringify(scores)}

      Create:
      1. Positive reinforcement message
      2. Key insights about the profile
      3. 3 specific action items
      4. Growth mindset encouragement

      Tone: Supportive, specific, and motivating.
      Length: 200-300 words.
    `
  }
};

/**
 * Helper function per ottenere prompt appropriato
 * @param {string} type - Tipo di assessment
 * @param {string} action - Azione da eseguire
 * @param {Object} params - Parametri aggiuntivi
 * @returns {Object} System prompt e user prompt
 */
function getPrompt(type, action, params = {}) {
  const assessmentType = assessmentPrompts[type] || assessmentPrompts.bigFive;

  return {
    system: assessmentType.system,
    user: assessmentType[action] ? assessmentType[action](params) : ''
  };
}

/**
 * Ottiene template di opzioni standard per tipo
 * @param {string} type - Tipo di scala
 * @returns {Array} Array di opzioni
 */
function getStandardOptions(type) {
  const optionSets = {
    likert5: [
      { text: "Strongly Disagree", value: 1 },
      { text: "Disagree", value: 2 },
      { text: "Neutral", value: 3 },
      { text: "Agree", value: 4 },
      { text: "Strongly Agree", value: 5 }
    ],
    likert5_it: [
      { text: "Fortemente in disaccordo", value: 1 },
      { text: "In disaccordo", value: 2 },
      { text: "Neutrale", value: 3 },
      { text: "D'accordo", value: 4 },
      { text: "Fortemente d'accordo", value: 5 }
    ],
    frequency: [
      { text: "Never", value: 1 },
      { text: "Rarely", value: 2 },
      { text: "Sometimes", value: 3 },
      { text: "Often", value: 4 },
      { text: "Always", value: 5 }
    ],
    frequency_it: [
      { text: "Mai", value: 1 },
      { text: "Raramente", value: 2 },
      { text: "A volte", value: 3 },
      { text: "Spesso", value: 4 },
      { text: "Sempre", value: 5 }
    ]
  };

  return optionSets[type] || optionSets.likert5;
}

/**
 * Get assessment prompt for a specific type
 * Compatibility layer for old config/assessmentPrompts.js interface
 * @param {string} type - Assessment type (big-five, disc, belbin, etc.)
 * @param {string} customization - Custom text to add to prompt
 * @param {number} count - Number of questions
 * @param {array} roleSoftSkills - Array of role soft skills
 * @returns {string} Generated prompt
 */
function getAssessmentPrompt(type, customization = '', count = null, roleSoftSkills = null) {
  // Build params object for new interface
  const params = {
    customization,
    count,
    roleSoftSkills,
    language: 'it' // Default to Italian
  };

  // Map type formats (big-five -> bigFive)
  const typeMap = {
    'big-five': 'bigFive',
    'disc': 'disc',
    'belbin': 'belbin'
  };

  const mappedType = typeMap[type] || type;
  const assessmentConfig = assessmentPrompts[mappedType];

  if (!assessmentConfig) {
    throw new Error(`Unknown assessment type: ${type}`);
  }

  // If the assessment has a generateQuestions function, use it
  if (typeof assessmentConfig.generateQuestions === 'function') {
    return assessmentConfig.generateQuestions(params);
  }

  // Fallback for assessments without generateQuestions
  return assessmentConfig.basePrompt || '';
}

/**
 * Get assessment configuration
 * @param {string} type - Assessment type
 * @returns {object} Assessment configuration
 */
function getAssessmentConfig(type) {
  const typeMap = {
    'big-five': 'bigFive',
    'disc': 'disc',
    'belbin': 'belbin'
  };

  const mappedType = typeMap[type] || type;
  const config = assessmentPrompts[mappedType];

  if (!config) {
    return null;
  }

  // Return config in expected format
  return {
    name: config.name || mappedType,
    defaultCount: 20,  // Default values since not in new structure
    minCount: 10,
    maxCount: 50,
    categories: []
  };
}

/**
 * Get all available assessment types
 * @returns {array} List of assessment types
 */
function getAssessmentTypes() {
  const types = ['bigFive', 'disc', 'belbin'];
  return types.map(key => {
    const config = assessmentPrompts[key];
    return {
      id: key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''), // Convert camelCase to kebab-case
      name: config.name || key,
      defaultCount: 20,
      minCount: 10,
      maxCount: 50,
      categories: []
    };
  });
}

module.exports = {
  assessmentPrompts,
  getPrompt,
  getStandardOptions,
  // Add compatibility functions for old interface
  getAssessmentPrompt,
  getAssessmentConfig,
  getAssessmentTypes
};