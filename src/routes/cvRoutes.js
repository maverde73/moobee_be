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
const { authenticate } = require('../middlewares/authMiddleware');

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

/**
 * Background processing function for CV extraction
 * Does NOT block the HTTP response
 */
async function processExtractionInBackground(extraction, prisma) {
  const startTime = Date.now();
  const extractionId = extraction.id;
  const employeeId = extraction.employee_id;

  try {
    console.log(`[Background Job ${extractionId}] Starting CV extraction for employee ${employeeId}`);

    // Create temporary file from BYTEA buffer
    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `cv-temp-${extractionId}.pdf`);
    fs.writeFileSync(tempFilePath, extraction.file_content);

    console.log(`[Background Job ${extractionId}] Temporary file created: ${tempFilePath}`);

    // Call Python extraction service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath), {
      filename: extraction.original_filename,
      contentType: extraction.file_type
    });

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

    console.log(`[Background Job ${extractionId}] Calling Python service at ${pythonServiceUrl}/api/cv-analyzer/analyze-file`);

    const pythonResponse = await axios.post(
      `${pythonServiceUrl}/api/cv-analyzer/analyze-file`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 480000 // 8 minutes timeout
      }
    );

    const cvData = pythonResponse.data;

    console.log(`[Background Job ${extractionId}] Python extraction completed`);
    console.log(`[Background Job ${extractionId}] Extracted text length: ${cvData.extracted_text?.length || 0} chars`);

    // Prepare extraction_result JSON with all extracted data
    const extractionResult = {
      personal_info: cvData.personal_info || {},
      education: cvData.education || [],
      work_experience: cvData.work_experience || [],
      skills: cvData.skills || {},
      languages: cvData.languages || [],
      certifications: cvData.certifications || [],
      domain_knowledge: cvData.domain_knowledge || {},  // NEW
      role: cvData.role || {},  // FIXED: was seniority_info
      extraction_metadata: {
        model_used: cvData.llm_model_used || 'gpt-4',
        tokens_used: cvData.llm_tokens_used || 0,
        extraction_cost: cvData.extraction_cost || 0,
        processing_time: ((Date.now() - startTime) / 1000).toFixed(2),
        extracted_text_length: cvData.extracted_text?.length || 0
      }
    };

    // Update cv_extractions with results (save all data in extraction_result JSON)
    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'completed',
        extracted_text: cvData.extracted_text || null,
        extraction_result: extractionResult, // Save all data in JSON field
        llm_tokens_used: cvData.llm_tokens_used || 0,
        llm_cost: cvData.extraction_cost || 0,
        processing_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(2)),
        llm_model_used: cvData.llm_model_used || 'gpt-4',
        updated_at: new Date()
      }
    });

    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Background Job ${extractionId}] ✅ COMPLETED in ${processingTime}s`);

    // Save extracted data to employee tables
    console.log(`[Background Job ${extractionId}] Saving extracted data to employee tables...`);
    const saveResult = await CVDataSaveService.saveExtractedDataToTables(extractionId);

    if (saveResult.success) {
      console.log(`[Background Job ${extractionId}] Data saved successfully:`, saveResult.stats);
    } else {
      console.error(`[Background Job ${extractionId}] Failed to save data:`, saveResult.error);
    }

  } catch (error) {
    console.error(`[Background Job ${extractionId}] ❌ FAILED:`, error.message);

    // Update status to failed with error message
    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'failed',
        error_message: error.message || 'Unknown error during extraction',
        updated_at: new Date()
      }
    });
  }
}

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

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

    let pythonResponse;
    try {
      pythonResponse = await axios.post(
        `${pythonServiceUrl}/api/cv/extract-mvp`,
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

    if (!latestExtraction.file_content) {
      return res.status(400).json({
        success: false,
        message: 'CV file content is missing in database'
      });
    }

    console.log(`[CV Extraction] Found cv_extraction ${latestExtraction.id}, starting background job`);

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
