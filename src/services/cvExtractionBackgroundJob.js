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

    // Call Python service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath));

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8001';
    const pythonApiToken = process.env.PYTHON_API_TOKEN || 'secret-shared-token-moobee-2025';

    const pythonResponse = await axios.post(
      `${pythonApiUrl}/api/cv-analyzer/analyze-file`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${pythonApiToken}`
        },
        timeout: 480000,  // 8 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const cvData = pythonResponse.data;

    // 🔍 LOG: JSON data received from Python
    console.log(`[CV ${extractionId}] 📥 [NODE.JS ← PYTHON] Received JSON response:`);
    console.log(`[CV ${extractionId}]    llm_tokens_used: ${cvData.llm_tokens_used}`);
    console.log(`[CV ${extractionId}]    extraction_cost: ${cvData.extraction_cost}`);
    console.log(`[CV ${extractionId}]    llm_model_used: ${cvData.llm_model_used}`);
    console.log(`[CV ${extractionId}]    extracted_text length: ${cvData.extracted_text?.length || 0} chars`);

    // Get tenant_id from extraction record
    const tenant_id = extraction.tenant_id;

    // 📊 LOG to llm_usage_logs table
    // ⚠️ IMPORTANT: Use Python's calculated cost directly instead of recalculating
    if (cvData.llm_tokens_used && cvData.llm_tokens_used > 0 && tenant_id) {
      try {
        await LLMAuditService.logUsage({
          tenantId: tenant_id,
          operationType: 'cv_extraction_complete',
          provider: 'openai',  // Assuming OpenAI, adjust if needed
          model: cvData.llm_model_used || 'gpt-4o',
          usage: {
            prompt_tokens: Math.floor((cvData.llm_tokens_used || 0) * 0.9), // Estimate 90% input
            completion_tokens: Math.floor((cvData.llm_tokens_used || 0) * 0.1), // Estimate 10% output
            total_tokens: cvData.llm_tokens_used || 0
          },
          preCalculatedCost: cvData.extraction_cost,  // ✅ Use Python's cost directly
          status: 'success',
          responseTime: Date.now() - startTime,
          entityType: 'cv_extraction',
          entityId: extractionId,
          metadata: {
            employee_id: employeeId,
            python_extraction_cost: cvData.extraction_cost,  // Keep for reference
            extracted_text_length: cvData.extracted_text?.length || 0,
            processing_time_ms: Date.now() - startTime
          }
        });
        console.log(`[CV ${extractionId}] ✅ Logged to llm_usage_logs: ${cvData.llm_tokens_used} tokens, $${cvData.extraction_cost}`);
      } catch (logError) {
        console.error(`[CV ${extractionId}] ⚠️  Failed to log to llm_usage_logs:`, logError.message);
        // Don't fail the extraction if logging fails
      }
    }

    // Clean up temp file
    await fs.promises.unlink(tempFilePath);

    console.log(`[CV ${extractionId}] ✅ Python extraction completed`);

    // ============================================
    // PHASE 2: EXTRACTED (Python completed)
    // ============================================

    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'extracted',
        extracted_text: cvData.extracted_text || null,
        extraction_result: {
          personal_info: cvData.personal_info || {},
          education: cvData.education || [],
          work_experience: cvData.work_experience || [],
          skills: cvData.skills || {},
          languages: cvData.languages || [],
          certifications: cvData.certifications || [],
          domain_knowledge: cvData.domain_knowledge || {},
          role: cvData.role || {}
        },
        llm_tokens_used: cvData.llm_tokens_used || 0,
        llm_cost: cvData.extraction_cost || 0,
        llm_model_used: cvData.llm_model_used || 'gpt-4',  // ✅ Fixed: was cvData.model_used
        processing_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(2)),
        updated_at: new Date()
      }
    });
    console.log(`[CV ${extractionId}] Status: EXTRACTED`);

    // ============================================
    // PHASE 3: IMPORTING (Saving to database)
    // ============================================

    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'importing',
        updated_at: new Date()
      }
    });
    console.log(`[CV ${extractionId}] 📝 Status: IMPORTING - Saving to database tables`);
    console.log(`[CV ${extractionId}] 🔄 Starting CVDataSaveService.saveExtractedDataToTables()...`);

    // Save data to employee tables
    const saveStartTime = Date.now();
    const saveResult = await CVDataSaveService.saveExtractedDataToTables(extractionId);
    const saveDuration = ((Date.now() - saveStartTime) / 1000).toFixed(2);

    if (!saveResult.success) {
      console.error(`[CV ${extractionId}] ❌ Database save failed:`, saveResult.error);
      throw new Error(`Failed to save data: ${saveResult.error}`);
    }

    console.log(`[CV ${extractionId}] ✅ Data saved in ${saveDuration}s:`);
    console.log(`[CV ${extractionId}] 📊 Stats:`, JSON.stringify(saveResult.stats, null, 2));

    // ============================================
    // PHASE 4: COMPLETED (All done!)
    // ============================================

    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'completed',
        import_stats: {
          personal_info_updated: saveResult.stats.personal_info_updated || false,
          education_saved: (saveResult.stats.education_created || 0) + (saveResult.stats.education_updated || 0),
          work_experiences_saved: (saveResult.stats.work_experiences_created || 0) + (saveResult.stats.work_experiences_updated || 0),
          skills_saved: saveResult.stats.skills_saved || 0,
          languages_saved: (saveResult.stats.languages_created || 0) + (saveResult.stats.languages_updated || 0),
          certifications_saved: (saveResult.stats.certifications_created || 0) + (saveResult.stats.certifications_updated || 0),
          roles_saved: saveResult.stats.roles_saved || 0,
          import_timestamp: new Date().toISOString()
        },
        updated_at: new Date()
      }
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[CV ${extractionId}] 🎉 Status: COMPLETED in ${totalTime}s`);

  } catch (error) {
    console.error(`[CV ${extractionId}] ❌ ERROR:`, error.message);

    // Determine error phase
    let errorPhase = 'unknown';
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      errorPhase = 'python_connection';
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
