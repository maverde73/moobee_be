/**
 * AI Response Parser Module
 * Gestisce il parsing e validazione delle risposte AI
 * @module services/ai/responseParser
 */

/**
 * Parser per le risposte AI
 * @class ResponseParser
 */
class ResponseParser {
  constructor() {
    // Store language for default options
    this.currentLanguage = 'it';
  }

  /**
   * Set the language for default options
   * @param {string} language - Language code (it, en, es, fr, de)
   */
  setLanguage(language) {
    this.currentLanguage = language || 'it';
  }
  /**
   * Parsa la risposta AI per estrarre le domande
   * @param {string} response - Risposta AI grezza
   * @param {string} type - Tipo di assessment
   * @returns {Array} Array di domande parsate
   * @throws {Error} Se il parsing fallisce
   */
  parseQuestionsResponse(response, type = 'big_five') {
    try {
      // Log per debug
      console.log('AI Response length:', response?.length || 0);
      console.log('AI Response (first 1000 chars):', response?.substring(0, 1000));

      // Validazione input
      if (!response || typeof response !== 'string') {
        console.error('Empty or undefined response from AI');
        throw new Error('Empty response from AI');
      }

      let questions = [];

      // Tentativo 1: Parse JSON diretto
      try {
        questions = JSON.parse(response);
        console.log(`Direct parse successful, got ${questions.length} questions`);
      } catch (jsonError) {
        // Tentativo 2: Estrazione JSON da testo
        questions = this.extractJSONFromText(response);
      }

      // Validazione domande
      questions = this.validateQuestions(questions, type);

      console.log(`Successfully parsed ${questions.length} questions`);
      return questions;

    } catch (error) {
      console.error('Error parsing questions response:', error);
      console.error('Response that failed to parse:', response?.substring(0, 500));
      throw error;
    }
  }

  /**
   * Estrae JSON da testo contenente markup o altro contenuto
   * @private
   * @param {string} text - Testo contenente JSON
   * @returns {Array} Array parsato
   * @throws {Error} Se non riesce a trovare JSON valido
   */
  extractJSONFromText(text) {
    console.log('Attempting to extract JSON from text response');

    // Patterns per trovare array JSON
    const patterns = [
      /\[[\s\S]*\]/,  // Trova array completo
      /```json\s*([\s\S]*?)```/,  // JSON in code block
      /```\s*([\s\S]*?)```/,  // Generic code block
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const jsonStr = match[1] || match[0];
          const cleaned = this.cleanJSONString(jsonStr);
          const parsed = JSON.parse(cleaned);
          console.log(`Extracted ${parsed.length} questions using pattern`);
          return parsed;
        } catch (e) {
          continue;
        }
      }
    }

    // Ultimo tentativo: rimuovi tutto prima del primo [ e dopo l'ultimo ]
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        const jsonStr = text.substring(startIdx, endIdx + 1);
        const cleaned = this.cleanJSONString(jsonStr);
        const parsed = JSON.parse(cleaned);
        console.log(`Extracted ${parsed.length} questions from substring`);
        return parsed;
      } catch (e) {
        console.error('Final extraction attempt failed:', e);
      }
    }

    throw new Error('Could not extract valid JSON from response');
  }

  /**
   * Pulisce una stringa JSON rimuovendo caratteri problematici
   * @private
   * @param {string} str - Stringa JSON da pulire
   * @returns {string} Stringa pulita
   */
  cleanJSONString(str) {
    return str
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Rimuovi caratteri di controllo
      .replace(/,\s*\]/g, ']') // Rimuovi virgole finali in array
      .replace(/,\s*\}/g, '}') // Rimuovi virgole finali in oggetti
      .trim();
  }

  /**
   * Valida e normalizza le domande parsate
   * @private
   * @param {Array} questions - Domande da validare
   * @param {string} type - Tipo di assessment
   * @returns {Array} Domande validate
   */
  validateQuestions(questions, type) {
    if (!Array.isArray(questions)) {
      throw new Error('Parsed response is not an array');
    }

    if (questions.length === 0) {
      throw new Error('No questions found in response');
    }

    // Valida e normalizza ogni domanda
    return questions.map((q, index) => {
      if (!q.text || typeof q.text !== 'string') {
        console.warn(`Question ${index + 1} missing text field`);
        q.text = `Question ${index + 1}`;
      }

      // Assicura che ci sia una categoria
      if (!q.category) {
        q.category = this.getDefaultCategory(type);
      }

      // Assicura che ci sia un tipo
      if (!q.type) {
        q.type = 'multiple_choice';
      }

      // Valida opzioni per multiple choice
      if (q.type === 'multiple_choice') {
        q.options = this.validateOptions(q.options);
      }

      // Aggiungi campi mancanti
      q.isRequired = q.isRequired !== false;

      return q;
    });
  }

  /**
   * Valida le opzioni di una domanda
   * @private
   * @param {Array} options - Opzioni da validare
   * @returns {Array} Opzioni validate
   */
  validateOptions(options) {
    if (!Array.isArray(options) || options.length === 0) {
      // Genera opzioni di default
      return this.generateDefaultOptions();
    }

    return options.map((opt, index) => {
      if (typeof opt === 'string') {
        return {
          text: opt,
          value: index + 1,
          isCorrect: false
        };
      }

      // Assicura che ogni opzione abbia i campi necessari
      return {
        text: opt.text || `Option ${index + 1}`,
        value: opt.value !== undefined ? opt.value : index + 1,
        isCorrect: opt.isCorrect || false
      };
    });
  }

  /**
   * Genera opzioni di default per una domanda
   * @private
   * @returns {Array} Opzioni di default
   */
  generateDefaultOptions() {
    const optionsByLanguage = {
      it: [
        { text: "Fortemente in disaccordo", value: 1, isCorrect: false },
        { text: "In disaccordo", value: 2, isCorrect: false },
        { text: "Neutrale", value: 3, isCorrect: false },
        { text: "D'accordo", value: 4, isCorrect: false },
        { text: "Fortemente d'accordo", value: 5, isCorrect: false }
      ],
      en: [
        { text: "Strongly Disagree", value: 1, isCorrect: false },
        { text: "Disagree", value: 2, isCorrect: false },
        { text: "Neutral", value: 3, isCorrect: false },
        { text: "Agree", value: 4, isCorrect: false },
        { text: "Strongly Agree", value: 5, isCorrect: false }
      ],
      es: [
        { text: "Totalmente en desacuerdo", value: 1, isCorrect: false },
        { text: "En desacuerdo", value: 2, isCorrect: false },
        { text: "Neutral", value: 3, isCorrect: false },
        { text: "De acuerdo", value: 4, isCorrect: false },
        { text: "Totalmente de acuerdo", value: 5, isCorrect: false }
      ],
      fr: [
        { text: "Tout à fait en désaccord", value: 1, isCorrect: false },
        { text: "En désaccord", value: 2, isCorrect: false },
        { text: "Neutre", value: 3, isCorrect: false },
        { text: "D'accord", value: 4, isCorrect: false },
        { text: "Tout à fait d'accord", value: 5, isCorrect: false }
      ],
      de: [
        { text: "Stimme überhaupt nicht zu", value: 1, isCorrect: false },
        { text: "Stimme nicht zu", value: 2, isCorrect: false },
        { text: "Neutral", value: 3, isCorrect: false },
        { text: "Stimme zu", value: 4, isCorrect: false },
        { text: "Stimme voll und ganz zu", value: 5, isCorrect: false }
      ]
    };

    return optionsByLanguage[this.currentLanguage] || optionsByLanguage.it;
  }

  /**
   * Ottiene la categoria di default per un tipo di assessment
   * @private
   * @param {string} type - Tipo di assessment
   * @returns {string} Categoria di default
   */
  getDefaultCategory(type) {
    const categoryMap = {
      'big-five': 'Personality',
      'disc': 'Behavioral',
      'belbin': 'Team Role'
    };
    return categoryMap[type] || 'General';
  }

  /**
   * Parsa una risposta di valutazione
   * @param {string} response - Risposta AI per valutazione
   * @returns {Object} Valutazione parsata
   */
  parseEvaluationResponse(response) {
    try {
      if (!response) {
        throw new Error('Empty evaluation response');
      }

      let evaluation = {};

      // Try direct JSON parse
      try {
        evaluation = JSON.parse(response);
      } catch {
        // Extract JSON from text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evaluation = JSON.parse(jsonMatch[0]);
        } else {
          // Parse text format
          evaluation = this.parseTextEvaluation(response);
        }
      }

      // Validate evaluation structure
      return this.validateEvaluation(evaluation);

    } catch (error) {
      console.error('Error parsing evaluation:', error);
      throw error;
    }
  }

  /**
   * Parsa una valutazione in formato testo
   * @private
   * @param {string} text - Testo da parsare
   * @returns {Object} Valutazione parsata
   */
  parseTextEvaluation(text) {
    const evaluation = {
      overallScore: 0,
      categories: {},
      strengths: [],
      improvements: [],
      recommendations: []
    };

    // Extract scores
    const scoreMatch = text.match(/score[:\s]+(\d+)/i);
    if (scoreMatch) {
      evaluation.overallScore = parseInt(scoreMatch[1]);
    }

    // Extract categories
    const categoryRegex = /(\w+):\s*(\d+)/g;
    let match;
    while ((match = categoryRegex.exec(text)) !== null) {
      evaluation.categories[match[1]] = parseInt(match[2]);
    }

    return evaluation;
  }

  /**
   * Valida una valutazione
   * @private
   * @param {Object} evaluation - Valutazione da validare
   * @returns {Object} Valutazione validata
   */
  validateEvaluation(evaluation) {
    // Ensure required fields
    evaluation.overallScore = evaluation.overallScore || 0;
    evaluation.categories = evaluation.categories || {};
    evaluation.strengths = evaluation.strengths || [];
    evaluation.improvements = evaluation.improvements || [];
    evaluation.recommendations = evaluation.recommendations || [];

    // Validate score ranges
    if (evaluation.overallScore < 0) evaluation.overallScore = 0;
    if (evaluation.overallScore > 100) evaluation.overallScore = 100;

    return evaluation;
  }
}

module.exports = ResponseParser;