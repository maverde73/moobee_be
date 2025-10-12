/**
 * CV Extractor API Routes
 * Data: 30 Settembre 2025, 18:40
 * Updated: 6 October 2025, 15:50 - Added extract-and-save endpoint
 *
 * Endpoints for CV upload, analysis, and retrieval
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const CVDataService = require('../services/cvDataService');
const CVExtractionService = require('../services/cvExtractionService');
const CVDataSaveService = require('../services/cvDataSaveService');
const { processExtractionInBackground } = require('../services/cvExtractionBackgroundJob');
const { authenticate } = require('../middlewares/authMiddleware');
const { getCVStorageService } = require('../services/cvStorageService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/cv');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: function (req, file, cb) {
    // Accept PDF and DOCX only
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

// Background job moved to /src/services/cvExtractionBackgroundJob.js for better code organization

/**
 * POST /api/cv/analyze
 * Upload and analyze a CV file
 *
 * Body (multipart/form-data):
 * - cv_file: File (PDF or DOCX)
 * - employeeId: number
 * - tenantId: string (UUID)
 */
router.post('/analyze', upload.single('cv_file'), async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('=== CV Analysis Request ===');

    // Validate input
    const { employeeId, tenantId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No CV file uploaded'
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'employeeId is required'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required'
      });
    }

    console.log(`Processing CV for employee ${employeeId}, tenant ${tenantId}`);
    console.log(`File: ${file.originalname} (${file.size} bytes)`);

    // 1. Call Python extraction service
    console.log('Calling Python CV extraction service...');

    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype
    });

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8001';

    let pythonResponse;
    try {
      pythonResponse = await axios.post(
        `${pythonApiUrl}/api/cv/extract-mvp`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 120000 // 2 minute timeout
        }
      );
    } catch (pythonError) {
      console.error('Python service error:', pythonError.message);

      // Clean up uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return res.status(500).json({
        success: false,
        error: 'CV extraction service error',
        details: pythonError.message
      });
    }

    const cvResult = pythonResponse.data;
    console.log('Python extraction completed successfully');

    // 2. Save extraction result to database
    console.log('Saving extraction to database...');

    const extraction = await CVDataService.saveCVExtraction(
      parseInt(employeeId),
      tenantId,
      cvResult,
      {
        originalname: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      }
    );

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`CV analysis completed in ${processingTime}s`);

    // Return success response
    res.json({
      success: true,
      extraction_id: extraction.id,
      status: 'completed',
      processing_time: processingTime,
      data: {
        personal_info: cvResult.personal_info,
        education_count: cvResult.education?.length || 0,
        work_experience_count: cvResult.work_experience?.length || 0
      }
    });

  } catch (error) {
    console.error('CV analysis error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze CV',
      details: error.message
    });
  }
});

/**
 * GET /api/cv/extractions/:id
 * Get a specific CV extraction by ID
 *
 * Params:
 * - id: Extraction UUID
 */
router.get('/extractions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Fetching extraction ${id}`);

    const extraction = await CVDataService.getExtraction(id);

    if (!extraction) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    res.json({
      success: true,
      data: extraction
    });

  } catch (error) {
    console.error('Error fetching extraction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch extraction',
      details: error.message
    });
  }
});

/**
 * GET /api/cv/employee/:employeeId
 * Get all CV extractions for a specific employee
 *
 * Params:
 * - employeeId: Employee ID
 *
 * Query:
 * - tenantId: Tenant ID (required for filtering)
 */
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId query parameter is required'
      });
    }

    console.log(`Fetching extractions for employee ${employeeId}, tenant ${tenantId}`);

    const extractions = await CVDataService.getEmployeeExtractions(
      parseInt(employeeId),
      tenantId
    );

    res.json({
      success: true,
      count: extractions.length,
      data: extractions
    });

  } catch (error) {
    console.error('Error fetching employee extractions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee extractions',
      details: error.message
    });
  }
});

/**
 * DELETE /api/cv/extractions/:id
 * Soft delete a CV extraction
 *
 * Params:
 * - id: Extraction UUID
 */
router.delete('/extractions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // Who is deleting

    console.log(`Soft deleting extraction ${id}`);

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const extraction = await prisma.cv_extractions.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: userId || null
      }
    });

    res.json({
      success: true,
      message: 'Extraction deleted successfully',
      data: extraction
    });

  } catch (error) {
    console.error('Error deleting extraction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete extraction',
      details: error.message
    });
  }
});

/**
 * POST /api/cv/upload
 * Simple file upload endpoint
 * Used by Employee Profile page for CV upload
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { employee_id } = req.body;

    console.log(`[CV Upload] Received upload for employee ${employee_id}`);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log(`[CV Upload] File saved: ${req.file.filename} (${req.file.size} bytes)`);

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        filePath: req.file.path,
        uploadDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[CV Upload] Error uploading CV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload CV',
      error: error.message
    });
  }
});

/**
 * POST /api/cv/extract-and-save
 * Start CV extraction in background (async)
 * Returns immediately - extraction happens in background
 *
 * Body:
 * {
 *   employee_id: number
 * }
 */
router.post('/extract-and-save', authenticate, async (req, res) => {
  try {
    const { employee_id } = req.body;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    console.log(`[CV Extraction] Starting async extraction for employee ${employee_id}`);

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'employee_id is required'
      });
    }

    // Find the most recent cv_extraction record for this employee
    const latestExtraction = await prisma.cv_extractions.findFirst({
      where: {
        employee_id: parseInt(employee_id),
        status: 'pending' // Only process pending extractions
      },
      orderBy: { created_at: 'desc' }
    });

    if (!latestExtraction) {
      return res.status(404).json({
        success: false,
        message: 'No pending CV found. Please upload a CV first.'
      });
    }

    // Check if cv_files record exists (volume storage)
    const cvFile = await prisma.cv_files.findUnique({
      where: { extraction_id: latestExtraction.id }
    });

    if (!cvFile) {
      return res.status(400).json({
        success: false,
        message: 'CV file not found in storage. Please upload a CV first.'
      });
    }

    console.log(`[CV Extraction] Found cv_extraction ${latestExtraction.id} with file at ${cvFile.file_path}`);

    // Update status to 'processing' immediately
    await prisma.cv_extractions.update({
      where: { id: latestExtraction.id },
      data: {
        status: 'processing',
        updated_at: new Date()
      }
    });

    // Return immediately - extraction will happen in background
    res.json({
      success: true,
      jobId: latestExtraction.id,
      message: 'CV extraction started in background. Check status with GET /api/employees/:id/cv-extraction-status'
    });

    // Start extraction in background (non-blocking)
    processExtractionInBackground(latestExtraction, prisma).catch(error => {
      console.error(`[CV Extraction] Background error for extraction ${latestExtraction.id}:`, error);
    });
  } catch (error) {
    console.error('[CV Extraction] Error in extract-and-save:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract and save CV data',
      error: error.message
    });
  }
});

/**
 * POST /api/cv/extract-mvp
 * Upload CV and start extraction in background
 * NEW ENDPOINT for polling-based notification system
 *
 * Body (multipart/form-data):
 * - file: PDF file
 * - employee_id: number
 * - user_id: number (optional)
 */
const { PrismaClient } = require('@prisma/client');
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/extract-mvp', authenticate, uploadMemory.single('file'), async (req, res) => {
  const prisma = new PrismaClient();

  try {
    const { employee_id, user_id } = req.body;
    const file = req.file;

    if (!file || !employee_id) {
      return res.status(400).json({
        success: false,
        error: 'File and employee_id are required'
      });
    }

    // Get tenant_id from authenticated user
    console.log('[CV Upload] req.user:', JSON.stringify(req.user, null, 2));
    const tenant_id = req.user?.tenant_id || req.user?.tenantId;
    if (!tenant_id) {
      console.error('[CV Upload] tenant_id not found in req.user');
      return res.status(400).json({
        success: false,
        error: 'tenant_id not found in authentication token'
      });
    }

    console.log(`[CV Upload] Employee ${employee_id}, File: ${file.originalname} (${file.size} bytes), Tenant: ${tenant_id}`);

    // Create cv_extractions record with status='pending' (WITHOUT file_content)
    const extraction = await prisma.cv_extractions.create({
      data: {
        tenant_id,
        employee_id: parseInt(employee_id),
        original_filename: file.originalname,
        file_type: file.mimetype,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`[CV Upload] Extraction ${extraction.id} created with status=pending`);

    // Save file to volume storage (local or Railway)
    const storageService = getCVStorageService();
    const fileInfo = await storageService.saveFile(
      file.buffer,
      file.originalname,
      {
        extractionId: extraction.id,
        tenantId: tenant_id,
        mimeType: file.mimetype
      }
    );

    console.log(`[CV Upload] File saved to storage: ${fileInfo.filePath}`);

    // Create cv_files record with file path
    await prisma.cv_files.create({
      data: {
        extraction_id: extraction.id,
        tenant_id: tenant_id,
        file_path: fileInfo.filePath,
        file_size: fileInfo.fileSize,
        mime_type: fileInfo.mimeType,
        original_filename: fileInfo.originalFilename,
        uploaded_at: new Date()
      }
    });

    console.log(`[CV Upload] cv_files record created for extraction ${extraction.id}`);

    // Start background job (non-blocking)
    processExtractionInBackground(extraction, prisma).catch(error => {
      console.error(`[CV Upload] Background error for ${extraction.id}:`, error);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'CV upload iniziato. Estrazione in corso...',
      extraction_id: extraction.id,
      employee_id: parseInt(employee_id),
      status: 'pending'
    });

  } catch (error) {
    console.error('[CV Upload] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload CV',
      details: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/cv/extraction-status/:extractionId
 * Poll extraction status for frontend
 * NEW ENDPOINT for polling-based notification system
 *
 * NOTE: No rate limiter - this endpoint is polled frequently (every 2-5s)
 * Security: Still requires authentication via JWT token
 */
router.get('/extraction-status/:extractionId', authenticate, async (req, res) => {
  const prisma = new PrismaClient();

  try {
    const extractionId = req.params.extractionId; // UUID string, not integer

    const extraction = await prisma.cv_extractions.findUnique({
      where: { id: extractionId },
      select: {
        id: true,
        employee_id: true,
        status: true,
        import_stats: true,
        extraction_result: true,
        created_at: true,
        updated_at: true,
        error_message: true,
        error_phase: true
      }
    });

    if (!extraction) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(extraction.created_at).getTime()) / 1000);

    const response = {
      success: true,
      extraction_id: extraction.id,
      employee_id: extraction.employee_id,
      status: extraction.status,
      elapsed_seconds: elapsedSeconds,
      updated_at: extraction.updated_at
    };

    // Add status-specific data
    switch (extraction.status) {
      case 'pending':
        response.message = 'CV in attesa di elaborazione';
        response.progress = 10;
        break;

      case 'processing':
        response.message = 'Estrazione dati in corso...';
        response.progress = 50;
        break;

      case 'extracted':
        response.message = 'Dati estratti, importazione nel database...';
        response.progress = 75;
        break;

      case 'importing':
        response.message = 'Salvataggio dati nel database...';
        response.progress = 90;
        break;

      case 'completed':
        response.message = '✅ Importazione completata!';
        response.progress = 100;
        response.import_stats = extraction.import_stats;

        if (extraction.extraction_result) {
          const result = extraction.extraction_result;
          response.summary = {
            personal_info: result.personal_info,
            education_count: result.education?.length || 0,
            work_experience_count: result.work_experience?.length || 0,
            skills_count: result.skills?.extracted_skills?.length || 0,
            languages_count: result.languages?.length || 0,
            certifications_count: result.certifications?.length || 0
          };
        }
        break;

      case 'failed':
        response.message = '❌ Errore durante l\'importazione';
        response.progress = 0;
        response.error = extraction.error_message;
        response.error_phase = extraction.error_phase;
        break;

      default:
        response.message = 'Stato sconosciuto';
        response.progress = 0;
    }

    res.json(response);

  } catch (error) {
    console.error('[Extraction Status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch extraction status'
    });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/cv/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'CV Extractor API',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/cv/storage-health
 * Check CV storage volume health (Railway diagnostic endpoint)
 * NOTE: Remove or secure this endpoint in production!
 */
router.get('/storage-health', async (req, res) => {
  try {
    const storageService = getCVStorageService();
    const health = await storageService.healthCheck();

    // Get file count and total size
    const fs = require('fs');
    const path = require('path');
    const storagePath = health.storagePath;

    let fileCount = 0;
    let totalSize = 0;
    let fileList = [];

    try {
      if (fs.existsSync(storagePath)) {
        const files = fs.readdirSync(storagePath);
        fileCount = files.length;

        for (const file of files) {
          const filePath = path.join(storagePath, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;

          // Add to list (max 10 for preview)
          if (fileList.length < 10) {
            fileList.push({
              name: file,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Storage Health] Error reading directory:', err.message);
    }

    res.json({
      success: true,
      storage: {
        status: health.status,
        environment: health.environment,
        path: health.storagePath,
        readable: health.readable,
        writable: health.writable
      },
      files: {
        count: fileCount,
        total_size_bytes: totalSize,
        total_size_mb: (totalSize / 1024 / 1024).toFixed(2),
        recent_files: fileList
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Storage Health] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check storage health',
      details: error.message
    });
  }
});

/**
 * POST /api/cv/test/upload
 * Test endpoint without authentication (for E2E tests only)
 */
router.post('/test/upload', upload.single('file'), async (req, res) => {
  try {
    const { employee_id } = req.body;

    console.log(`[CV Test Upload] Received upload for employee ${employee_id}`);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log(`[CV Test Upload] File saved: ${req.file.filename} (${req.file.size} bytes)`);

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        filePath: req.file.path,
        uploadDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[CV Test Upload] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload CV',
      error: error.message
    });
  }
});

/**
 * POST /api/cv/test/extract-and-save
 * Test endpoint without authentication (for E2E tests only)
 */
router.post('/test/extract-and-save', async (req, res) => {
  try {
    const { employee_id, tenant_id, file_path } = req.body;

    console.log(`[CV Test Extraction] Starting for employee ${employee_id}, tenant ${tenant_id}`);

    if (!employee_id || !tenant_id) {
      return res.status(400).json({
        success: false,
        message: 'employee_id and tenant_id are required'
      });
    }

    let cvFilePath = file_path;
    if (!cvFilePath) {
      const uploadDir = path.join(__dirname, '../../uploads/cv');

      const files = fs.readdirSync(uploadDir)
        .filter(f => f.startsWith(`cv-`))
        .sort((a, b) => {
          const aStat = fs.statSync(path.join(uploadDir, a));
          const bStat = fs.statSync(path.join(uploadDir, b));
          return bStat.mtimeMs - aStat.mtimeMs;
        });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No CV file found for this employee. Please upload first.'
        });
      }

      cvFilePath = path.join(uploadDir, files[0]);
    }

    if (!fs.existsSync(cvFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'CV file not found at specified path'
      });
    }

    const cvExtractionService = new CVExtractionService();

    const fileBuffer = fs.readFileSync(cvFilePath);
    const fileName = path.basename(cvFilePath);

    const result = await cvExtractionService.extractAndSave(
      {
        buffer: fileBuffer,
        originalname: fileName,
        size: fileBuffer.length
      },
      parseInt(employee_id),
      tenant_id,
      'test-system'
    );

    res.json(result);
  } catch (error) {
    console.error('[CV Test Extraction] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract and save CV data',
      error: error.message
    });
  }
});

module.exports = router;
