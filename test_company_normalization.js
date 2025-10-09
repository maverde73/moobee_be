const service = require('./src/services/cvDataSaveService');

const testCases = [
  { input: 'Taal Srl', expected: 'taal' },
  { input: 'Taal', expected: 'taal' },
  { input: 'RINGMASTER - Lottomatica', expected: 'ringmaster lottomatica' },
  { input: 'Ringmaster - Lottomatica', expected: 'ringmaster lottomatica' },
  { input: 'CheBanca! and KBCI', expected: 'chebanca kbci' },
  { input: 'CheBanca! e KBCI', expected: 'chebanca kbci' },
  { input: 'Microsoft Corporation', expected: 'microsoft' },
  { input: 'Google Inc.', expected: 'google' },
  { input: 'Amazon S.p.A.', expected: 'amazon' },
  { input: 'Apple Ltd.', expected: 'apple' },
  { input: 'Nexa Data', expected: 'nexa data' }
];

console.log('\n🧪 Testing Company Name Normalization\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
  const result = service.normalizeCompanyName(input);
  const status = result === expected ? '✅' : '❌';

  if (result === expected) {
    passed++;
    console.log(`${status} "${input}" → "${result}"`);
  } else {
    failed++;
    console.log(`${status} "${input}"`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Got:      "${result}"`);
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

process.exit(failed > 0 ? 1 : 0);
