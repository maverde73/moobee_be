/**
 * Prompt Builder Module
 * Costruisce prompt ottimizzati per diversi tipi di assessment
 * @module services/ai/promptBuilder
 */

/**
 * Costruttore di prompt per AI
 * @class PromptBuilder
 */
class PromptBuilder {
  /**
   * Costruisce prompt per generazione domande
   * @param {string} type - Tipo di assessment
   * @param {Object} options - Opzioni per il prompt
   * @returns {string} Prompt completo
   */
  buildPrompt(type, options = {}) {
    const {
      count = 10,
      language = 'it',
      context = '',
      suggestedRoles = [],
      description = ''
    } = options;

    const basePrompt = this.getBasePrompt(type, language);
    const contextSection = this.buildContextSection(context, description, suggestedRoles);
    const requirementsSection = this.buildRequirementsSection(type, count, language);

    return `${basePrompt}\n\n${contextSection}\n\n${requirementsSection}`;
  }

  /**
   * Ottiene prompt base per tipo
   * @private
   * @param {string} type - Tipo di assessment
   * @param {string} language - Lingua
   * @returns {string} Prompt base
   */
  getBasePrompt(type, language) {
    const prompts = {
      'big-five': {
        it: 'Genera domande per un assessment Big Five della personalità professionale.',
        en: 'Generate questions for a Big Five personality assessment in professional context.'
      },
      'disc': {
        it: 'Genera domande per un assessment DISC comportamentale.',
        en: 'Generate questions for a DISC behavioral assessment.'
      },
      'belbin': {
        it: 'Genera domande per identificare i ruoli di team secondo Belbin.',
        en: 'Generate questions to identify Belbin team roles.'
      }
    };

    return prompts[type]?.[language] || prompts['big-five'][language];
  }

  /**
   * Costruisce sezione contesto
   * @private
   */
  buildContextSection(context, description, suggestedRoles) {
    let section = 'CONTESTO:';

    if (description) {
      section += `\n- Descrizione: ${description}`;
    }

    if (context) {
      section += `\n- Contesto specifico: ${context}`;
    }

    if (suggestedRoles && suggestedRoles.length > 0) {
      section += `\n- Ruoli target: ${suggestedRoles.join(', ')}`;
    }

    return section;
  }

  /**
   * Costruisce sezione requisiti
   * @private
   */
  buildRequirementsSection(type, count, language) {
    const requirements = [
      `Generate exactly ${count} questions`,
      `Language: ${language === 'it' ? 'Italian' : 'English'}`,
      'Format: Multiple choice with 5 options each',
      'Include variety in question categories',
      'Ensure professional context'
    ];

    return 'REQUISITI:\n' + requirements.map(r => `- ${r}`).join('\n');
  }

  /**
   * Ottiene istruzioni JSON
   * @param {string} type - Tipo di assessment
   * @param {string} language - Lingua
   * @returns {string} Istruzioni per formato JSON
   */
  getJSONInstructions(type, language) {
    const scaleInstructions = this.getScaleInstructions(type, language);

    return `

IMPORTANT: Format the response as a valid JSON array with exactly this structure:
[
  {
    "text": "Question text here",
    "category": "Category name",
    "type": "multiple_choice",
    "isRequired": true,
    "options": ${scaleInstructions}
  }
]

CRITICAL RULES:
1. Each option MUST have a "value" from 1 to 5 for scoring
2. Value 1 = lowest agreement/frequency, Value 5 = highest agreement/frequency
3. For personality assessments, use Likert scale
4. The "value" field is REQUIRED for calculating scores

Return ONLY the JSON array, no additional text or explanations.`;
  }

  /**
   * Ottiene istruzioni scala per tipo
   * @private
   */
  getScaleInstructions(type, language) {
    const scales = {
      'big-five': {
        it: `[
      {"text": "Fortemente in disaccordo", "value": 1, "isCorrect": false},
      {"text": "In disaccordo", "value": 2, "isCorrect": false},
      {"text": "Neutrale", "value": 3, "isCorrect": false},
      {"text": "D'accordo", "value": 4, "isCorrect": false},
      {"text": "Fortemente d'accordo", "value": 5, "isCorrect": false}
    ]`,
        en: `[
      {"text": "Strongly Disagree", "value": 1, "isCorrect": false},
      {"text": "Disagree", "value": 2, "isCorrect": false},
      {"text": "Neutral", "value": 3, "isCorrect": false},
      {"text": "Agree", "value": 4, "isCorrect": false},
      {"text": "Strongly Agree", "value": 5, "isCorrect": false}
    ]`,
        es: `[
      {"text": "Totalmente en desacuerdo", "value": 1, "isCorrect": false},
      {"text": "En desacuerdo", "value": 2, "isCorrect": false},
      {"text": "Neutral", "value": 3, "isCorrect": false},
      {"text": "De acuerdo", "value": 4, "isCorrect": false},
      {"text": "Totalmente de acuerdo", "value": 5, "isCorrect": false}
    ]`,
        fr: `[
      {"text": "Tout à fait en désaccord", "value": 1, "isCorrect": false},
      {"text": "En désaccord", "value": 2, "isCorrect": false},
      {"text": "Neutre", "value": 3, "isCorrect": false},
      {"text": "D'accord", "value": 4, "isCorrect": false},
      {"text": "Tout à fait d'accord", "value": 5, "isCorrect": false}
    ]`,
        de: `[
      {"text": "Stimme überhaupt nicht zu", "value": 1, "isCorrect": false},
      {"text": "Stimme nicht zu", "value": 2, "isCorrect": false},
      {"text": "Neutral", "value": 3, "isCorrect": false},
      {"text": "Stimme zu", "value": 4, "isCorrect": false},
      {"text": "Stimme voll und ganz zu", "value": 5, "isCorrect": false}
    ]`
      },
      'disc': {
        it: `[
      {"text": "Fortemente in disaccordo", "value": 1, "isCorrect": false},
      {"text": "In disaccordo", "value": 2, "isCorrect": false},
      {"text": "Neutrale", "value": 3, "isCorrect": false},
      {"text": "D'accordo", "value": 4, "isCorrect": false},
      {"text": "Fortemente d'accordo", "value": 5, "isCorrect": false}
    ]`,
        en: `[
      {"text": "Strongly Disagree", "value": 1, "isCorrect": false},
      {"text": "Disagree", "value": 2, "isCorrect": false},
      {"text": "Neutral", "value": 3, "isCorrect": false},
      {"text": "Agree", "value": 4, "isCorrect": false},
      {"text": "Strongly Agree", "value": 5, "isCorrect": false}
    ]`,
        es: `[
      {"text": "Totalmente en desacuerdo", "value": 1, "isCorrect": false},
      {"text": "En desacuerdo", "value": 2, "isCorrect": false},
      {"text": "Neutral", "value": 3, "isCorrect": false},
      {"text": "De acuerdo", "value": 4, "isCorrect": false},
      {"text": "Totalmente de acuerdo", "value": 5, "isCorrect": false}
    ]`,
        fr: `[
      {"text": "Tout à fait en désaccord", "value": 1, "isCorrect": false},
      {"text": "En désaccord", "value": 2, "isCorrect": false},
      {"text": "Neutre", "value": 3, "isCorrect": false},
      {"text": "D'accord", "value": 4, "isCorrect": false},
      {"text": "Tout à fait d'accord", "value": 5, "isCorrect": false}
    ]`,
        de: `[
      {"text": "Stimme überhaupt nicht zu", "value": 1, "isCorrect": false},
      {"text": "Stimme nicht zu", "value": 2, "isCorrect": false},
      {"text": "Neutral", "value": 3, "isCorrect": false},
      {"text": "Stimme zu", "value": 4, "isCorrect": false},
      {"text": "Stimme voll und ganz zu", "value": 5, "isCorrect": false}
    ]`
      }
    };

    // Default scale
    const defaultScale = scales['big-five'];
    const selectedScale = scales[type] || defaultScale;

    return selectedScale[language] || selectedScale['it'];
  }

  /**
   * Ottiene system prompt per tipo
   * @param {string} type - Tipo di assessment
   * @returns {string} System prompt
   */
  getSystemPrompt(type) {
    const prompts = {
      'big-five': 'You are an expert psychometrician specializing in Big Five personality assessments.',
      'disc': 'You are an expert in DISC behavioral assessments and workplace dynamics.',
      'belbin': 'You are an expert in Belbin team roles and team dynamics.'
    };

    return prompts[type] || prompts['big-five'];
  }

  /**
   * Costruisce prompt per valutazione
   * @param {Array} responses - Risposte da valutare
   * @param {string} type - Tipo di assessment
   * @returns {string} Prompt di valutazione
   */
  buildEvaluationPrompt(responses, type) {
    const responsesSummary = this.summarizeResponses(responses);

    return `
Analyze these assessment responses and provide a detailed evaluation:

Assessment Type: ${type}
Number of Responses: ${responses.length}

RESPONSES:
${responsesSummary}

PROVIDE:
1. Overall score (0-100)
2. Category scores
3. Key strengths (3-5 points)
4. Areas for improvement (3-5 points)
5. Specific recommendations

Format as JSON with structure:
{
  "overallScore": number,
  "categories": { "category": score },
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;
  }

  /**
   * Riassume risposte per valutazione
   * @private
   */
  summarizeResponses(responses) {
    return responses.slice(0, 50) // Limit to first 50 for token efficiency
      .map((r, i) => `Q${i + 1} (${r.category}): Response value = ${r.value}`)
      .join('\n');
  }

  /**
   * Costruisce prompt per report
   * @param {Object} evaluation - Valutazione
   * @param {string} type - Tipo di assessment
   * @returns {string} Prompt per report
   */
  buildReportPrompt(evaluation, type) {
    return `
Create a professional assessment report based on this evaluation:

Assessment Type: ${type}
Overall Score: ${evaluation.overallScore}/100

Category Scores:
${Object.entries(evaluation.categories || {})
  .map(([cat, score]) => `- ${cat}: ${score}/100`)
  .join('\n')}

Strengths:
${(evaluation.strengths || []).map(s => `- ${s}`).join('\n')}

Areas for Improvement:
${(evaluation.improvements || []).map(i => `- ${i}`).join('\n')}

Create a professional report in markdown format including:
1. Executive Summary
2. Detailed Analysis by Category
3. Strengths Analysis
4. Development Opportunities
5. Actionable Recommendations
6. Next Steps

Use professional language, be constructive, and focus on development opportunities.`;
  }

  /**
   * Costruisce prompt per miglioramento domande
   * @param {Array} questions - Domande da migliorare
   * @param {string} type - Tipo di assessment
   * @returns {string} Prompt per suggerimenti
   */
  buildImprovementPrompt(questions, type) {
    const questionsSample = questions.slice(0, 10)
      .map((q, i) => `${i + 1}. ${q.text}`)
      .join('\n');

    return `
Review these assessment questions and suggest improvements:

Assessment Type: ${type}
Sample Questions:
${questionsSample}

Provide specific suggestions to:
1. Improve clarity and readability
2. Ensure cultural sensitivity
3. Reduce bias
4. Enhance validity
5. Improve reliability

Format suggestions as actionable recommendations.`;
  }
}

module.exports = PromptBuilder;