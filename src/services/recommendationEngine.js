/**
 * Recommendation Engine Service
 * Sistema intelligente di raccomandazioni basato su risultati assessment
 * @module services/recommendationEngine
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RecommendationEngine {
  constructor() {
    this.recommendationDatabase = {
      training: {
        Leadership: [
          {
            title: 'Leadership Essentials',
            provider: 'LinkedIn Learning',
            duration: '4 hours',
            level: 'intermediate',
            format: 'online',
            description: 'Fondamenti di leadership moderna per team digitali',
            link: 'https://learning.linkedin.com/leadership',
            skills: ['Leadership', 'Team Management', 'Decision Making']
          },
          {
            title: 'Situational Leadership Workshop',
            provider: 'Internal Training',
            duration: '2 days',
            level: 'advanced',
            format: 'classroom',
            description: 'Workshop intensivo su leadership situazionale',
            skills: ['Leadership', 'Adaptability', 'Coaching']
          }
        ],
        Communication: [
          {
            title: 'Effective Business Communication',
            provider: 'Coursera',
            duration: '6 weeks',
            level: 'beginner',
            format: 'online',
            description: 'Migliora comunicazione scritta e verbale nel business',
            link: 'https://coursera.org/communication',
            skills: ['Communication', 'Presentation', 'Writing']
          },
          {
            title: 'Crucial Conversations',
            provider: 'VitalSmarts',
            duration: '16 hours',
            level: 'intermediate',
            format: 'workshop',
            description: 'Gestire conversazioni difficili con successo',
            skills: ['Communication', 'Conflict Resolution', 'Negotiation']
          }
        ],
        ProblemSolving: [
          {
            title: 'Design Thinking Fundamentals',
            provider: 'IDEO U',
            duration: '5 weeks',
            level: 'intermediate',
            format: 'online',
            description: 'Approccio creativo alla risoluzione problemi',
            link: 'https://ideou.com/design-thinking',
            skills: ['Problem Solving', 'Innovation', 'Creativity']
          },
          {
            title: 'Data-Driven Decision Making',
            provider: 'Google',
            duration: '8 hours',
            level: 'intermediate',
            format: 'online',
            description: 'Usare dati per decisioni strategiche',
            skills: ['Problem Solving', 'Analytics', 'Decision Making']
          }
        ]
      },
      mentoring: {
        Leadership: [
          {
            title: 'Executive Mentorship Program',
            description: 'Mentoring 1:1 con senior executive',
            duration: '6 months',
            frequency: 'Biweekly',
            focus: ['Strategic thinking', 'Executive presence', 'Change management']
          }
        ],
        Communication: [
          {
            title: 'Communication Coach',
            description: 'Coaching personalizzato su comunicazione efficace',
            duration: '3 months',
            frequency: 'Weekly',
            focus: ['Public speaking', 'Written communication', 'Stakeholder management']
          }
        ]
      },
      projects: {
        Leadership: [
          {
            title: 'Lead Cross-functional Initiative',
            description: 'Guidare progetto inter-dipartimentale',
            duration: '3-6 months',
            complexity: 'high',
            skills: ['Leadership', 'Project Management', 'Stakeholder Management']
          }
        ],
        TeamWork: [
          {
            title: 'Agile Team Transformation',
            description: 'Partecipare a trasformazione agile del team',
            duration: '2-3 months',
            complexity: 'medium',
            skills: ['Team Work', 'Collaboration', 'Agile Methods']
          }
        ]
      },
      reading: {
        Leadership: [
          {
            title: 'The Five Dysfunctions of a Team',
            author: 'Patrick Lencioni',
            type: 'book',
            estimatedTime: '8 hours',
            description: 'Classico sulla gestione efficace dei team'
          },
          {
            title: 'Leaders Eat Last',
            author: 'Simon Sinek',
            type: 'book',
            estimatedTime: '10 hours',
            description: 'Leadership attraverso il servizio al team'
          }
        ],
        Communication: [
          {
            title: 'Nonviolent Communication',
            author: 'Marshall Rosenberg',
            type: 'book',
            estimatedTime: '6 hours',
            description: 'Comunicazione empatica e non violenta'
          }
        ]
      }
    };
  }

  /**
   * Genera raccomandazioni personalizzate basate su risultati assessment
   * @param {string} userId - ID utente
   * @param {Object} assessmentResults - Risultati assessment con skills
   * @param {Object} userProfile - Profilo utente (ruolo, seniority, etc)
   * @returns {Array} Lista raccomandazioni prioritizzate
   */
  async generateRecommendations(userId, assessmentResults, userProfile) {
    try {
      console.log(`Generating recommendations for user ${userId}`);

      // Identify skill gaps
      const gaps = await this.identifySkillGaps(assessmentResults, userProfile);

      // Identify strengths to leverage
      const strengths = this.identifyStrengths(assessmentResults);

      // Generate recommendations for gaps
      const gapRecommendations = await this.generateGapRecommendations(gaps, userProfile);

      // Generate leverage recommendations for strengths
      const strengthRecommendations = this.generateStrengthRecommendations(strengths, userProfile);

      // Combine and prioritize all recommendations
      const allRecommendations = [
        ...gapRecommendations,
        ...strengthRecommendations
      ];

      // Prioritize and filter recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(
        allRecommendations,
        userProfile
      );

      // Add metadata
      const finalRecommendations = await this.enrichRecommendations(
        prioritizedRecommendations,
        userId
      );

      console.log(`Generated ${finalRecommendations.length} recommendations`);
      return finalRecommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  /**
   * Identifica gap nelle competenze
   */
  async identifySkillGaps(assessmentResults, userProfile) {
    const gaps = [];

    // Get target profile for user's role
    const targetProfile = await this.getTargetProfile(userProfile.role, userProfile.seniority);

    // Compare current skills with target
    for (const skill of assessmentResults.skills) {
      const target = targetProfile[skill.skillName];
      if (target) {
        const gap = target.minScore - skill.score;
        if (gap > 0) {
          gaps.push({
            skillName: skill.skillName,
            currentScore: skill.score,
            targetScore: target.minScore,
            gap: gap,
            priority: this.calculateGapPriority(gap, target.importance),
            complexity: target.complexity || 'medium'
          });
        }
      }
    }

    // Sort by priority
    return gaps.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Identifica punti di forza
   */
  identifyStrengths(assessmentResults) {
    return assessmentResults.skills
      .filter(skill => skill.score >= 80)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 strengths
  }

  /**
   * Genera raccomandazioni per colmare gap
   */
  async generateGapRecommendations(gaps, userProfile) {
    const recommendations = [];

    for (const gap of gaps.slice(0, 5)) { // Focus on top 5 gaps
      // Training recommendations
      const trainings = this.getTrainingSuggestions(gap.skillName, gap.currentScore);
      trainings.forEach(training => {
        recommendations.push({
          type: 'training',
          priority: gap.priority,
          skill: gap.skillName,
          gap: gap.gap,
          ...training,
          reason: `Colmare gap di ${gap.gap} punti in ${gap.skillName}`
        });
      });

      // Mentoring for complex skills
      if (gap.complexity === 'high' && gap.gap > 20) {
        const mentoring = this.getMentoringSuggestions(gap.skillName);
        mentoring.forEach(mentor => {
          recommendations.push({
            type: 'mentoring',
            priority: gap.priority * 1.2, // Higher priority for mentoring
            skill: gap.skillName,
            gap: gap.gap,
            ...mentor,
            reason: `Supporto personalizzato per sviluppare ${gap.skillName}`
          });
        });
      }

      // Project assignments for practical skills
      if (gap.gap <= 30 && userProfile.seniority >= 2) {
        const projects = this.getProjectSuggestions(gap.skillName);
        projects.forEach(project => {
          recommendations.push({
            type: 'project',
            priority: gap.priority * 0.9,
            skill: gap.skillName,
            gap: gap.gap,
            ...project,
            reason: `Esperienza pratica per migliorare ${gap.skillName}`
          });
        });
      }

      // Reading suggestions for all
      const readings = this.getReadingSuggestions(gap.skillName);
      readings.forEach(reading => {
        recommendations.push({
          type: 'reading',
          priority: gap.priority * 0.7,
          skill: gap.skillName,
          gap: gap.gap,
          ...reading,
          reason: `Approfondimento teorico su ${gap.skillName}`
        });
      });
    }

    return recommendations;
  }

  /**
   * Genera raccomandazioni per sfruttare punti di forza
   */
  generateStrengthRecommendations(strengths, userProfile) {
    const recommendations = [];

    strengths.forEach(strength => {
      // Suggest advanced training for strengths
      const advancedTraining = this.getAdvancedTraining(strength.skillName);
      if (advancedTraining) {
        recommendations.push({
          type: 'training',
          priority: 50, // Lower priority than gaps
          skill: strength.skillName,
          ...advancedTraining,
          reason: `Portare ${strength.skillName} a livello expert`
        });
      }

      // Suggest mentoring others as a way to reinforce strength
      if (userProfile.seniority >= 3) {
        recommendations.push({
          type: 'mentoring',
          priority: 40,
          skill: strength.skillName,
          title: `Diventa mentor per ${strength.skillName}`,
          description: 'Condividi la tua expertise mentorando colleghi junior',
          duration: '2 hours/month',
          reason: `Rafforzare e condividere expertise in ${strength.skillName}`
        });
      }

      // Suggest stretch projects
      const stretchProjects = this.getStretchProjects(strength.skillName);
      stretchProjects.forEach(project => {
        recommendations.push({
          type: 'project',
          priority: 45,
          skill: strength.skillName,
          ...project,
          reason: `Applicare ${strength.skillName} a sfide complesse`
        });
      });
    });

    return recommendations;
  }

  /**
   * Calcola priorità del gap
   */
  calculateGapPriority(gap, importance = 'medium') {
    const importanceMultiplier = {
      'critical': 1.5,
      'high': 1.2,
      'medium': 1.0,
      'low': 0.8
    };

    // Base priority on gap size
    let priority = gap;

    // Adjust for importance
    priority *= importanceMultiplier[importance] || 1.0;

    // Cap at 100
    return Math.min(priority, 100);
  }

  /**
   * Get training suggestions for skill
   */
  getTrainingSuggestions(skillName, currentScore) {
    const trainings = this.recommendationDatabase.training[skillName] || [];

    // Filter by appropriate level
    return trainings.filter(training => {
      if (currentScore < 40) return training.level === 'beginner';
      if (currentScore < 70) return training.level === 'intermediate';
      return training.level === 'advanced';
    }).slice(0, 2); // Max 2 training suggestions per skill
  }

  /**
   * Get mentoring suggestions
   */
  getMentoringSuggestions(skillName) {
    return this.recommendationDatabase.mentoring[skillName] || [];
  }

  /**
   * Get project suggestions
   */
  getProjectSuggestions(skillName) {
    return this.recommendationDatabase.projects[skillName] || [];
  }

  /**
   * Get reading suggestions
   */
  getReadingSuggestions(skillName) {
    return this.recommendationDatabase.reading[skillName] || [];
  }

  /**
   * Get advanced training for strengths
   */
  getAdvancedTraining(skillName) {
    const trainings = this.recommendationDatabase.training[skillName] || [];
    return trainings.find(t => t.level === 'advanced');
  }

  /**
   * Get stretch projects for strengths
   */
  getStretchProjects(skillName) {
    const projects = this.recommendationDatabase.projects[skillName] || [];
    return projects.filter(p => p.complexity === 'high');
  }

  /**
   * Prioritize recommendations
   */
  prioritizeRecommendations(recommendations, userProfile) {
    // Sort by priority
    recommendations.sort((a, b) => b.priority - a.priority);

    // Apply user preferences
    if (userProfile.learningPreference === 'self-paced') {
      // Boost online and reading recommendations
      recommendations.forEach(rec => {
        if (rec.format === 'online' || rec.type === 'reading') {
          rec.priority *= 1.1;
        }
      });
    } else if (userProfile.learningPreference === 'interactive') {
      // Boost workshop and mentoring recommendations
      recommendations.forEach(rec => {
        if (rec.format === 'workshop' || rec.type === 'mentoring') {
          rec.priority *= 1.1;
        }
      });
    }

    // Re-sort after adjustments
    recommendations.sort((a, b) => b.priority - a.priority);

    // Return top 10 recommendations
    return recommendations.slice(0, 10);
  }

  /**
   * Enrich recommendations with additional metadata
   */
  async enrichRecommendations(recommendations, userId) {
    const enriched = [];

    for (const rec of recommendations) {
      // Add unique ID
      rec.id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add difficulty level
      rec.difficulty = this.calculateDifficulty(rec);

      // Add estimated impact
      rec.estimatedImpact = this.calculateImpact(rec);

      // Add availability check
      rec.available = await this.checkAvailability(rec, userId);

      // Add tracking ID for analytics
      rec.trackingId = `${userId}_${rec.skill}_${rec.type}_${Date.now()}`;

      enriched.push(rec);
    }

    return enriched;
  }

  /**
   * Calculate difficulty level
   */
  calculateDifficulty(recommendation) {
    if (recommendation.level === 'beginner' || recommendation.complexity === 'low') {
      return 'easy';
    }
    if (recommendation.level === 'advanced' || recommendation.complexity === 'high') {
      return 'hard';
    }
    return 'medium';
  }

  /**
   * Calculate estimated impact
   */
  calculateImpact(recommendation) {
    // Higher gap = higher impact
    const gapImpact = recommendation.gap ? recommendation.gap / 100 : 0.5;

    // Type multipliers
    const typeMultiplier = {
      'mentoring': 1.3,
      'project': 1.2,
      'training': 1.0,
      'reading': 0.8
    };

    const impact = gapImpact * (typeMultiplier[recommendation.type] || 1.0);

    if (impact > 0.8) return 'high';
    if (impact > 0.5) return 'medium';
    return 'low';
  }

  /**
   * Check availability of recommendation
   */
  async checkAvailability(recommendation, userId) {
    // Check if user has already taken this recommendation
    try {
      const existing = await prisma.userRecommendation.findFirst({
        where: {
          userId,
          recommendationTitle: recommendation.title,
          status: { in: ['accepted', 'completed'] }
        }
      });

      return !existing;
    } catch (error) {
      return true; // Default to available
    }
  }

  /**
   * Get target profile for role
   */
  async getTargetProfile(role, seniority) {
    // Default target profiles
    const profiles = {
      'Manager': {
        'Leadership': { minScore: 75, importance: 'high', complexity: 'high' },
        'Communication': { minScore: 80, importance: 'high', complexity: 'medium' },
        'Decision Making': { minScore: 70, importance: 'high', complexity: 'high' },
        'Team Management': { minScore: 75, importance: 'critical', complexity: 'high' },
        'Problem Solving': { minScore: 70, importance: 'medium', complexity: 'medium' }
      },
      'Developer': {
        'Problem Solving': { minScore: 80, importance: 'high', complexity: 'medium' },
        'Communication': { minScore: 65, importance: 'medium', complexity: 'medium' },
        'Team Work': { minScore: 70, importance: 'high', complexity: 'low' },
        'Innovation': { minScore: 75, importance: 'high', complexity: 'high' },
        'Technical Skills': { minScore: 85, importance: 'critical', complexity: 'high' }
      },
      'HR': {
        'Communication': { minScore: 85, importance: 'critical', complexity: 'medium' },
        'Empathy': { minScore: 80, importance: 'high', complexity: 'medium' },
        'Problem Solving': { minScore: 70, importance: 'medium', complexity: 'medium' },
        'Leadership': { minScore: 65, importance: 'medium', complexity: 'high' },
        'Organization': { minScore: 75, importance: 'high', complexity: 'low' }
      }
    };

    // Adjust for seniority
    const profile = profiles[role] || profiles['Developer'];

    if (seniority > 5) {
      // Increase requirements for senior positions
      Object.keys(profile).forEach(skill => {
        profile[skill].minScore += 10;
      });
    }

    return profile;
  }

  /**
   * Save recommendations to database
   */
  async saveRecommendations(userId, assessmentId, recommendations) {
    try {
      for (const rec of recommendations) {
        await prisma.userRecommendation.create({
          data: {
            userId,
            assessmentId,
            type: rec.type,
            recommendationTitle: rec.title,
            description: rec.description,
            skill: rec.skill,
            priority: rec.priority,
            estimatedTime: rec.estimatedTime || rec.duration,
            link: rec.link,
            difficulty: rec.difficulty,
            impact: rec.estimatedImpact,
            reason: rec.reason,
            status: 'pending',
            createdAt: new Date()
          }
        });
      }

      console.log(`Saved ${recommendations.length} recommendations for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error saving recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate action plan from recommendations
   */
  async generateActionPlan(userId, recommendations) {
    const actionPlan = {
      userId,
      createdAt: new Date(),
      shortTerm: [], // 0-3 months
      mediumTerm: [], // 3-6 months
      longTerm: [], // 6-12 months
      quickWins: [] // Can start immediately
    };

    recommendations.forEach(rec => {
      // Categorize by time and effort
      if (rec.type === 'reading' || (rec.estimatedTime && rec.estimatedTime.includes('hour'))) {
        actionPlan.quickWins.push(rec);
      } else if (rec.duration && rec.duration.includes('month')) {
        const months = parseInt(rec.duration);
        if (months <= 3) {
          actionPlan.shortTerm.push(rec);
        } else if (months <= 6) {
          actionPlan.mediumTerm.push(rec);
        } else {
          actionPlan.longTerm.push(rec);
        }
      } else if (rec.priority > 70) {
        actionPlan.shortTerm.push(rec);
      } else if (rec.priority > 50) {
        actionPlan.mediumTerm.push(rec);
      } else {
        actionPlan.longTerm.push(rec);
      }
    });

    return actionPlan;
  }
}

module.exports = new RecommendationEngine();