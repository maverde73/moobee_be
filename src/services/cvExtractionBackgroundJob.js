/**
 * CV Extraction Background Job
 * Handles async CV extraction with status progression
 * Date: 9 October 2025, 18:30
 *
 * Status Flow:
 * pending → processing → extracted → importing → completed (or failed)
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CVDataSaveService = require('./cvDataSaveService');
const { getCVStorageService } = require('./cvStorageService');
const LLMAuditService = require('./llmAuditService');

/**
 * Process CV extraction in background with granular status updates
 * @param {object} extraction - cv_extractions record
 * @param {object} prisma - Prisma client instance
 */
async function processExtractionInBackground(extraction, prisma) {
  const startTime = Date.now();
  const extractionId = extraction.id;
  const employeeId = extraction.employee_id;

  try {
    console.log(`[CV ${extractionId}] 🚀 Starting background extraction for employee ${employeeId}`);

    // ============================================
    // PHASE 1: PROCESSING (Python extraction)
    // ============================================

    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'processing',
        updated_at: new Date()
      }
    });
    console.log(`[CV ${extractionId}] Status: PROCESSING`);

    // Read file from volume storage
    const storageService = getCVStorageService();
    const fileBuffer = await storageService.readFileByExtractionId(extractionId);
    console.log(`[CV ${extractionId}] File loaded from volume storage`);

    // Create temp file for Python service
    const tempFilePath = path.join(os.tmpdir(), `cv_${extractionId}_${Date.now()}.pdf`);
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    // Call Python service - ASYNC VERSION (returns immediately)
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath));
    formData.append('extraction_id', extractionId);  // Pass extraction_id
    formData.append('parallel', 'true');
    formData.append('which', 'both');

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8001';
    const pythonApiToken = process.env.PYTHON_API_TOKEN || 'secret-shared-token-moobee-2025';

    console.log(`[CV ${extractionId}] Calling Python async endpoint...`);

    const pythonResponse = await axios.post(
      `${pythonApiUrl}/api/cv-analyzer/analyze-file-async`,  // ✅ NEW ASYNC ENDPOINT
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${pythonApiToken}`,
          'X-Request-ID': `cv-${extractionId}`,
          'X-Tenant-ID': extraction.tenant_id || 'unknown'
        },
        timeout: 30000,  // Only 30 seconds (responds immediately)
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log(`[CV ${extractionId}] ✅ Python accepted job, processing in background`);
    console.log(`[CV ${extractionId}] 📌 Python will write results directly to database when ready`);
    console.log(`[CV ${extractionId}] 📌 Background worker will import data when status='extracted'`);

    // Clean up temp file
    await fs.promises.unlink(tempFilePath);

    // Job is done - Python will handle extraction in background
    // Background worker will handle importing when status='extracted'
    console.log(`[CV ${extractionId}] ✅ Job queued successfully`);

  } catch (error) {
    console.error(`[CV ${extractionId}] ❌ ERROR:`, error.message);

    // Determine error phase
    let errorPhase = 'unknown';
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      errorPhase = 'python_connection';
    } else if (error.response?.status === 400) {
      errorPhase = 'python_bad_request';
    } else if (error.response?.status === 401) {
      errorPhase = 'python_auth_failed';
    } else if (error.response?.status >= 500) {
      errorPhase = 'python_extraction';
    } else if (error.message.includes('Failed to save data')) {
      errorPhase = 'database_save';
    }

    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'failed',
        error_message: error.message,
        error_phase: errorPhase,
        updated_at: new Date()
      }
    });

    console.log(`[CV ${extractionId}] Status: FAILED (phase: ${errorPhase})`);
  }
}

module.exports = { processExtractionInBackground };
