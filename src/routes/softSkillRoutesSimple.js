const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// For now, return mock data until the controller is fixed
// This allows the frontend to work while we fix the backend

// =============== PUBLIC ROUTES ===============

// Get all soft skills
router.get('/skills', async (req, res) => {
  try {
    // Return the 12 soft skills we have in the database
    const mockSkills = [
      {
        id: '1',
        code: 'communication',
        name: 'Comunicazione',
        nameEn: 'Communication',
        category: 'comunicazione',
        description: 'Capacità di trasmettere informazioni in modo chiaro ed efficace',
        descriptionEn: 'Ability to transmit information clearly and effectively',
        indicators: ['Chiarezza espositiva', 'Ascolto attivo', 'Comunicazione scritta'],
        weight: 10,
        assessmentMethods: ['Big Five', 'DiSC', 'Intervista'],
        developmentStrategies: ['Corsi di public speaking', 'Workshop comunicazione']
      },
      {
        id: '2',
        code: 'leadership',
        name: 'Leadership',
        nameEn: 'Leadership',
        category: 'leadership',
        description: 'Capacità di guidare e motivare un team verso obiettivi comuni',
        descriptionEn: 'Ability to guide and motivate a team towards common goals',
        indicators: ['Visione strategica', 'Delega efficace', 'Motivazione team'],
        weight: 12,
        assessmentMethods: ['Belbin', 'DiSC', '360 Feedback'],
        developmentStrategies: ['Mentoring', 'Leadership training']
      },
      {
        id: '3',
        code: 'problem_solving',
        name: 'Problem Solving',
        nameEn: 'Problem Solving',
        category: 'problem_solving',
        description: 'Capacità di analizzare problemi complessi e trovare soluzioni efficaci',
        descriptionEn: 'Ability to analyze complex problems and find effective solutions',
        indicators: ['Analisi critica', 'Creatività', 'Decision making'],
        weight: 11,
        assessmentMethods: ['Assessment cognitivo', 'Case study'],
        developmentStrategies: ['Workshop problem solving', 'Simulazioni']
      },
      {
        id: '4',
        code: 'teamwork',
        name: 'Lavoro di squadra',
        nameEn: 'Teamwork',
        category: 'comunicazione',
        description: 'Capacità di collaborare efficacemente con altri membri del team',
        descriptionEn: 'Ability to collaborate effectively with other team members',
        indicators: ['Collaborazione', 'Supporto reciproco', 'Condivisione conoscenze'],
        weight: 9,
        assessmentMethods: ['Belbin', 'Osservazione diretta'],
        developmentStrategies: ['Team building', 'Progetti di gruppo']
      },
      {
        id: '5',
        code: 'adaptability',
        name: 'Adattabilità',
        nameEn: 'Adaptability',
        category: 'adattabilita',
        description: 'Capacità di adattarsi a nuove situazioni e cambiamenti',
        descriptionEn: 'Ability to adapt to new situations and changes',
        indicators: ['Flessibilità', 'Gestione del cambiamento', 'Apprendimento continuo'],
        weight: 8,
        assessmentMethods: ['Big Five', 'Intervista comportamentale'],
        developmentStrategies: ['Change management training', 'Job rotation']
      },
      {
        id: '6',
        code: 'time_management',
        name: 'Gestione del tempo',
        nameEn: 'Time Management',
        category: 'problem_solving',
        description: 'Capacità di organizzare e prioritizzare le attività',
        descriptionEn: 'Ability to organize and prioritize activities',
        indicators: ['Pianificazione', 'Prioritizzazione', 'Rispetto scadenze'],
        weight: 7,
        assessmentMethods: ['Self-assessment', 'Osservazione'],
        developmentStrategies: ['Time management tools', 'Coaching']
      },
      {
        id: '7',
        code: 'creativity',
        name: 'Creatività',
        nameEn: 'Creativity',
        category: 'problem_solving',
        description: 'Capacità di generare idee innovative e soluzioni originali',
        descriptionEn: 'Ability to generate innovative ideas and original solutions',
        indicators: ['Pensiero laterale', 'Innovazione', 'Originalità'],
        weight: 8,
        assessmentMethods: ['Test creatività', 'Portfolio review'],
        developmentStrategies: ['Workshop creatività', 'Brainstorming sessions']
      },
      {
        id: '8',
        code: 'emotional_intelligence',
        name: 'Intelligenza emotiva',
        nameEn: 'Emotional Intelligence',
        category: 'comunicazione',
        description: 'Capacità di riconoscere e gestire le proprie e altrui emozioni',
        descriptionEn: 'Ability to recognize and manage own and others emotions',
        indicators: ['Autoconsapevolezza', 'Empatia', 'Gestione emozioni'],
        weight: 9,
        assessmentMethods: ['EQ-i 2.0', 'Big Five'],
        developmentStrategies: ['Mindfulness', 'Emotional intelligence training']
      },
      {
        id: '9',
        code: 'decision_making',
        name: 'Capacità decisionale',
        nameEn: 'Decision Making',
        category: 'leadership',
        description: 'Capacità di prendere decisioni efficaci e tempestive',
        descriptionEn: 'Ability to make effective and timely decisions',
        indicators: ['Analisi delle opzioni', 'Valutazione rischi', 'Decisioni tempestive'],
        weight: 10,
        assessmentMethods: ['Case study', 'Simulazioni'],
        developmentStrategies: ['Decision making framework', 'Scenario planning']
      },
      {
        id: '10',
        code: 'conflict_resolution',
        name: 'Gestione conflitti',
        nameEn: 'Conflict Resolution',
        category: 'leadership',
        description: 'Capacità di gestire e risolvere conflitti in modo costruttivo',
        descriptionEn: 'Ability to manage and resolve conflicts constructively',
        indicators: ['Mediazione', 'Negoziazione', 'Risoluzione costruttiva'],
        weight: 8,
        assessmentMethods: ['Role playing', 'Intervista'],
        developmentStrategies: ['Conflict resolution training', 'Mediazione']
      },
      {
        id: '11',
        code: 'resilience',
        name: 'Resilienza',
        nameEn: 'Resilience',
        category: 'adattabilita',
        description: 'Capacità di affrontare e superare difficoltà e stress',
        descriptionEn: 'Ability to face and overcome difficulties and stress',
        indicators: ['Gestione stress', 'Recupero', 'Persistenza'],
        weight: 7,
        assessmentMethods: ['Connor-Davidson Scale', 'Big Five'],
        developmentStrategies: ['Stress management', 'Resilience training']
      },
      {
        id: '12',
        code: 'learning_agility',
        name: 'Agilità di apprendimento',
        nameEn: 'Learning Agility',
        category: 'adattabilita',
        description: 'Capacità di apprendere rapidamente nuove competenze',
        descriptionEn: 'Ability to quickly learn new skills',
        indicators: ['Velocità apprendimento', 'Applicazione conoscenze', 'Curiosità'],
        weight: 8,
        assessmentMethods: ['Learning agility assessment', 'Performance review'],
        developmentStrategies: ['Learning paths', 'Stretch assignments']
      }
    ];

    res.json({
      success: true,
      data: mockSkills
    });
  } catch (error) {
    console.error('Error in GET /skills:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single soft skill
router.get('/skills/:id', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.params.id,
        code: 'communication',
        name: 'Comunicazione',
        nameEn: 'Communication',
        category: 'comunicazione',
        description: 'Capacità di trasmettere informazioni in modo chiaro ed efficace'
      }
    });
  } catch (error) {
    console.error('Error in GET /skills/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get skills for a specific role
router.get('/roles/:roleId/skills', async (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

// Get roles that require a specific skill
router.get('/skills/:skillId/roles', async (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

// =============== AUTHENTICATED ROUTES ===============

// Placeholder for authenticated routes
router.post('/skills', authMiddleware, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Not implemented yet'
  });
});

router.put('/skills/:id', authMiddleware, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Not implemented yet'
  });
});

module.exports = router;