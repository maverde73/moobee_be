require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const roleRoutes = require('./routes/roleRoutes');
const subRolesRoutes = require('./routes/subRolesRoutes');
const unifiedAuthRoutes = require('./routes/unifiedAuthRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const aiRoutes = require('./routes/aiRoutes');
const cvRoutes = require('./routes/cvRoutes');
const internalRoutes = require('./routes/internalRoutes');
const mcpProxyRoutes = require('./routes/mcpProxyRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - Dynamic based on environment
// IMPORTANT: CORS must be before helmet to ensure headers are set correctly
const corsOriginEnv = process.env.CORS_ORIGIN || '*';
const allowedOrigins = corsOriginEnv === '*'
  ? '*'
  : corsOriginEnv.split(',').map(o => o.trim());

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Security middleware (after CORS)
app.use(helmet());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 10000 : 100), // higher limit in dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for CV extraction status polling (ALL environments)
    // This endpoint is polled every 2-5 seconds during extraction (~3-5 min)
    if (req.path.includes('/cv/extraction-status/')) {
      return true;
    }

    // Skip rate limiting for certain endpoints in development
    if (process.env.NODE_ENV === 'development') {
      // Skip for assessment endpoints
      if (req.path.includes('/assessments/templates')) {
        return true;
      }
      // Skip for engagement endpoints
      if (req.path.includes('/engagement/')) {
        return true;
      }
      // Skip for unified calendar endpoints
      if (req.path.includes('/unified/')) {
        return true;
      }
      // Skip for tenant users endpoints
      if (req.path.includes('/tenants/')) {
        return true;
      }
      // Skip for roles endpoints
      if (req.path.includes('/roles')) {
        return true;
      }
      // Skip for employees endpoints
      if (req.path.includes('/employees')) {
        return true;
      }
      // Skip for tenant-users endpoints
      if (req.path.includes('/tenant-users')) {
        return true;
      }
    }
    return false;
  }
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Internal API routes (NO rate limiting, NO auth - trusted Python backend)
// MUST be mounted AFTER rate limiter to bypass it
app.use('/api/internal', internalRoutes);

// MCP Proxy routes (WITH auth, WITH rate limiting)
// Initialize MCP configuration on server start
const { initializeConfig } = require('./config/mcpRbacRules');
try {
  initializeConfig();
  console.log('✅ MCP RBAC configuration loaded successfully');
} catch (error) {
  console.error('❌ Failed to load MCP RBAC configuration:', error.message);
  console.error('   MCP Proxy will not be available');
}
app.use('/api', mcpProxyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API version endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Moobee API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      employees: '/api/employees',
      roles: '/api/roles'
    }
  });
});

// Import admin and tenant routes
const { router: adminRoutes } = require('./routes/adminRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const tenantUserRoutes = require('./routes/tenantUserRoutes');

// Mount routes
app.use('/api/auth', authRoutes); // Legacy employee auth
app.use('/api/employees', employeeRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/sub-roles', subRolesRoutes); // Sub-roles search and retrieval
app.use('/api/admin', adminRoutes); // Legacy admin auth
app.use('/api/tenants', tenantRoutes);
app.use('/api', tenantUserRoutes); // Mounted at /api because routes include /tenants/:id/users
app.use('/api', unifiedAuthRoutes); // New unified auth system
app.use('/api/dashboard', dashboardRoutes);

// HR Dashboard aggregated stats
const hrDashboardRoutes = require('./routes/hrDashboardRoutes');
app.use('/api/hr', hrDashboardRoutes);
// Assessment routes (include /api/admin/assessment-catalog) - DISABLED FOR NOW
// app.use('/', assessmentRoutes);

// DEBUG: Log ALL incoming requests for AI generation
app.use((req, res, next) => {
  if (req.path.includes('/ai/generate-questions')) {
    const fs = require('fs');
    fs.appendFileSync('/tmp/moobee_debug.log', `\n[${new Date().toISOString()}] INCOMING REQUEST\n`);
    fs.appendFileSync('/tmp/moobee_debug.log', `  Method: ${req.method}\n`);
    fs.appendFileSync('/tmp/moobee_debug.log', `  Path: ${req.path}\n`);
    fs.appendFileSync('/tmp/moobee_debug.log', `  URL: ${req.url}\n`);
    fs.appendFileSync('/tmp/moobee_debug.log', `  Has Authorization: ${!!req.headers.authorization}\n`);
  }
  next();
});

// New Assessment API routes
const assessmentAPIRoutes = require('./routes/assessmentAPIRoutes');
app.use('/api/assessments', assessmentAPIRoutes);

// Role-Based Assessment routes
const roleBasedAssessmentRoutes = require('./routes/roleBasedAssessmentRoutes');
app.use('/api/assessments', roleBasedAssessmentRoutes);
app.use('/api', roleBasedAssessmentRoutes); // Also mount at /api for routes like /roles/:id/skill-requirements

// Analytics routes (Super Admin LLM Analytics + Regular Analytics)
const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/analytics', analyticsRoutes);

// Engagement routes
app.use('/api/engagement', engagementRoutes);

// AI routes (integration with Python backend)
app.use('/api/ai', aiRoutes);

// CV Extractor routes
app.use('/api/cv', cvRoutes);

// Campaign routes
const campaignRoutes = require('./routes/campaignRoutes');
app.use('/api/engagement', campaignRoutes);

// Campaign Assignment routes (optimized view)
const campaignAssignmentRoutes = require('./routes/campaignAssignmentRoutes');
app.use('/api/campaign-assignments', campaignAssignmentRoutes);

// Assessment Campaign routes
const assessmentCampaignRoutes = require('./routes/assessmentCampaignRoutes');
app.use('/api/assessment/campaigns', assessmentCampaignRoutes);

// Unified Calendar routes
const unifiedRoutes = require('./routes/unifiedRoutes');
app.use('/api/unified', unifiedRoutes);

// Soft Skills routes (catalog)
const softSkillRoutes = require('./routes/softSkillRoutesSimple');
app.use('/api/soft-skills', softSkillRoutes);

// Soft Skills routes (user scores, radar, history, assessments)
const softSkillsRoutes = require('./routes/softSkillsRoutes');
app.use('/api', softSkillsRoutes);

// Role Soft Skills routes
const roleSoftSkillsController = require('./controllers/roleSoftSkillsController');
app.get('/api/roles/:id/soft-skills', roleSoftSkillsController.getRoleSoftSkills);
app.get('/api/roles/soft-skills', roleSoftSkillsController.getAllRolesSoftSkills);

// Project Management routes
const projectRoutes = require('./routes/projectRoutes');
app.use('/api/projects', projectRoutes);

// Project Role routes
const projectRoleRoutes = require('./routes/projectRoleRoutes');
app.use('/api', projectRoleRoutes);

// Matching routes
const matchingRoutes = require('./routes/matchingRoutes');
app.use('/api', matchingRoutes);

// Certification routes
const certificationRoutes = require('./routes/certificationRoutes');
app.use('/api/certifications', certificationRoutes);

// Skills routes
const skillsRoutes = require('./routes/skillsRoutes');
app.use('/api/skills', skillsRoutes);

// Job Family routes
const jobFamilyRoutes = require('./routes/jobFamilyRoutes');
app.use('/api/job-families', jobFamilyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Handle Prisma errors
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      message: 'Duplicate value error',
      field: err.meta?.target
    });
  }

  if (err.code === 'P2003') {
    return res.status(400).json({
      success: false,
      message: 'Foreign key constraint error',
      field: err.meta?.field_name
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server only if this is the main module
if (require.main === module) {
  // Bind to all interfaces on Railway/production, localhost in development
  const HOST = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  // CV Worker flag (module scope for SIGTERM handler access)
  let isCVWorkerStarted = false;

  const server = app.listen(PORT, HOST, () => {
    console.log(`
    🚀 Server is running!
    🔊 Listening on ${HOST}:${PORT}
    📱 Environment: ${process.env.NODE_ENV || 'development'}
    🏥 Health check: http://localhost:${PORT}/health
    📚 API Base: http://localhost:${PORT}/api
  `);

    // Start CV Extraction Background Worker (if enabled)
    const startWorker = process.env.START_CV_WORKER !== 'false'; // Default: true
    if (startWorker) {
      const { startWorker: startCVWorker } = require('./services/cvExtractionBackgroundWorker');
      const workerInterval = parseInt(process.env.CV_WORKER_INTERVAL_MS) || 10000; // Default: 10s
      startCVWorker(workerInterval);
      isCVWorkerStarted = true; // Set flag for SIGTERM handler
      console.log(`✅ CV Extraction Background Worker started (polling every ${workerInterval / 1000}s)`);
    } else {
      console.log('⚠️  CV Extraction Background Worker disabled (START_CV_WORKER=false)');
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');

    // Stop CV worker
    if (isCVWorkerStarted) {
      const { stopWorker } = require('./services/cvExtractionBackgroundWorker');
      stopWorker();
    }

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

module.exports = app;