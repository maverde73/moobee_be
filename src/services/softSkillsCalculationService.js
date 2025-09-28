/**
 * Soft Skills Calculation Service
 * Servizio per calcolo automatico soft skills da assessment responses
 * @module services/softSkillsCalculationService
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SoftSkillsCalculationService {
  constructor() {
    this.weightMappings = {
      BIG_FIVE: {
        Openness: { weight: 1.0, questions: ['q1', 'q5', 'q9', 'q13'] },
        Conscientiousness: { weight: 1.0, questions: ['q2', 'q6', 'q10', 'q14'] },
        Extraversion: { weight: 1.0, questions: ['q3', 'q7', 'q11', 'q15'] },
        Agreeableness: { weight: 1.0, questions: ['q4', 'q8', 'q12', 'q16'] },
        Neuroticism: { weight: 1.0, questions: ['q17', 'q18', 'q19', 'q20'] }
      },
      DISC: {
        Dominance: { weight: 1.0, questions: [] },
        Influence: { weight: 1.0, questions: [] },
        Steadiness: { weight: 1.0, questions: [] },
        Compliance: { weight: 1.0, questions: [] }
      },
      CUSTOM: {
        Leadership: { weight: 1.2, questions: [] },
        Communication: { weight: 1.0, questions: [] },
        ProblemSolving: { weight: 1.1, questions: [] },
        TeamWork: { weight: 0.9, questions: [] },
        DecisionMaking: { weight: 1.0, questions: [] }
      }
    };
  }

  /**
   * Calcola soft skills da risposte assessment
   * @param {string} assessmentId - ID assessment completato
   * @param {Object} responses - Mappa risposte {questionId: value}
   * @param {Object} template - Template assessment con mappings
   * @returns {Object} Soft skills calcolate con scores
   */
  async calculateSkillsFromAssessment(assessmentId, responses, template) {
    try {
      console.log(`Calculating skills for assessment ${assessmentId}`);

      // Get question-to-skill mappings from template
      const skillMappings = await this.getSkillMappings(template);

      // Initialize skill scores
      const skillScores = new Map();

      // Process each response
      for (const [questionId, answer] of Object.entries(responses)) {
        const question = template.questions?.find(q => q.id === questionId);
        if (!question) continue;

        // Find which skills this question maps to
        const mappedSkills = skillMappings[question.category] || skillMappings['general'] || [];

        for (const skillName of mappedSkills) {
          if (!skillScores.has(skillName)) {
            skillScores.set(skillName, {
              totalScore: 0,
              questionCount: 0,
              weights: [],
              rawScores: []
            });
          }

          // Calculate weighted score for this response
          const score = this.calculateResponseScore(answer, question.type, question.scale);
          const weight = this.getQuestionWeight(question, template.type);

          const skillData = skillScores.get(skillName);
          skillData.totalScore += score * weight;
          skillData.questionCount++;
          skillData.weights.push(weight);
          skillData.rawScores.push(score);
        }
      }

      // Calculate final scores for each skill
      const finalSkills = {};
      for (const [skillName, data] of skillScores) {
        if (data.questionCount > 0) {
          const avgWeight = data.weights.reduce((a, b) => a + b, 0) / data.weights.length;
          const finalScore = Math.round(data.totalScore / data.questionCount);

          finalSkills[skillName] = {
            name: skillName,
            score: finalScore,
            confidence: this.calculateConfidence(data.questionCount, avgWeight),
            questionsCovered: data.questionCount,
            trend: await this.calculateTrend(assessmentId, skillName, finalScore),
            percentile: await this.calculatePercentile(skillName, finalScore, template.type)
          };
        }
      }

      return finalSkills;
    } catch (error) {
      console.error('Error calculating skills:', error);
      throw error;
    }
  }

  /**
   * Calcola score da singola risposta
   */
  calculateResponseScore(answer, questionType, scale = { min: 1, max: 5 }) {
    switch (questionType) {
      case 'likert':
        // Likert scale: normalize to 0-100
        return ((answer - scale.min) / (scale.max - scale.min)) * 100;

      case 'multiple_choice':
        // Map choice values to scores
        const choiceScores = {
          'strongly_agree': 100,
          'agree': 75,
          'neutral': 50,
          'disagree': 25,
          'strongly_disagree': 0,
          'always': 100,
          'often': 75,
          'sometimes': 50,
          'rarely': 25,
          'never': 0
        };
        return choiceScores[answer] || 50;

      case 'true_false':
        // Binary: true = 100, false = 0
        return answer === true || answer === 'true' ? 100 : 0;

      case 'rating':
        // Rating scale: normalize to 0-100
        return (answer / 10) * 100;

      default:
        return 50; // Default neutral score
    }
  }

  /**
   * Get weight for question based on assessment type
   */
  getQuestionWeight(question, assessmentType) {
    // Priority weights by category
    const categoryWeights = {
      'Leadership': 1.2,
      'Communication': 1.0,
      'Problem Solving': 1.1,
      'Team Work': 0.9,
      'Decision Making': 1.0,
      'Critical': 1.5,
      'Important': 1.2,
      'Standard': 1.0,
      'Optional': 0.8
    };

    const weight = categoryWeights[question.category] || 1.0;

    // Adjust for question importance if marked
    if (question.isRequired) {
      return weight * 1.1;
    }

    return weight;
  }

  /**
   * Calcola livello di confidenza del risultato
   */
  calculateConfidence(questionCount, avgWeight) {
    // More questions = higher confidence
    const countFactor = Math.min(questionCount / 10, 1);

    // Higher average weight = more reliable
    const weightFactor = avgWeight;

    // Combined confidence score
    const confidence = (countFactor * 0.6 + weightFactor * 0.4) * 100;

    return Math.round(confidence);
  }

  /**
   * Calcola trend rispetto a assessment precedenti
   */
  async calculateTrend(assessmentId, skillName, currentScore) {
    try {
      // Get user's previous scores for this skill
      const previousScores = await prisma.$queryRaw`
        SELECT score, recorded_at
        FROM skill_history
        WHERE user_id = (
          SELECT user_id FROM assessment_results
          WHERE assessment_id = ${assessmentId}
        )
        AND skill_name = ${skillName}
        ORDER BY recorded_at DESC
        LIMIT 3
      `;

      if (!previousScores || previousScores.length === 0) {
        return 'stable'; // No history
      }

      const prevScore = previousScores[0].score;
      const scoreDiff = currentScore - prevScore;

      if (scoreDiff > 5) return 'improving';
      if (scoreDiff < -5) return 'declining';
      return 'stable';

    } catch (error) {
      console.error('Error calculating trend:', error);
      return 'stable';
    }
  }

  /**
   * Calcola percentile rispetto ad altri utenti
   */
  async calculatePercentile(skillName, score, assessmentType) {
    try {
      // Get distribution of scores for this skill
      const allScores = await prisma.$queryRaw`
        SELECT score
        FROM user_skill_scores
        WHERE skill_name = ${skillName}
        AND assessment_type = ${assessmentType}
        ORDER BY score ASC
      `;

      if (!allScores || allScores.length === 0) {
        return 50; // Default to median if no data
      }

      // Find position of current score
      const belowCount = allScores.filter(s => s.score < score).length;
      const percentile = Math.round((belowCount / allScores.length) * 100);

      return percentile;

    } catch (error) {
      console.error('Error calculating percentile:', error);
      return 50;
    }
  }

  /**
   * Aggregazione multi-assessment (360 feedback)
   */
  async aggregate360Feedback(assessmentIds) {
    const weights = {
      SELF_ASSESSMENT: 0.25,
      PEER_ASSESSMENT: 0.35,
      MANAGER_ASSESSMENT: 0.40
    };

    const aggregatedSkills = {};
    const assessmentData = [];

    // Load all assessment results
    for (const assessmentId of assessmentIds) {
      const result = await prisma.assessmentResult.findUnique({
        where: { id: assessmentId },
        include: {
          skills: true,
          assessment: true
        }
      });

      if (result) {
        assessmentData.push({
          type: result.assessment.type,
          skills: result.skills
        });
      }
    }

    // Get all unique skills
    const allSkills = new Set();
    assessmentData.forEach(data => {
      data.skills.forEach(skill => allSkills.add(skill.name));
    });

    // Calculate weighted average for each skill
    for (const skillName of allSkills) {
      let weightedSum = 0;
      let totalWeight = 0;
      let sources = 0;

      assessmentData.forEach(data => {
        const skill = data.skills.find(s => s.name === skillName);
        if (skill) {
          const weight = weights[data.type] || 0.25;
          weightedSum += skill.score * weight;
          totalWeight += weight;
          sources++;
        }
      });

      if (totalWeight > 0) {
        aggregatedSkills[skillName] = {
          score: Math.round(weightedSum / totalWeight),
          sources,
          confidence: this.calculate360Confidence(sources, totalWeight)
        };
      }
    }

    return aggregatedSkills;
  }

  /**
   * Calcola confidenza per 360 feedback
   */
  calculate360Confidence(sources, totalWeight) {
    // More sources = higher confidence
    const sourceFactor = Math.min(sources / 3, 1);

    // Higher total weight = more complete feedback
    const weightFactor = Math.min(totalWeight, 1);

    return Math.round((sourceFactor * 0.5 + weightFactor * 0.5) * 100);
  }

  /**
   * Get skill mappings for assessment template
   */
  async getSkillMappings(template) {
    // Default mappings by assessment type
    const defaultMappings = {
      BIG_FIVE: {
        'Personality': ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Emotional Stability'],
        'Leadership': ['Conscientiousness', 'Extraversion'],
        'Teamwork': ['Agreeableness', 'Extraversion'],
        'general': ['Openness', 'Conscientiousness']
      },
      DISC: {
        'Behavior': ['Dominance', 'Influence', 'Steadiness', 'Compliance'],
        'Leadership': ['Dominance', 'Influence'],
        'Teamwork': ['Steadiness', 'Compliance'],
        'general': ['Dominance', 'Influence', 'Steadiness', 'Compliance']
      },
      CUSTOM: {
        'Leadership': ['Leadership', 'Decision Making'],
        'Communication': ['Communication', 'Team Work'],
        'Technical': ['Problem Solving', 'Decision Making'],
        'general': ['Leadership', 'Communication', 'Problem Solving', 'Team Work', 'Decision Making']
      }
    };

    return defaultMappings[template.type] || defaultMappings.CUSTOM;
  }

  /**
   * Salva risultati nel database
   */
  async saveCalculatedSkills(userId, assessmentId, skills) {
    try {
      // Save each skill score
      for (const [skillName, skillData] of Object.entries(skills)) {
        // Check if skill exists in database
        let skill = await prisma.softSkill.findFirst({
          where: { name: skillName }
        });

        if (!skill) {
          // Create skill if doesn't exist
          skill = await prisma.softSkill.create({
            data: {
              name: skillName,
              category: this.getSkillCategory(skillName),
              description: `${skillName} competency`
            }
          });
        }

        // Save user skill score
        await prisma.userSkillScore.upsert({
          where: {
            userId_skillId_assessmentId: {
              userId,
              skillId: skill.id,
              assessmentId
            }
          },
          update: {
            score: skillData.score,
            percentile: skillData.percentile,
            confidence: skillData.confidence,
            updatedAt: new Date()
          },
          create: {
            userId,
            skillId: skill.id,
            assessmentId,
            score: skillData.score,
            percentile: skillData.percentile,
            confidence: skillData.confidence
          }
        });

        // Update skill history
        await prisma.skillHistory.create({
          data: {
            userId,
            skillId: skill.id,
            skillName,
            score: skillData.score,
            trend: skillData.trend,
            assessmentId,
            recordedAt: new Date()
          }
        });
      }

      console.log(`Saved ${Object.keys(skills).length} skill scores for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error saving calculated skills:', error);
      throw error;
    }
  }

  /**
   * Get skill category from name
   */
  getSkillCategory(skillName) {
    const categories = {
      'Leadership': 'Management',
      'Communication': 'Interpersonal',
      'Problem Solving': 'Cognitive',
      'Team Work': 'Interpersonal',
      'Decision Making': 'Cognitive',
      'Openness': 'Personality',
      'Conscientiousness': 'Personality',
      'Extraversion': 'Personality',
      'Agreeableness': 'Personality',
      'Neuroticism': 'Personality',
      'Dominance': 'Behavioral',
      'Influence': 'Behavioral',
      'Steadiness': 'Behavioral',
      'Compliance': 'Behavioral'
    };

    return categories[skillName] || 'General';
  }

  /**
   * Generate benchmarks for comparison
   */
  async generateBenchmarks(userId, skillName) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          department: true,
          tenant: true
        }
      });

      // Team benchmark (same department)
      const teamScores = await prisma.$queryRaw`
        SELECT AVG(score) as avg_score
        FROM user_skill_scores uss
        JOIN users u ON uss.user_id = u.id
        WHERE u.department_id = ${user.departmentId}
        AND uss.skill_name = ${skillName}
      `;

      // Company benchmark (same tenant)
      const companyScores = await prisma.$queryRaw`
        SELECT AVG(score) as avg_score
        FROM user_skill_scores uss
        JOIN users u ON uss.user_id = u.id
        WHERE u.tenant_id = ${user.tenantId}
        AND uss.skill_name = ${skillName}
      `;

      // Industry benchmark (all tenants in same industry)
      const industryScores = await prisma.$queryRaw`
        SELECT AVG(score) as avg_score
        FROM user_skill_scores uss
        JOIN users u ON uss.user_id = u.id
        JOIN tenants t ON u.tenant_id = t.id
        WHERE t.industry = (
          SELECT industry FROM tenants WHERE id = ${user.tenantId}
        )
        AND uss.skill_name = ${skillName}
      `;

      return {
        team: Math.round(teamScores[0]?.avg_score || 0),
        company: Math.round(companyScores[0]?.avg_score || 0),
        industry: Math.round(industryScores[0]?.avg_score || 0)
      };

    } catch (error) {
      console.error('Error generating benchmarks:', error);
      return {
        team: 0,
        company: 0,
        industry: 0
      };
    }
  }

  /**
   * Process completed assessment
   */
  async processCompletedAssessment(assessmentId, userId, responses) {
    try {
      console.log(`Processing completed assessment ${assessmentId} for user ${userId}`);

      // Get assessment template
      const assessment = await prisma.assessmentInstance.findUnique({
        where: { id: assessmentId },
        include: {
          template: {
            include: {
              questions: true
            }
          }
        }
      });

      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Calculate skills from responses
      const calculatedSkills = await this.calculateSkillsFromAssessment(
        assessmentId,
        responses,
        assessment.template
      );

      // Save calculated skills
      await this.saveCalculatedSkills(userId, assessmentId, calculatedSkills);

      // Calculate overall score
      const skillScores = Object.values(calculatedSkills).map(s => s.score);
      const overallScore = Math.round(
        skillScores.reduce((a, b) => a + b, 0) / skillScores.length
      );

      // Save assessment result
      await prisma.assessmentResult.create({
        data: {
          assessmentId,
          userId,
          overallScore,
          completedAt: new Date(),
          skills: {
            create: Object.entries(calculatedSkills).map(([name, data]) => ({
              skillName: name,
              score: data.score,
              percentile: data.percentile,
              confidence: data.confidence,
              trend: data.trend
            }))
          }
        }
      });

      console.log(`Assessment ${assessmentId} processed successfully`);
      return {
        success: true,
        overallScore,
        skills: calculatedSkills
      };

    } catch (error) {
      console.error('Error processing assessment:', error);
      throw error;
    }
  }
}

module.exports = new SoftSkillsCalculationService();