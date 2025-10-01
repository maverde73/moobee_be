/**
 * CV Extractor API Routes
 * Data: 30 Settembre 2025, 18:40
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

module.exports = router;
