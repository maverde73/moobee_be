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
const unifiedAuthRoutes = require('./routes/unifiedAuthRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const engagementRoutes = require('./routes/engagementRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration - Dynamic based on environment
const corsOptions = {
  origin: function(origin, callback) {
    // Get allowed origins from environment variable or use defaults
    const corsOrigin = process.env.CORS_ORIGIN || '*';

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // If CORS_ORIGIN is '*', allow all origins (development only)
    if (corsOrigin === '*') {
      return callback(null, true);
    }

    // Parse comma-separated origins
    const allowedOrigins = corsOrigin.split(',').map(o => o.trim());

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow all; in production, reject
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

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
app.use('/api/admin', adminRoutes); // Legacy admin auth
app.use('/api/tenants', tenantRoutes);
app.use('/api', tenantUserRoutes); // Mounted at /api because routes include /tenants/:id/users
app.use('/api', unifiedAuthRoutes); // New unified auth system
app.use('/api/dashboard', dashboardRoutes);
// Assessment routes (include /api/admin/assessment-catalog) - DISABLED FOR NOW
// app.use('/', assessmentRoutes);

// New Assessment API routes
const assessmentAPIRoutes = require('./routes/assessmentAPIRoutes');
app.use('/api/assessments', assessmentAPIRoutes);

// Role-Based Assessment routes
const roleBasedAssessmentRoutes = require('./routes/roleBasedAssessmentRoutes');
app.use('/api/assessments', roleBasedAssessmentRoutes);
app.use('/api', roleBasedAssessmentRoutes); // Also mount at /api for routes like /roles/:id/skill-requirements

// Analytics routes
const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/assessments/analytics', analyticsRoutes);

// Engagement routes
app.use('/api/engagement', engagementRoutes);

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

// Soft Skills routes - temporarily disabled
// const softSkillRoutes = require('./routes/softSkillRoutesSimple');
// app.use('/api/soft-skills', softSkillRoutes);

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

  const server = app.listen(PORT, HOST, () => {
    console.log(`
    🚀 Server is running!
    🔊 Listening on ${HOST}:${PORT}
    📱 Environment: ${process.env.NODE_ENV || 'development'}
    🏥 Health check: http://localhost:${PORT}/health
    📚 API Base: http://localhost:${PORT}/api
  `);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

module.exports = app;