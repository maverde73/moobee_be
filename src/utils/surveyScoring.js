/**
 * Survey Scoring and Report Generation
 * @module utils/surveyScoring
 * @created 2025-09-30
 */

/**
 * Calculate module scores from responses
 */
function calculateModuleScores(responses) {
  const moduleResponses = {};

  // Group responses by module
  responses.forEach(response => {
    const moduleId = response.moduleId;
    if (!moduleResponses[moduleId]) {
      moduleResponses[moduleId] = [];
    }
    moduleResponses[moduleId].push(response);
  });

  // Calculate scores for each module
  const moduleScores = [];

  for (const [moduleId, moduleResp] of Object.entries(moduleResponses)) {
    const scores = moduleResp.map(r => {
      // Normalize score to 0-1 range
      let value = r.value;

      // Handle different response types
      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      } else if (r.scale === 'Likert5') {
        value = (value - 1) / 4; // Convert 1-5 to 0-1
      } else if (r.scale === 'Likert7') {
        value = (value - 1) / 6; // Convert 1-7 to 0-1
      }

      // Apply reverse scoring if needed
      if (r.reverse) {
        value = 1 - value;
      }

      return value;
    });

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    moduleScores.push({
      moduleId,
      score: avgScore,
      label: getModuleLabel(moduleId),
      risk: getRiskLevel(avgScore)
    });
  }

  return moduleScores;
}

/**
 * Generate comprehensive report
 */
function generateReport(surveyId, moduleScores, responses) {
  // Calculate overall score
  const overallScore = moduleScores.reduce((sum, m) => sum + m.score, 0) / moduleScores.length;

  // Identify strengths and critical areas
  const strengths = [];
  const criticalAreas = [];
  const suggestions = [];

  moduleScores.forEach(moduleScore => {
    if (moduleScore.score >= 0.7) {
      strengths.push(getStrengthMessage(moduleScore));
    } else if (moduleScore.score < 0.4) {
      criticalAreas.push(getCriticalAreaMessage(moduleScore));
      suggestions.push(...generateSuggestions(moduleScore));
    }
  });

  return {
    surveyId,
    moduleScores,
    overallScore,
    strengths,
    criticalAreas,
    suggestions
  };
}

/**
 * Generate suggestions for low-scoring modules
 */
function generateSuggestions(moduleScore) {
  const suggestions = [];
  const moduleId = moduleScore.moduleId;

  const suggestionMap = {
    motivation: [
      {
        priority: 'high',
        suggestion: 'Organizza sessioni di riconoscimento mensili per celebrare i successi del team',
        timeframe: '1 settimana'
      },
      {
        priority: 'medium',
        suggestion: 'Implementa un sistema di feedback continuo per aumentare il coinvolgimento',
        timeframe: '2 settimane'
      },
      {
        priority: 'medium',
        suggestion: 'Crea opportunità per progetti stimolanti e autonomi',
        timeframe: '1 mese'
      }
    ],
    communication: [
      {
        priority: 'high',
        suggestion: 'Istituisci meeting settimanali di allineamento con agenda chiara',
        timeframe: '1 settimana'
      },
      {
        priority: 'high',
        suggestion: 'Crea canali di comunicazione dedicati per diversi tipi di informazioni',
        timeframe: '2 settimane'
      },
      {
        priority: 'medium',
        suggestion: 'Implementa una policy di "porte aperte" per favorire il dialogo',
        timeframe: '2 settimane'
      }
    ],
    leadership: [
      {
        priority: 'high',
        suggestion: 'Organizza sessioni 1-1 regolari tra manager e collaboratori',
        timeframe: '1 settimana'
      },
      {
        priority: 'high',
        suggestion: 'Forma i leader su coaching e feedback costruttivo',
        timeframe: '1 mese'
      },
      {
        priority: 'medium',
        suggestion: 'Implementa un sistema di obiettivi chiari e misurabili (OKR)',
        timeframe: '1 mese'
      }
    ],
    wellbeing: [
      {
        priority: 'high',
        suggestion: 'Introduce politiche di flessibilità oraria e smart working',
        timeframe: '2 settimane'
      },
      {
        priority: 'high',
        suggestion: 'Rivedi i carichi di lavoro e ridistribuisci le attività',
        timeframe: '1 settimana'
      },
      {
        priority: 'medium',
        suggestion: 'Offri programmi di supporto per la gestione dello stress',
        timeframe: '1 mese'
      }
    ],
    belonging_psychsafe: [
      {
        priority: 'high',
        suggestion: 'Organizza workshop sulla sicurezza psicologica e fiducia nel team',
        timeframe: '2 settimane'
      },
      {
        priority: 'high',
        suggestion: 'Crea spazi sicuri per condividere errori e apprendimenti',
        timeframe: '1 settimana'
      },
      {
        priority: 'medium',
        suggestion: 'Implementa team building activities per rafforzare i legami',
        timeframe: '1 mese'
      }
    ],
    growth_recognition: [
      {
        priority: 'high',
        suggestion: 'Crea piani di sviluppo individuali con percorsi di crescita chiari',
        timeframe: '2 settimane'
      },
      {
        priority: 'high',
        suggestion: 'Implementa un sistema di riconoscimento peer-to-peer',
        timeframe: '1 settimana'
      },
      {
        priority: 'medium',
        suggestion: 'Offri budget per formazione e certificazioni professionali',
        timeframe: '1 mese'
      }
    ],
    motivation_fit: [
      {
        priority: 'high',
        suggestion: 'Conduci assessment delle competenze e ridefinisci i ruoli',
        timeframe: '1 mese'
      },
      {
        priority: 'high',
        suggestion: 'Organizza sessioni per allineare valori aziendali e personali',
        timeframe: '2 settimane'
      },
      {
        priority: 'medium',
        suggestion: 'Crea percorsi di carriera personalizzati basati su aspirazioni',
        timeframe: '1 mese'
      }
    ]
  };

  const moduleSuggestions = suggestionMap[moduleId] || [];

  // Return top 3 suggestions with module context
  return moduleSuggestions.slice(0, 3).map(s => ({
    ...s,
    moduleId
  }));
}

/**
 * Get module label
 */
function getModuleLabel(moduleId) {
  const labels = {
    motivation: 'Motivazione',
    communication: 'Comunicazione',
    leadership: 'Leadership',
    wellbeing: 'Benessere',
    belonging_psychsafe: 'Appartenenza e Sicurezza Psicologica',
    growth_recognition: 'Crescita e Riconoscimento',
    motivation_fit: 'Motivazione e Fit Organizzativo'
  };
  return labels[moduleId] || moduleId;
}

/**
 * Get risk level based on score
 */
function getRiskLevel(score) {
  if (score >= 0.7) return 'low';
  if (score >= 0.4) return 'medium';
  return 'high';
}

/**
 * Generate strength message
 */
function getStrengthMessage(moduleScore) {
  return `${moduleScore.label}: Eccellente performance (${Math.round(moduleScore.score * 100)}%)`;
}

/**
 * Generate critical area message
 */
function getCriticalAreaMessage(moduleScore) {
  return `${moduleScore.label}: Richiede attenzione immediata (${Math.round(moduleScore.score * 100)}%)`;
}

module.exports = {
  calculateModuleScores,
  generateReport
};