/**
 * Mock Data Module
 * Fornisce dati di fallback per testing e quando AI non è disponibile
 * @module services/ai/mockData
 */

/**
 * Gestore dati mock per testing
 * @class MockDataProvider
 */
class MockDataProvider {
  /**
   * Ottiene domande di fallback per un tipo di assessment
   * @param {string} type - Tipo di assessment
   * @param {number} count - Numero di domande richieste
   * @returns {Array} Array di domande mock
   */
  getFallbackQuestions(type, count = 10) {
    console.warn(`⚠️ Generated ${count} FALLBACK questions for ${type} assessment - AI not available`);

    const templates = this.getQuestionTemplates(type);
    const questions = [];

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      questions.push(this.createQuestion(template, i + 1));
    }

    return questions;
  }

  /**
   * Crea una singola domanda dal template
   * @private
   * @param {Object} template - Template della domanda
   * @param {number} index - Indice della domanda
   * @returns {Object} Domanda formattata
   */
  createQuestion(template, index) {
    return {
      id: `mock_${Date.now()}_${index}`,
      text: template.text,
      category: template.category,
      type: template.type || 'multiple_choice',
      isRequired: true,
      options: this.getOptionsForType(template.category),
      metadata: {
        isMock: true,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Ottiene template di domande per tipo
   * @private
   * @param {string} type - Tipo di assessment
   * @returns {Array} Array di template
   */
  getQuestionTemplates(type) {
    const templates = {
      'big-five': [
        { text: "Mi sento a mio agio in situazioni sociali", category: "Estroversione" },
        { text: "Tendo a fidarmi degli altri", category: "Amicalità" },
        { text: "Mantengo la calma sotto pressione", category: "Stabilità emotiva" },
        { text: "Sono preciso e attento ai dettagli", category: "Coscienziosità" },
        { text: "Mi piace esplorare nuove idee", category: "Apertura mentale" },
        { text: "Preferisco lavorare in gruppo", category: "Estroversione" },
        { text: "Aiuto gli altri quando possibile", category: "Amicalità" },
        { text: "Gestisco bene lo stress", category: "Stabilità emotiva" },
        { text: "Pianifico le mie attività in anticipo", category: "Coscienziosità" },
        { text: "Sono creativo e innovativo", category: "Apertura mentale" }
      ],
      'disc': [
        { text: "Prendo decisioni rapidamente", category: "Dominanza" },
        { text: "Mi piace motivare gli altri", category: "Influenza" },
        { text: "Preferisco ambienti stabili", category: "Stabilità" },
        { text: "Seguo le regole e le procedure", category: "Coscienziosità" },
        { text: "Affronto direttamente i problemi", category: "Dominanza" },
        { text: "Costruisco facilmente relazioni", category: "Influenza" },
        { text: "Sono paziente e costante", category: "Stabilità" },
        { text: "Analizzo i dettagli accuratamente", category: "Coscienziosità" }
      ],
      'belbin': [
        { text: "Genero idee creative per il team", category: "Plant" },
        { text: "Valuto obiettivamente le opzioni", category: "Monitor Valutatore" },
        { text: "Coordino efficacemente il lavoro del team", category: "Coordinatore" },
        { text: "Trovo risorse e contatti utili", category: "Risolutore di risorse" },
        { text: "Trasformo le idee in azioni concrete", category: "Implementatore" },
        { text: "Completo i task con attenzione ai dettagli", category: "Completer Finisher" },
        { text: "Supporto e aiuto i membri del team", category: "Teamworker" },
        { text: "Spingo il team verso gli obiettivi", category: "Shaper" },
        { text: "Fornisco expertise tecnica specializzata", category: "Specialista" }
      ],
    };

    return templates[type] || templates['big-five'];
  }

  /**
   * Ottiene opzioni per una categoria
   * @private
   * @param {string} category - Categoria della domanda
   * @returns {Array} Array di opzioni
   */
  getOptionsForType(category) {
    // Opzioni Likert standard in italiano
    return [
      { text: "Fortemente in disaccordo", value: 1, isCorrect: false },
      { text: "In disaccordo", value: 2, isCorrect: false },
      { text: "Né d'accordo né in disaccordo", value: 3, isCorrect: false },
      { text: "D'accordo", value: 4, isCorrect: false },
      { text: "Fortemente d'accordo", value: 5, isCorrect: false }
    ];
  }

  /**
   * Genera una risposta mock per testing
   * @param {string} prompt - Prompt per cui generare risposta
   * @returns {string} Risposta mock in formato JSON
   */
  getMockAIResponse(prompt) {
    console.log('🤖 Using MOCK AI response for testing');

    // Estrai informazioni dal prompt
    const numberMatch = prompt.match(/Generate (\d+)/i) || prompt.match(/(\d+) questions/i);
    const count = numberMatch ? parseInt(numberMatch[1]) : 10;

    const typeMatch = prompt.match(/(big.?five|disc|belbin)/i);
    const type = typeMatch ? typeMatch[1].toLowerCase().replace('-', '_') : 'big_five';

    // Genera domande mock
    const questions = this.getFallbackQuestions(type, count);

    // Ritorna come JSON string per simulare risposta AI
    return JSON.stringify(questions, null, 2);
  }

  /**
   * Genera un report mock
   * @param {string} type - Tipo di assessment
   * @param {Array} responses - Risposte dell'utente
   * @returns {Object} Report mock
   */
  getMockReport(type, responses) {
    return {
      type,
      responseCount: responses.length,
      overallScore: Math.floor(Math.random() * 40) + 60,
      categories: this.getMockCategoryScores(type),
      strengths: [
        "Buona capacità di problem solving",
        "Attitudine al lavoro in team",
        "Orientamento ai risultati"
      ],
      areasForImprovement: [
        "Gestione del tempo",
        "Comunicazione assertiva",
        "Pianificazione strategica"
      ],
      recommendations: [
        "Partecipare a workshop sulla gestione del tempo",
        "Praticare tecniche di comunicazione assertiva",
        "Sviluppare competenze di project management"
      ],
      generatedAt: new Date().toISOString(),
      isMock: true
    };
  }

  /**
   * Genera punteggi mock per categorie
   * @private
   * @param {string} type - Tipo di assessment
   * @returns {Object} Punteggi per categoria
   */
  getMockCategoryScores(type) {
    const categories = {
      'big-five': {
        'Estroversione': Math.floor(Math.random() * 30) + 70,
        'Amicalità': Math.floor(Math.random() * 30) + 70,
        'Stabilità emotiva': Math.floor(Math.random() * 30) + 70,
        'Coscienziosità': Math.floor(Math.random() * 30) + 70,
        'Apertura mentale': Math.floor(Math.random() * 30) + 70
      },
      'disc': {
        'Dominanza': Math.floor(Math.random() * 40) + 60,
        'Influenza': Math.floor(Math.random() * 40) + 60,
        'Stabilità': Math.floor(Math.random() * 40) + 60,
        'Coscienziosità': Math.floor(Math.random() * 40) + 60
      },
      'belbin': {
        'Plant': Math.floor(Math.random() * 100),
        'Monitor Valutatore': Math.floor(Math.random() * 100),
        'Coordinatore': Math.floor(Math.random() * 100),
        'Risolutore di risorse': Math.floor(Math.random() * 100),
        'Implementatore': Math.floor(Math.random() * 100),
        'Completer Finisher': Math.floor(Math.random() * 100),
        'Teamworker': Math.floor(Math.random() * 100),
        'Shaper': Math.floor(Math.random() * 100),
        'Specialista': Math.floor(Math.random() * 100)
      },
    };

    return categories[type] || categories['big-five'];
  }
}

module.exports = MockDataProvider;