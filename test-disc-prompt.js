const { getAssessmentPrompt } = require('./src/config/assessmentPrompts');
const PromptBuilder = require('./src/services/ai/promptBuilder');

console.log('Testing DISC Assessment Prompt Generation\n');
console.log('='.repeat(80));

// Test with customization
const customization = 'RUOLI TARGET: manager\nDESCRIZIONE ASSESSMENT: Testing DISC generation with Likert scale\n';
const count = 5;

// Get the fixed prompt
const basePrompt = getAssessmentPrompt('disc', customization, count);

// Get JSON instructions
const promptBuilder = new PromptBuilder();
const jsonInstructions = promptBuilder.getJSONInstructions('disc', 'it');

// Combine to get final prompt
const finalPrompt = basePrompt + jsonInstructions;

console.log('🎯 EXACT PROMPT THAT WOULD BE SENT TO OPENAI:');
console.log('='.repeat(80));
console.log(finalPrompt);
console.log('='.repeat(80));
console.log('\n📝 Prompt length:', finalPrompt.length, 'characters');

// Check if Likert scale is mentioned
const hasLikert = finalPrompt.includes('Likert');
const hasScalaLikert = finalPrompt.includes('Scala Likert') || finalPrompt.includes('scala Likert');
const hasOptions = finalPrompt.includes('options');
const hasMultipleChoice = finalPrompt.includes('multiple_choice');

console.log('\n✅ Verification:');
console.log('  - Contains "Likert":', hasLikert);
console.log('  - Contains "Scala Likert":', hasScalaLikert);
console.log('  - Contains "options":', hasOptions);
console.log('  - Contains "multiple_choice":', hasMultipleChoice);

// Check for the 5 Likert options
const likertOptions = [
  "Per niente d'accordo",
  "Poco d'accordo",
  "Né d'accordo né in disaccordo",
  "Abbastanza d'accordo",
  "Completamente d'accordo"
];

console.log('\n📊 Likert Options Check:');
likertOptions.forEach((option, index) => {
  const hasOption = finalPrompt.includes(option);
  console.log(`  ${index + 1}. "${option}": ${hasOption ? '✅' : '❌'}`);
});