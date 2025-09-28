/**
 * Test script per Role-Based Assessment System
 * Testa l'integrazione end-to-end del sistema
 */

const axios = require('axios');
const prisma = require('./src/config/database');

const API_BASE = 'http://localhost:3000/api';
let authToken = null;

// Colori per output console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function login() {
  console.log(`${colors.blue}📌 Login...${colors.reset}`);
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'john.doe@example.com',
      password: 'Password123!'
    });
    authToken = response.data.accessToken;
    console.log(`${colors.green}✅ Login successful${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Login failed:${colors.reset}`, error.response?.data || error.message);
    return false;
  }
}

async function testRoleSkillRequirements() {
  console.log(`\n${colors.blue}📌 Test 1: Recupero requisiti soft skills per ruolo...${colors.reset}`);

  try {
    // Prendi un ruolo esistente (usando raw query perché roles ha @@ignore)
    const roles = await prisma.$queryRaw`
      SELECT r.id, r."Role", r."NameKnown_Role"
      FROM roles r
      WHERE EXISTS (
        SELECT 1 FROM role_soft_skills rs WHERE rs."roleId" = r.id
      )
      LIMIT 1
    `;
    const role = roles[0];

    if (!role) {
      console.log(`${colors.yellow}⚠️  No roles with skills found${colors.reset}`);
      return false;
    }

    console.log(`  Testing with role: ${role.Role || role.NameKnown_Role} (ID: ${role.id})`);

    const response = await axios.get(
      `${API_BASE}/roles/${role.id}/skill-requirements`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { includeDescriptions: true }
      }
    );

    console.log(`${colors.green}✅ Retrieved requirements for role ${role.id}:${colors.reset}`);
    console.log(`  - Total requirements: ${response.data.totalRequirements}`);
    console.log(`  - Critical skills: ${response.data.summary.criticalSkills}`);
    console.log(`  - Important skills: ${response.data.summary.importantSkills}`);

    if (response.data.requirements.length > 0) {
      console.log('\n  Top 3 requirements:');
      response.data.requirements.slice(0, 3).forEach(req => {
        console.log(`    ${req.priority}. ${req.skillName} (target: ${req.targetScore})`);
      });
    }

    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`, error.response?.data || error.message);
    return false;
  }
}

async function testRecommendedTemplates() {
  console.log(`\n${colors.blue}📌 Test 2: Template assessment raccomandati per ruolo...${colors.reset}`);

  try {
    // Usa un ruolo esistente
    const roleId = 37; // Bioinformatics Scientists (dal tuo esempio)

    const response = await axios.get(
      `${API_BASE}/assessments/roles/${roleId}/templates`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log(`${colors.green}✅ Retrieved templates for role ${roleId}:${colors.reset}`);
    console.log(`  - Role: ${response.data.roleName}`);
    console.log(`  - Templates found: ${response.data.count}`);

    if (response.data.templates.length > 0) {
      console.log('\n  Available templates:');
      response.data.templates.slice(0, 3).forEach(template => {
        console.log(`    - ${template.name} (${template.type})`);
        console.log(`      Frequency: ${template.frequency}, Recommended: ${template.isRecommended}`);
      });
    }

    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`, error.response?.data || error.message);
    return false;
  }
}

async function testCalculateRoleFit() {
  console.log(`\n${colors.blue}📌 Test 3: Calcolo soft skills e role fit...${colors.reset}`);

  try {
    // Prendi un template e un dipendente di test
    const template = await prisma.assessmentTemplate.findFirst({
      where: {
        isActive: true,
        questions: {
          some: {}
        }
      },
      include: {
        questions: true
      }
    });

    const employee = await prisma.employees.findFirst();
    const roleId = 37; // Usa un ruolo con soft skills mappate

    if (!template || !employee) {
      console.log(`${colors.yellow}⚠️  Test data not found${colors.reset}`);
      return false;
    }

    console.log(`  Using template: ${template.name}`);
    console.log(`  Employee: ${employee.first_name} ${employee.last_name}`);
    console.log(`  Role ID: ${roleId}`);

    // Simula risposte (valori 1-5)
    const responses = {};
    template.questions.forEach(q => {
      responses[q.id] = Math.floor(Math.random() * 5) + 1;
    });

    const response = await axios.post(
      `${API_BASE}/assessments/${template.id}/calculate-role-fit`,
      {
        employeeId: employee.id,
        roleId: roleId,
        responses: responses
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log(`${colors.green}✅ Role fit calculated successfully:${colors.reset}`);
    console.log(`  - Overall fit: ${response.data.result.roleFit.overall}%`);
    console.log(`  - Critical skills fit: ${response.data.result.roleFit.critical}%`);
    console.log(`  - Level: ${response.data.result.roleFit.level.label}`);
    console.log(`  - Recommendation: ${response.data.result.roleFit.recommendation}`);

    if (response.data.result.insights.strengths.length > 0) {
      console.log('\n  Strengths:');
      response.data.result.insights.strengths.forEach(s => {
        console.log(`    ✓ ${s.skillName}: ${s.score}/100`);
      });
    }

    if (response.data.result.insights.developmentAreas.length > 0) {
      console.log('\n  Development areas:');
      response.data.result.insights.developmentAreas.forEach(d => {
        console.log(`    ⚠ ${d.skillName}: ${d.score}/100 (gap: ${d.gap})`);
      });
    }

    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`, error.response?.data || error.message);
    return false;
  }
}

async function testEmployeeSkillsAssessment() {
  console.log(`\n${colors.blue}📌 Test 4: Recupero assessment skills dipendente...${colors.reset}`);

  try {
    // Usa un dipendente con assessment completato
    const employee = await prisma.employees.findFirst({
      where: {
        softSkillScores: {
          some: {}
        }
      }
    });

    if (!employee) {
      console.log(`${colors.yellow}⚠️  No employee with assessments found${colors.reset}`);
      // Usa un dipendente qualsiasi
      const anyEmployee = await prisma.employees.findFirst();
      if (anyEmployee) {
        const response = await axios.get(
          `${API_BASE}/employees/${anyEmployee.id}/role-skills-assessment`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );

        console.log(`${colors.green}✅ Retrieved assessment for employee ${anyEmployee.id}:${colors.reset}`);
        console.log(`  - Employee: ${response.data.employeeName}`);
        console.log(`  - Role: ${response.data.roleName || 'N/A'}`);
        console.log(`  - Soft skills assessed: ${response.data.softSkillScores.length}`);
      }
      return true;
    }

    const response = await axios.get(
      `${API_BASE}/employees/${employee.id}/role-skills-assessment`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log(`${colors.green}✅ Retrieved assessment for employee ${employee.id}:${colors.reset}`);
    console.log(`  - Employee: ${response.data.employeeName}`);
    console.log(`  - Role: ${response.data.roleName}`);
    console.log(`  - Overall fit: ${response.data.overallFitScore || 'Not calculated'}%`);
    console.log(`  - Skills with gaps: ${response.data.gapAnalysis.filter(g => g.gap > 0).length}`);

    if (response.data.softSkillScores.length > 0) {
      console.log('\n  Top skills:');
      response.data.softSkillScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .forEach(skill => {
          console.log(`    - ${skill.skillName}: ${skill.score}/100 (${skill.level})`);
        });
    }

    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`, error.response?.data || error.message);
    return false;
  }
}

async function testSoftSkillsDashboard() {
  console.log(`\n${colors.blue}📌 Test 5: Dashboard soft skills...${colors.reset}`);

  try {
    const employee = await prisma.employees.findFirst();

    if (!employee) {
      console.log(`${colors.yellow}⚠️  No employee found${colors.reset}`);
      return false;
    }

    const response = await axios.get(
      `${API_BASE}/soft-skills/dashboard/${employee.id}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { compareWithRole: 37 } // Confronta con un ruolo
      }
    );

    console.log(`${colors.green}✅ Retrieved dashboard for employee ${employee.id}:${colors.reset}`);
    console.log(`  - Employee: ${response.data.employee.name}`);
    console.log(`  - Overall score: ${response.data.overview.overallScore}/100`);
    console.log(`  - Skills assessed: ${response.data.overview.totalSkillsAssessed}`);
    console.log(`  - Average confidence: ${response.data.overview.averageConfidence}`);

    if (response.data.topSkills.length > 0) {
      console.log('\n  Top skills:');
      response.data.topSkills.forEach(skill => {
        console.log(`    ✓ ${skill.name}: ${skill.score}/100`);
      });
    }

    if (response.data.developmentAreas.length > 0) {
      console.log('\n  Development areas:');
      response.data.developmentAreas.forEach(area => {
        console.log(`    ⚠ ${area.name}: ${area.score}/100 (gap: ${area.gap})`);
      });
    }

    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Test failed:${colors.reset}`, error.response?.data || error.message);
    return false;
  }
}

async function runAllTests() {
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}🚀 ROLE-BASED ASSESSMENT SYSTEM - TEST SUITE${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log(`${colors.red}❌ Cannot proceed without authentication${colors.reset}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const tests = [
    { name: 'Role Skill Requirements', fn: testRoleSkillRequirements },
    { name: 'Recommended Templates', fn: testRecommendedTemplates },
    { name: 'Calculate Role Fit', fn: testCalculateRoleFit },
    { name: 'Employee Skills Assessment', fn: testEmployeeSkillsAssessment },
    { name: 'Soft Skills Dashboard', fn: testSoftSkillsDashboard }
  ];

  const results = [];
  for (const test of tests) {
    const success = await test.fn();
    results.push({ name: test.name, success });
  }

  // Summary
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}📊 TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? colors.green : colors.red;
    console.log(`${color}${icon} ${result.name}${colors.reset}`);
  });

  console.log(`\n${colors.blue}Total: ${passed} passed, ${failed} failed${colors.reset}`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  prisma.$disconnect();
  process.exit(1);
});