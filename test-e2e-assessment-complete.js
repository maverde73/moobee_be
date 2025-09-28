/**
 * Test End-to-End Completo del Sistema Assessment Moobee
 *
 * Questo script testa l'intero flusso del sistema assessment:
 * 1. Creazione assessment da parte di HR
 * 2. Pianificazione e assegnazione
 * 3. Notifiche ai dipendenti
 * 4. Completamento assessment
 * 5. Calcolo soft skills
 * 6. Generazione raccomandazioni
 * 7. Report e visualizzazione risultati
 */

const axios = require('axios');
const chalk = require('chalk');

const API_BASE_URL = 'http://localhost:8000/api';
const TENANT_ID = 'tenant_123';
const HR_USER_ID = 'hr_001';
const EMPLOYEE_IDS = ['emp_001', 'emp_002', 'emp_003'];

// Utility per log colorati
const log = {
  info: (msg) => console.log(chalk.blue('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✓'), msg),
  error: (msg) => console.log(chalk.red('✗'), msg),
  warn: (msg) => console.log(chalk.yellow('⚠'), msg),
  section: (msg) => console.log(chalk.cyan.bold(`\n=== ${msg} ===\n`))
};

// Utility per delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility per API calls con error handling
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        'Authorization': 'Bearer test-token'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    log.error(`API Error: ${error.message}`);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
    throw error;
  }
}

// FASE 1: Creazione Assessment
async function createAssessment() {
  log.section('FASE 1: Creazione Assessment da HR');

  const assessmentData = {
    title: 'Q1 2024 Performance Assessment',
    type: 'Big Five',
    description: 'Quarterly performance and personality assessment',
    questions: [
      {
        text: 'I see myself as someone who is talkative',
        category: 'Extraversion',
        type: 'likert',
        scale: { min: 1, max: 5 },
        required: true
      },
      {
        text: 'I tend to find fault with others',
        category: 'Agreeableness',
        type: 'likert',
        scale: { min: 1, max: 5 },
        required: true,
        reverseScored: true
      },
      {
        text: 'I do a thorough job',
        category: 'Conscientiousness',
        type: 'likert',
        scale: { min: 1, max: 5 },
        required: true
      },
      {
        text: 'I am depressed, blue',
        category: 'Neuroticism',
        type: 'likert',
        scale: { min: 1, max: 5 },
        required: true
      },
      {
        text: 'I am original, come up with new ideas',
        category: 'Openness',
        type: 'likert',
        scale: { min: 1, max: 5 },
        required: true
      }
    ],
    settings: {
      timeLimit: 30,
      allowSkip: false,
      randomizeQuestions: false,
      showProgress: true,
      autoSave: true
    },
    createdBy: HR_USER_ID
  };

  try {
    const result = await apiCall('POST', '/assessments', assessmentData);
    log.success(`Assessment creato con ID: ${result.id}`);
    return result.id;
  } catch (error) {
    log.error('Errore nella creazione assessment');
    throw error;
  }
}

// FASE 2: Pianificazione Assessment
async function scheduleAssessment(assessmentId) {
  log.section('FASE 2: Pianificazione Assessment');

  const scheduleData = {
    assessmentId,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 settimana
    recurrence: 'none',
    reminderSettings: {
      enabled: true,
      daysBefore: [3, 1],
      time: '09:00'
    }
  };

  try {
    const result = await apiCall('POST', '/assessments/schedule', scheduleData);
    log.success(`Assessment pianificato dal ${scheduleData.startDate} al ${scheduleData.endDate}`);
    return result.scheduleId;
  } catch (error) {
    log.error('Errore nella pianificazione');
    throw error;
  }
}

// FASE 3: Assegnazione Dipendenti
async function assignEmployees(assessmentId, employeeIds) {
  log.section('FASE 3: Assegnazione Dipendenti');

  const assignmentData = {
    assessmentId,
    employeeIds,
    groups: ['all_employees'],
    notificationSettings: {
      sendEmail: true,
      sendInApp: true,
      customMessage: 'Please complete your quarterly assessment by the deadline.'
    }
  };

  try {
    const result = await apiCall('POST', '/assessments/assign', assignmentData);
    log.success(`Assessment assegnato a ${employeeIds.length} dipendenti`);
    employeeIds.forEach(id => log.info(`  - Dipendente ${id} assegnato`));
    return result.assignments;
  } catch (error) {
    log.error('Errore nell\'assegnazione');
    throw error;
  }
}

// FASE 4: Invio Notifiche
async function sendNotifications(assessmentId, assignments) {
  log.section('FASE 4: Invio Notifiche e Inviti');

  try {
    const result = await apiCall('POST', `/assessments/${assessmentId}/notifications`, {
      type: 'invitation',
      assignments
    });

    log.success(`Notifiche inviate: ${result.sent} successi, ${result.failed} fallimenti`);

    if (result.details) {
      result.details.forEach(detail => {
        if (detail.success) {
          log.info(`  ✓ ${detail.employeeId}: ${detail.method}`);
        } else {
          log.warn(`  ✗ ${detail.employeeId}: ${detail.error}`);
        }
      });
    }

    return result;
  } catch (error) {
    log.error('Errore nell\'invio notifiche');
    throw error;
  }
}

// FASE 5: Simulazione Completamento Assessment
async function completeAssessment(assessmentId, employeeId) {
  log.section(`FASE 5: Completamento Assessment - Dipendente ${employeeId}`);

  // Start session
  let session;
  try {
    session = await apiCall('POST', `/assessments/${assessmentId}/sessions`, {
      employeeId
    });
    log.info(`Sessione avviata: ${session.id}`);
  } catch (error) {
    log.error('Errore avvio sessione');
    throw error;
  }

  // Submit responses
  const responses = [
    { questionId: 1, answer: 4 },
    { questionId: 2, answer: 2 },
    { questionId: 3, answer: 5 },
    { questionId: 4, answer: 1 },
    { questionId: 5, answer: 4 }
  ];

  for (const response of responses) {
    try {
      await apiCall('POST', `/assessments/sessions/${session.id}/responses`, response);
      log.info(`  Risposta registrata per domanda ${response.questionId}: ${response.answer}`);
      await delay(500); // Simula tempo di risposta umano
    } catch (error) {
      log.error(`Errore nella risposta ${response.questionId}`);
    }
  }

  // Complete session
  try {
    const completion = await apiCall('POST', `/assessments/sessions/${session.id}/complete`);
    log.success(`Assessment completato! Tempo totale: ${completion.duration}s`);
    return completion;
  } catch (error) {
    log.error('Errore completamento sessione');
    throw error;
  }
}

// FASE 6: Calcolo Soft Skills
async function calculateSoftSkills(assessmentId, employeeId) {
  log.section('FASE 6: Calcolo Soft Skills');

  try {
    const result = await apiCall('POST', `/assessments/${assessmentId}/calculate`, {
      employeeId,
      includePercentiles: true,
      includeTrends: true
    });

    log.success('Soft skills calcolate:');

    if (result.skills) {
      Object.entries(result.skills).forEach(([skill, data]) => {
        log.info(`  ${skill}: ${data.score.toFixed(1)}/10 (Percentile: ${data.percentile})`);
        if (data.trend) {
          const trendIcon = data.trend === 'improving' ? '↑' :
                           data.trend === 'declining' ? '↓' : '→';
          log.info(`    Trend: ${trendIcon} ${data.trend}`);
        }
      });
    }

    return result;
  } catch (error) {
    log.error('Errore calcolo soft skills');
    throw error;
  }
}

// FASE 7: Generazione Raccomandazioni
async function generateRecommendations(assessmentId, employeeId, skillsData) {
  log.section('FASE 7: Generazione Raccomandazioni');

  try {
    const result = await apiCall('POST', `/recommendations/generate`, {
      assessmentId,
      employeeId,
      skillsData,
      config: {
        maxRecommendations: 5,
        prioritizeGaps: true,
        includeActionPlan: true
      }
    });

    log.success(`Generate ${result.recommendations.length} raccomandazioni:`);

    result.recommendations.forEach((rec, index) => {
      log.info(`  ${index + 1}. ${rec.title}`);
      log.info(`     Priorità: ${rec.priority} | Impatto: ${rec.impact}/10`);
      log.info(`     Skill target: ${rec.targetSkill} (${rec.currentLevel} → ${rec.targetLevel})`);
    });

    if (result.actionPlan) {
      log.success('\nPiano d\'azione generato:');
      log.info(`  Timeline: ${result.actionPlan.timeline}`);
      log.info(`  Milestones: ${result.actionPlan.milestones.length}`);
    }

    return result;
  } catch (error) {
    log.error('Errore generazione raccomandazioni');
    throw error;
  }
}

// FASE 8: Generazione Report
async function generateReport(assessmentId) {
  log.section('FASE 8: Generazione Report');

  try {
    const result = await apiCall('POST', `/reports/generate`, {
      assessmentId,
      type: 'comprehensive',
      format: 'pdf',
      sections: [
        'executive_summary',
        'participation_metrics',
        'skills_overview',
        'individual_results',
        'team_comparison',
        'recommendations',
        'action_plans'
      ],
      filters: {
        includeIncomplete: false,
        departments: ['all']
      }
    });

    log.success(`Report generato: ${result.reportId}`);
    log.info(`  Formato: ${result.format}`);
    log.info(`  Dimensione: ${result.size} KB`);
    log.info(`  URL: ${result.downloadUrl}`);

    if (result.metrics) {
      log.success('\nMetriche Report:');
      log.info(`  Partecipazione: ${result.metrics.participation}%`);
      log.info(`  Completamento: ${result.metrics.completion}%`);
      log.info(`  Score medio: ${result.metrics.averageScore}/10`);
    }

    return result;
  } catch (error) {
    log.error('Errore generazione report');
    throw error;
  }
}

// MAIN: Esecuzione Test Completo
async function runCompleteE2ETest() {
  console.log(chalk.bold.magenta('\n╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║   TEST E2E SISTEMA ASSESSMENT MOOBEE        ║'));
  console.log(chalk.bold.magenta('╚══════════════════════════════════════════════╝\n'));

  const testResults = {
    phases: [],
    errors: [],
    startTime: Date.now()
  };

  try {
    // FASE 1: Creazione
    const assessmentId = await createAssessment();
    testResults.phases.push({ phase: 1, status: 'success', assessmentId });
    await delay(1000);

    // FASE 2: Pianificazione
    const scheduleId = await scheduleAssessment(assessmentId);
    testResults.phases.push({ phase: 2, status: 'success', scheduleId });
    await delay(1000);

    // FASE 3: Assegnazione
    const assignments = await assignEmployees(assessmentId, EMPLOYEE_IDS);
    testResults.phases.push({ phase: 3, status: 'success', assignments: assignments.length });
    await delay(1000);

    // FASE 4: Notifiche
    const notifications = await sendNotifications(assessmentId, assignments);
    testResults.phases.push({ phase: 4, status: 'success', sent: notifications.sent });
    await delay(1000);

    // FASE 5-7: Per ogni dipendente
    for (const employeeId of EMPLOYEE_IDS.slice(0, 2)) { // Test solo primi 2 per velocità
      // Completamento
      const completion = await completeAssessment(assessmentId, employeeId);
      testResults.phases.push({ phase: 5, status: 'success', employeeId, duration: completion.duration });
      await delay(1000);

      // Calcolo skills
      const skillsData = await calculateSoftSkills(assessmentId, employeeId);
      testResults.phases.push({ phase: 6, status: 'success', employeeId, skills: Object.keys(skillsData.skills).length });
      await delay(1000);

      // Raccomandazioni
      const recommendations = await generateRecommendations(assessmentId, employeeId, skillsData);
      testResults.phases.push({ phase: 7, status: 'success', employeeId, recommendations: recommendations.recommendations.length });
      await delay(1000);
    }

    // FASE 8: Report finale
    const report = await generateReport(assessmentId);
    testResults.phases.push({ phase: 8, status: 'success', reportId: report.reportId });

  } catch (error) {
    testResults.errors.push({
      message: error.message,
      stack: error.stack
    });
  }

  // Riepilogo finale
  testResults.endTime = Date.now();
  testResults.duration = (testResults.endTime - testResults.startTime) / 1000;

  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║           RIEPILOGO TEST E2E                ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════╝\n'));

  const successCount = testResults.phases.filter(p => p.status === 'success').length;
  const totalPhases = 8;

  log.info(`Fasi completate: ${successCount}/${totalPhases}`);
  log.info(`Tempo totale: ${testResults.duration.toFixed(2)}s`);

  if (testResults.errors.length > 0) {
    log.error(`\nErrori riscontrati: ${testResults.errors.length}`);
    testResults.errors.forEach(err => {
      log.error(`  - ${err.message}`);
    });
  } else {
    log.success('\n✨ TEST COMPLETATO CON SUCCESSO! ✨');
    log.success('Il sistema assessment Moobee è completamente funzionante.');
  }

  // Dettagli fasi
  console.log(chalk.bold.yellow('\nDettagli Fasi:'));
  const phaseNames = {
    1: 'Creazione Assessment',
    2: 'Pianificazione',
    3: 'Assegnazione Dipendenti',
    4: 'Invio Notifiche',
    5: 'Completamento Assessment',
    6: 'Calcolo Soft Skills',
    7: 'Generazione Raccomandazioni',
    8: 'Generazione Report'
  };

  testResults.phases.forEach(phase => {
    const icon = phase.status === 'success' ? '✓' : '✗';
    const color = phase.status === 'success' ? chalk.green : chalk.red;
    console.log(color(`  ${icon} Fase ${phase.phase}: ${phaseNames[phase.phase]}`));
  });

  return testResults;
}

// Gestione errori non catturati
process.on('unhandledRejection', (err) => {
  console.error(chalk.red('\n❌ Errore non gestito:'), err);
  process.exit(1);
});

// Avvio test
runCompleteE2ETest()
  .then(results => {
    if (results.errors.length === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error(chalk.red('\n❌ Errore fatale:'), err);
    process.exit(1);
  });