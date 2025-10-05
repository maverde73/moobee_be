/**
 * AI Sub-Role Classifier Service
 * Uses OpenAI GPT-4o to classify custom sub-roles and assign parent roles
 * Date: 3 October 2025, 15:45
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Uses GPT-4o to classify a custom sub-role and assign the best parent role
 * @param {string} customSubRoleName - The custom sub-role name (e.g., "React Native Developer")
 * @param {Array} availableParentRoles - List of 15 parent roles from database
 * @returns {Promise<Object>} { parentRoleId, parentRoleName, confidence, reasoning }
 */
async function classifySubRole(customSubRoleName, availableParentRoles) {
  const rolesDescription = availableParentRoles.map(r =>
    `ID ${r.id}: ${r.Role}`
  ).join('\n');

  const systemPrompt = `You are an expert in job role classification for IT and technology positions.
Your task is to analyze a custom job sub-role and assign it to the most appropriate parent role category.

Available parent roles:
${rolesDescription}

Rules:
1. Choose the SINGLE most appropriate parent role based on job responsibilities and skills
2. Provide a confidence score (0.0-1.0) where:
   - 0.9-1.0 = Very confident match
   - 0.7-0.89 = Confident match
   - 0.5-0.69 = Moderate confidence
   - <0.5 = Low confidence (suggest alternatives)
3. Explain your reasoning in 1-2 sentences
4. If confidence < 0.7, provide up to 3 alternative parent role IDs`;

  const userPrompt = `Classify this custom sub-role: "${customSubRoleName}"

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "parent_role_id": <number>,
  "parent_role_name": <string>,
  "confidence": <float 0.0-1.0>,
  "reasoning": <string explaining why this parent role was chosen>,
  "alternatives": [<array of alternative parent role IDs as numbers, or empty array if confidence >= 0.7>]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AI_CLASSIFICATION_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistency
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate result
    if (!result.parent_role_id || !result.confidence) {
      throw new Error('Invalid AI response format');
    }

    return {
      parentRoleId: parseInt(result.parent_role_id),
      parentRoleName: result.parent_role_name,
      confidence: parseFloat(result.confidence),
      reasoning: result.reasoning || 'No reasoning provided',
      alternatives: Array.isArray(result.alternatives) ? result.alternatives.map(id => parseInt(id)) : [],
      aiModel: process.env.AI_CLASSIFICATION_MODEL || 'gpt-4o',
      aiProvider: 'openai'
    };
  } catch (error) {
    console.error('Error classifying sub-role with AI:', error);
    throw new Error(`AI classification failed: ${error.message}`);
  }
}

/**
 * Generate synonyms for custom sub-role using AI
 * @param {string} customSubRoleName - The custom sub-role name
 * @returns {Promise<string[]>} Array of synonyms
 */
async function generateSynonyms(customSubRoleName) {
  const prompt = `Generate 3-5 common synonyms or alternative names for this job role: "${customSubRoleName}"

Return ONLY valid JSON with this structure (no markdown, no code blocks):
{
  "synonyms": ["synonym1", "synonym2", "synonym3"]
}

Guidelines:
- Include common abbreviations (e.g., "ML Engineer" for "Machine Learning Engineer")
- Include industry variations (e.g., "Frontend Developer" and "Front-end Developer")
- Keep it concise and relevant`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Faster model for simple task
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.synonyms || [];
  } catch (error) {
    console.error('Error generating synonyms:', error);
    return []; // Non-blocking - return empty array on error
  }
}

module.exports = {
  classifySubRole,
  generateSynonyms
};
