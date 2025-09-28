// Test campaign validation requirements
const { body } = require('express-validator');

const createCampaignValidation = [
  body('templateId').notEmpty().isInt().withMessage('Valid template ID is required'),
  body('employeeIds').isArray({ min: 1 }).withMessage('At least one employee must be selected'),
  body('startDate').isISO8601().toDate().withMessage('Valid start date is required'),
  body('deadline').isISO8601().toDate().withMessage('Valid deadline is required'),
  body('name').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('frequency').optional().isIn(['once', 'recurring']),
  body('mandatory').optional().isBoolean(),
  body('allowRetakes').optional().isBoolean(),
  body('maxAttempts').optional().isInt({ min: 1, max: 10 })
];

// Test data
const testPayload = {
  templateId: 27,
  name: "Analytics Excellence Assessment 5 - 25/09/2025",
  description: "Assessment DISC per valutare le competenze del team Analytics Excellence.",
  employeeIds: ["user-1", "user-2"],
  startDate: new Date().toISOString(),
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  frequency: "once",
  mandatory: false,
  allowRetakes: false,
  maxAttempts: 1
};

console.log('Test payload:');
console.log(JSON.stringify(testPayload, null, 2));

// Validate each field
console.log('\nValidation checks:');
console.log('- templateId is integer:', Number.isInteger(testPayload.templateId));
console.log('- employeeIds is array with min 1:', Array.isArray(testPayload.employeeIds) && testPayload.employeeIds.length > 0);
console.log('- startDate is ISO8601:', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(testPayload.startDate));
console.log('- deadline is ISO8601:', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(testPayload.deadline));
console.log('- frequency is valid:', ['once', 'recurring'].includes(testPayload.frequency));
console.log('- mandatory is boolean:', typeof testPayload.mandatory === 'boolean');
console.log('- allowRetakes is boolean:', typeof testPayload.allowRetakes === 'boolean');
console.log('- maxAttempts is valid int:', Number.isInteger(testPayload.maxAttempts) && testPayload.maxAttempts >= 1 && testPayload.maxAttempts <= 10);