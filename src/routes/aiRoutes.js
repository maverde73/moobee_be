/**
 * AI Routes
 * All AI/ML endpoints that integrate with Python backend
 * These routes ensure all database writes happen through Node.js
 */

const router = require('express').Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { determineTenant } = require('../middleware/tenantMiddleware');
const { authorize } = require('../middleware/roleAuth');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(), // Store in memory for processing
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/rtf',
            'text/rtf',
            'application/vnd.oasis.opendocument.text'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT, RTF, ODT'));
        }
    }
});

// Apply authentication to all AI routes
router.use(authenticate);
router.use(determineTenant);

/**
 * CV Analysis Endpoints
 */

// Analyze CV and extract skills/seniority
// Supports both text input and file upload
router.post('/cv/analyze',
    authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
    upload.single('cv_file'), // Field name for file upload
    aiController.analyzeCv
);

/**
 * Scoring Endpoints
 */

// Calculate skill-role scoring
router.post('/scoring/calculate',
    authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
    aiController.calculateScoring
);

// Run batch tournaments
router.post('/scoring/batch-tournament',
    authorize(['ADMIN', 'SUPER_ADMIN']),
    aiController.runBatchTournament
);

/**
 * RAG/Vector Search Endpoints
 */

// Semantic search for skills/roles
router.post('/rag/search',
    authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR', 'EMPLOYEE']),
    aiController.vectorSearch
);

/**
 * Skills Management Endpoints
 */

// Enrich skills with metadata
router.post('/skills/enrich',
    authorize(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR']),
    aiController.enrichSkills
);

/**
 * Health Check
 */

// Check AI services health
router.get('/health',
    aiController.healthCheck
);

module.exports = router;