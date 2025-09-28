/**
 * Engagement AI Controller
 * @module controllers/engagement/engagementAIController
 * @created 2025-09-22
 * @description AI-powered question generation for engagement templates
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');
const AIGenerationService = require('../../services/ai/AIGenerationService');

// Standard UWES questions
const UWES_QUESTIONS = [
  { code: 'UWES_01', text: 'Al mio lavoro, mi sento pieno di energia', area: 'MOTIVATION' },
  { code: 'UWES_02', text: 'Il mio lavoro mi ispira', area: 'MOTIVATION' },
  { code: 'UWES_03', text: 'Quando mi alzo la mattina, ho voglia di andare al lavoro', area: 'MOTIVATION' },
  { code: 'UWES_04', text: 'Sono felice quando lavoro intensamente', area: 'BELONGING' },
  { code: 'UWES_05', text: 'Sono orgoglioso del lavoro che faccio', area: 'BELONGING' },
  { code: 'UWES_06', text: 'Sono immerso nel mio lavoro', area: 'MOTIVATION' },
  { code: 'UWES_07', text: 'Mi sento forte e vigoroso al lavoro', area: 'MOTIVATION' },
  { code: 'UWES_08', text: 'Sono entusiasta del mio lavoro', area: 'MOTIVATION' },
  { code: 'UWES_09', text: 'Quando lavoro, il tempo vola', area: 'BELONGING' }
];

// Standard Gallup Q12 questions
const GALLUP_Q12_QUESTIONS = [
  { code: 'GQ12_01', text: 'So cosa ci si aspetta da me al lavoro', area: 'COMMUNICATION' },
  { code: 'GQ12_02', text: 'Ho i materiali e le attrezzature necessarie per fare bene il mio lavoro', area: 'LEADERSHIP' },
  { code: 'GQ12_03', text: 'Al lavoro, ho l\'opportunità di fare quello che so fare meglio ogni giorno', area: 'GROWTH' },
  { code: 'GQ12_04', text: 'Nell\'ultima settimana, ho ricevuto riconoscimenti o elogi per aver fatto un buon lavoro', area: 'LEADERSHIP' },
  { code: 'GQ12_05', text: 'Il mio supervisor o qualcuno al lavoro sembra interessarsi a me come persona', area: 'LEADERSHIP' },
  { code: 'GQ12_06', text: 'C\'è qualcuno al lavoro che incoraggia il mio sviluppo', area: 'GROWTH' },
  { code: 'GQ12_07', text: 'Al lavoro, le mie opinioni sembrano contare', area: 'COMMUNICATION' },
  { code: 'GQ12_08', text: 'La missione/scopo della mia azienda mi fa sentire che il mio lavoro è importante', area: 'BELONGING' },
  { code: 'GQ12_09', text: 'I miei colleghi sono impegnati a fare un lavoro di qualità', area: 'BELONGING' },
  { code: 'GQ12_10', text: 'Ho un migliore amico al lavoro', area: 'BELONGING' },
  { code: 'GQ12_11', text: 'Qualcuno al lavoro mi ha parlato dei miei progressi negli ultimi sei mesi', area: 'GROWTH' },
  { code: 'GQ12_12', text: 'Quest\'anno, ho avuto opportunità di apprendere e crescere al lavoro', area: 'GROWTH' }
];

/**
 * Generate engagement questions with AI
 * @route POST /api/engagement/ai/generate-questions
 */
const generateQuestions = async (req, res) => {
  try {
    const {
      type,
      roleId,
      roleName,
      numberOfQuestions = 10,
      areas = ['MOTIVATION', 'LEADERSHIP', 'COMMUNICATION', 'WORK_LIFE_BALANCE', 'BELONGING', 'GROWTH'],
      language = 'it',
      aiConfig = {}  // AI configuration with provider, model, temperature, maxTokens
    } = req.body;

    // SEMPRE generare con AI, includendo il tipo nel prompt
    // Il tipo (UWES, GALLUP_Q12, CUSTOM) viene passato all'AI per contesto
    const prompt = buildEngagementPrompt({
      type,
      roleName,
      roleData: req.body.roleData, // Soft skills e altri dati del ruolo
      numberOfQuestions,
      areas,
      language
    });

    // Debug log to see what we're receiving
    console.log('=== ENGAGEMENT AI GENERATION REQUEST ===');
    console.log('Type:', type);
    console.log('Role:', roleName);
    console.log('Number of questions:', numberOfQuestions);
    console.log('Areas:', areas);
    console.log('AI Config received:', aiConfig);
    console.log('Provider:', aiConfig.provider);
    console.log('Model:', aiConfig.model);
    console.log('Temperature:', aiConfig.temperature);
    console.log('Max Tokens:', aiConfig.maxTokens);

    // Log the complete prompt
    console.log('\n=== PROMPT THAT WILL BE SENT ===');
    console.log(prompt);
    console.log('=== END OF PROMPT ===\n');

    logger.info('Generating engagement questions with AI', {
      roleId,
      numberOfQuestions,
      provider: aiConfig.provider,
      model: aiConfig.model
    });

    // Use the AI configuration provided by the user
    // Check if it's GPT-5 to avoid sending unsupported parameters
    const isGPT5 = aiConfig.model && aiConfig.model.toLowerCase().includes('gpt-5');

    const aiParams = {
      prompt,
      provider: aiConfig.provider || 'openai',
      model: aiConfig.model || 'gpt-4'
    };

    // Only add temperature and maxTokens for non-GPT-5 models
    if (!isGPT5) {
      aiParams.maxTokens = aiConfig.maxTokens || 2000;
      aiParams.temperature = aiConfig.temperature || 0.7;
    }

    console.log('AI Params being sent:', aiParams);

    const aiResponse = await AIGenerationService.generateCompletion(aiParams);

    console.log('=== AI RESPONSE ===');
    console.log('Raw response:', aiResponse);
    console.log('Response length:', aiResponse?.length);
    console.log('Response type:', typeof aiResponse);

    const questions = parseAIResponse(aiResponse);

    console.log('=== PARSED QUESTIONS ===');
    console.log('Questions count:', questions.length);
    console.log('First question:', questions[0]);

    // Skip logging since tables don't exist yet
    // TODO: When engagement tables are created, log generation

    res.json({
      success: true,
      data: {
        questions,
        metadata: {
          source: 'AI Generated',
          provider: aiConfig.provider || 'openai',
          model: aiConfig.model || 'gpt-4',
          role: roleName,
          areas,
          type,
          promptUsed: prompt,  // Include the prompt that was used
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('=== AI GENERATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);

    logger.error('Error generating engagement questions', error);

    res.status(500).json({
      success: false,
      error: 'Failed to generate questions',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Build prompt for AI question generation
 */
function buildEngagementPrompt({ type, roleName, roleData, numberOfQuestions, areas, language }) {
  const areasText = areas.join(', ');

  // Costruisci il contesto basato sul tipo di engagement
  let typeContext = '';
  let modelDescription = '';
  if (type === 'UWES') {
    typeContext = `MODELLO UWES (Utrecht Work Engagement Scale)`;
    modelDescription = `Stai generando domande basate sul modello UWES che misura:
- VIGORE: energia e resilienza mentale nel lavoro
- DEDIZIONE: coinvolgimento, entusiasmo e orgoglio per il proprio lavoro
- ASSORBIMENTO: concentrazione totale e immersione felice nel lavoro

Le domande UWES tipiche includono affermazioni come:
- "Al mio lavoro, mi sento pieno di energia" (Vigore)
- "Il mio lavoro mi ispira" (Dedizione)
- "Quando lavoro, il tempo vola" (Assorbimento)`;
  } else if (type === 'GALLUP_Q12') {
    typeContext = `MODELLO GALLUP Q12`;
    modelDescription = `Stai generando domande basate sul modello Gallup Q12 che valuta 12 elementi chiave dell'engagement:
1. Chiarezza delle aspettative
2. Risorse e strumenti necessari
3. Opportunità di fare ciò che si sa fare meglio
4. Riconoscimento e apprezzamento
5. Interesse personale da parte del supervisore
6. Incoraggiamento allo sviluppo
7. Le opinioni contano
8. Missione/scopo dell'azienda
9. Qualità del lavoro dei colleghi
10. Amicizie sul lavoro
11. Feedback sui progressi
12. Opportunità di crescita e apprendimento

Le domande Gallup Q12 tipiche includono:
- "So cosa ci si aspetta da me al lavoro"
- "Ho i materiali e le attrezzature necessarie"
- "Nell'ultima settimana, ho ricevuto riconoscimenti"`;
  } else {
    typeContext = `MODELLO PERSONALIZZATO`;
    modelDescription = `Stai generando domande di engagement personalizzate che coprono vari aspetti del coinvolgimento lavorativo.`;
  }

  // Includi soft skills se disponibili
  const softSkillsContext = roleData?.softSkills ?
    `\nSoft skills rilevanti per questo ruolo: ${roleData.softSkills.join(', ')}` : '';

  const prompt = `TIPO DI ASSESSMENT: ${typeContext}

${modelDescription}

COMPITO: Genera ${numberOfQuestions} domande di engagement per il ruolo di "${roleName}".
${softSkillsContext}

REQUISITI SPECIFICI:
1. Lingua: ${language === 'it' ? 'ITALIANO' : 'INGLESE'}
2. Aree da coprire: ${areasText}
3. Scala: Likert 1-5 (1=Fortemente in disaccordo, 5=Fortemente d'accordo)
4. Le domande devono essere:
   - Specifiche per il ruolo ${roleName}
   - Basate sul modello ${type}
   - Mix di domande positive e investigative
   - Focalizzate su engagement, motivazione e soddisfazione
5. Se ${type === 'UWES' ? 'includi domande su vigore, dedizione e assorbimento' :
      type === 'GALLUP_Q12' ? 'copri le 12 dimensioni chiave di Gallup' :
      'bilancia tra motivazione, leadership, comunicazione e work-life balance'}

IMPORTANTE: Rispondi SOLO con un array JSON valido, senza altro testo.
Formato richiesto:
[
  {
    "code": "Q_01",
    "text": "Testo della domanda qui",
    "area": "MOTIVATION|LEADERSHIP|COMMUNICATION|WORK_LIFE_BALANCE|BELONGING|GROWTH",
    "type": "LIKERT",
    "scaleMin": 1,
    "scaleMax": 5,
    "weight": 1.0,
    "orderIndex": 0,
    "isRequired": true
  }
]`;

  return prompt;
}

/**
 * Parse AI response to extract questions
 */
function parseAIResponse(response) {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      return questions.map((q, index) => ({
        code: q.code || `CUSTOM_${String(index + 1).padStart(2, '0')}`,
        text: q.text,
        area: q.area || 'MOTIVATION',
        type: q.type || 'LIKERT',
        scaleMin: q.scaleMin || 1,
        scaleMax: q.scaleMax || 5,
        weight: q.weight || 1.0,
        orderIndex: q.orderIndex !== undefined ? q.orderIndex : index,
        isRequired: q.isRequired !== false
      }));
    }

    // Fallback: return empty array if parsing fails
    logger.warn('Failed to parse AI response, returning empty array');
    return [];
  } catch (error) {
    logger.error('Error parsing AI response', error);
    return [];
  }
}

/**
 * Get AI suggestions for improving engagement
 * @route POST /api/engagement/ai/suggestions
 */
const getAISuggestions = async (req, res) => {
  try {
    const {
      roleId,
      roleName,
      currentScore,
      targetScore,
      weakAreas
    } = req.body;

    const prompt = `As an HR expert, provide 5 specific action items to improve engagement for ${roleName} role.

Current engagement score: ${currentScore}%
Target score: ${targetScore}%
Areas needing improvement: ${weakAreas.join(', ')}

Provide actionable suggestions that are:
1. Specific to the ${roleName} role
2. Measurable and time-bound
3. Focused on the weak areas identified
4. Practical to implement

Format as a JSON array with structure:
[
  {
    "title": "Action title",
    "description": "Detailed description",
    "area": "TARGET_AREA",
    "timeframe": "X weeks/months",
    "expectedImpact": "HIGH|MEDIUM|LOW"
  }
]`;

    const aiResponse = await AIGenerationService.generateCompletion({
      prompt,
      maxTokens: 1500,
      temperature: 0.6
    });

    const suggestions = parseAISuggestionsResponse(aiResponse);

    res.json({
      success: true,
      data: {
        suggestions,
        metadata: {
          role: roleName,
          currentScore,
          targetScore,
          generatedAt: new Date()
        }
      }
    });
  } catch (error) {
    logger.error('Error generating AI suggestions', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggestions'
    });
  }
};

/**
 * Parse AI suggestions response
 */
function parseAISuggestionsResponse(response) {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    logger.error('Error parsing AI suggestions', error);
    return [];
  }
}

/**
 * Test AI connection
 * @route GET /api/engagement/ai/test-connection
 */
const testConnection = async (req, res) => {
  try {
    const testPrompt = 'Return "OK" if you can read this.';

    const response = await AIGenerationService.generateCompletion({
      prompt: testPrompt,
      maxTokens: 10,
      temperature: 0
    });

    const isConnected = response.toLowerCase().includes('ok');

    res.json({
      success: true,
      connected: isConnected,
      provider: 'openai',
      model: 'gpt-4',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('AI connection test failed', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
};

module.exports = {
  generateQuestions,
  getAISuggestions,
  testConnection
};