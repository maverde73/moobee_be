/**
 * Survey Filters for Backend
 * @module utils/surveyFilters
 * @created 2025-09-30
 */

const OBJECTIVE_TAGS = {
  followup: ['progress', 'improvement', 'trend', 'comparison'],
  burnout_risk: ['workload', 'resources', 'fatigue', 'recovery', 'stress', 'exhaustion'],
  conflicts: ['conflict', 'psychsafe', 'respect', 'voice', 'trust', 'team_dynamics'],
  potential_mapping: ['growth', 'learning', 'challenge', 'visibility', 'fit', 'aspiration']
};

const ROLE_TAGS = {
  manager: ['leadership', 'delegation', 'team_management', 'decision_making', 'coaching'],
  individual_contributor: ['autonomy', 'expertise', 'collaboration', 'task_focus'],
  sales: ['targets', 'customer', 'competition', 'negotiation', 'pressure'],
  engineering: ['technical', 'problem_solving', 'innovation', 'quality', 'deadline'],
  ops: ['process', 'efficiency', 'coordination', 'compliance', 'optimization'],
  hr: ['people', 'culture', 'policy', 'development', 'wellbeing']
};

function filterByObjective(questions, objective) {
  if (!objective) {
    return questions;
  }

  const targetTags = OBJECTIVE_TAGS[objective];
  if (!targetTags || targetTags.length === 0) {
    return questions;
  }

  const scoredQuestions = questions.map(question => {
    const questionTags = question.tags || [];
    const matchCount = targetTags.filter(tag =>
      questionTags.includes(tag)
    ).length;

    return {
      question,
      score: matchCount
    };
  });

  return scoredQuestions
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.question);
}

function adaptForRole(questions, role) {
  if (!role) {
    return questions;
  }

  const roleTags = ROLE_TAGS[role];
  if (!roleTags || roleTags.length === 0) {
    return questions;
  }

  const scoredQuestions = questions.map(question => {
    const questionTags = question.tags || [];
    const matchCount = roleTags.filter(tag =>
      questionTags.includes(tag)
    ).length;

    let score = matchCount;

    // Role-specific bonuses
    if (role === 'manager' && questionTags.includes('leadership')) {
      score += 2;
    }
    if (role === 'manager' && questionTags.includes('team_management')) {
      score += 2;
    }
    if (role === 'engineering' && questionTags.includes('technical')) {
      score += 2;
    }
    if (role === 'sales' && questionTags.includes('customer')) {
      score += 2;
    }
    if (role === 'hr' && questionTags.includes('people')) {
      score += 2;
    }

    return {
      question,
      score
    };
  });

  return scoredQuestions
    .sort((a, b) => b.score - a.score)
    .map(item => item.question);
}

function filterQuestions(questions, objective, role) {
  let filtered = filterByObjective(questions, objective);
  filtered = adaptForRole(filtered, role);
  return filtered;
}

module.exports = {
  filterByObjective,
  adaptForRole,
  filterQuestions,
  OBJECTIVE_TAGS,
  ROLE_TAGS
};