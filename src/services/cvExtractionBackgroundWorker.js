/**
 * CV Extraction Background Worker
 * Polls database every 10s for 'extracted' CVs and imports data
 * Date: 14 October 2025, 17:00
 *
 * This worker solves the Railway timeout problem by:
 * 1. Python writes extraction results directly to database
 * 2. This worker polls for status='extracted' records
 * 3. Worker imports data to employee tables
 * 4. Updates status to 'completed' or 'failed'
 */

const { PrismaClient } = require('@prisma/client');
const CVDataSaveService = require('./cvDataSaveService');
const LLMAuditService = require('./llmAuditService');

const prisma = new PrismaClient();

// Worker state
let isRunning = false;
let workerInterval = null;
let processedCount = 0;
let errorCount = 0;

/**
 * Process one CV extraction that's in 'extracted' status
 * @param {object} extraction - cv_extractions record
 */
async function processOneCVExtraction(extraction) {
  const extractionId = extraction.id;
  const employeeId = extraction.employee_id;
  const startTime = Date.now();

  try {
    console.log(`[WORKER ${extractionId}] 🔄 Starting import for employee ${employeeId}`);

    // ============================================
    // PHASE 1: Update status to 'importing'
    // ============================================

    await prisma.cv_extractions.update({
      where: { id: extractionId },
      data: {
        status: 'importing',
        updated_at: new Date()
      }
    });
    console.log(`[WORKER ${extractionId}] Status: IMPORTING`);

    // ============================================
    // PHASE 2: Log LLM usage (if not already logged)
    // ============================================

    const tenant_id = extraction.tenant_id;
    const llmTokens = extraction.llm_tokens_used || 0;
    const llmCost = extraction.llm_cost || 0;
    const llmModel = extraction.llm_model_used || 'gpt-4';

    if (llmTokens > 0 && tenant_id) {
      try {
        // Check if already logged
        const existingLog = await prisma.llm_usage_logs.findFirst({
          where: {
            entity_type: 'cv_extraction',
            entity_id: extractionId.toString()
          }
        });

        if (!existingLog) {
          await LLMAuditService.logUsage({
            tenantId: tenant_id,
            operationType: 'cv_extraction_complete',
            provider: 'openai',
            model: llmModel,
            usage: {
              prompt_tokens: Math.floor(llmTokens * 0.9),
              completion_tokens: Math.floor(llmTokens * 0.1),
              total_tokens: llmTokens
            },
            preCalculatedCost: llmCost,  // Use Python's cost
            status: 'success',
            responseTime: extraction.processing_time_seconds * 1000,
            entityType: 'cv_extraction',
            entityId: extractionId,
            metadata: {
              employee_id: employeeId,
              python_extraction_cost: llmCost,
              extracted_text_length: extraction.extracted_text?.length || 0,
              worker_import: true
            }
          });
          console.log(`[WORKER ${extractionId}] ✅ Logged to llm_usage_logs: ${llmTokens} tokens, $${llmCost}`);
        } else {
          console.log(`[WORKER ${extractionId}] ℹ️  LLM usage already logged, skipping`);
        }
      } catch (logError) {
        console.error(`[WORKER ${extractionId}] ⚠️  Failed to log LLM usage:`, logError.message);
        // Don't fail import if logging fails
      }
    }

    // ============================================
    // PHASE 3: Save data to employee tables
    // ============================================

    console.log(`[WORKER ${extractionId}] 💾 Saving to database tables...`);
    const saveStartTime = Date.now();
    const saveResult = await CVDataSaveService.saveExtractedDataToTables(extractionId);
    const saveDuration = ((Date.now() - saveStartTime) / 1000).toFixed(2);

    if (!saveResult.success) {
      console.error(`[WORKER ${extractionId}] ❌ Database save failed:`, saveResult.error);
      throw new Error(`Failed to save data: ${saveResult.error}`);
    }

    console.log(`[WORKER ${extractionId}] ✅ Data saved in ${saveDuration}s`);
    console.log(`[WORKER ${extractionId}] 📊 Stats:`, JSON.stringify(saveResult.stats, null, 2));

    // ============================================
    // PHASE 4: Update status to 'completed'
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
    console.log(`[WORKER ${extractionId}] 🎉 Status: COMPLETED in ${totalTime}s`);

    processedCount++;

  } catch (error) {
    console.error(`[WORKER ${extractionId}] ❌ ERROR:`, error.message);
    errorCount++;

    // Determine error phase
    let errorPhase = 'database_save';
    if (error.message.includes('saveExtractedDataToTables')) {
      errorPhase = 'database_save';
    } else if (error.message.includes('llm_usage_logs')) {
      errorPhase = 'llm_logging';
    }

    // Increment retry count
    const currentRetryCount = extraction.retry_count || 0;

    // Update status
    if (currentRetryCount >= 3) {
      // Max retries reached - mark as failed
      await prisma.cv_extractions.update({
        where: { id: extractionId },
        data: {
          status: 'failed',
          error_message: `Worker failed after ${currentRetryCount} retries: ${error.message}`,
          error_phase: errorPhase,
          retry_count: currentRetryCount,
          updated_at: new Date()
        }
      });
      console.log(`[WORKER ${extractionId}] Status: FAILED after ${currentRetryCount} retries`);
    } else {
      // Retry - set back to 'extracted' with incremented retry count
      await prisma.cv_extractions.update({
        where: { id: extractionId },
        data: {
          status: 'extracted',  // Back to extracted for retry
          error_message: `Worker attempt ${currentRetryCount + 1} failed: ${error.message}`,
          error_phase: errorPhase,
          retry_count: currentRetryCount + 1,
          updated_at: new Date()
        }
      });
      console.log(`[WORKER ${extractionId}] Status: Queued for retry (attempt ${currentRetryCount + 2})`);
    }
  }
}

/**
 * Poll database for CVs with status='pending' and start extraction
 */
async function pollAndStartPendingExtractions() {
  try {
    // Find up to 5 pending extractions
    const pendingCVs = await prisma.cv_extractions.findMany({
      where: {
        status: 'pending'
      },
      orderBy: {
        created_at: 'asc'  // FIFO: oldest first
      },
      take: 5  // Process max 5 pending at once
    });

    if (pendingCVs.length > 0) {
      console.log(`[WORKER] 📥 Found ${pendingCVs.length} pending CV(s) to start`);

      // Import the job handler
      const { processExtractionInBackground } = require('./cvExtractionBackgroundJob');

      // Start each extraction
      for (const extraction of pendingCVs) {
        try {
          console.log(`[WORKER] 🚀 Starting extraction ${extraction.id}`);
          // Call the job handler (which will call Python async endpoint)
          await processExtractionInBackground(extraction, prisma);
        } catch (error) {
          console.error(`[WORKER] ❌ Failed to start extraction ${extraction.id}:`, error.message);
        }
      }

      console.log(`[WORKER] ✅ Started ${pendingCVs.length} extraction(s)`);
    }

  } catch (error) {
    console.error(`[WORKER] ❌ Poll pending error:`, error.message);
    errorCount++;
  }
}

/**
 * Poll database for CVs with status='extracted' and import data
 */
async function pollAndProcessExtractions() {
  try {
    // Find up to 10 extractions with status='extracted'
    const extractedCVs = await prisma.cv_extractions.findMany({
      where: {
        status: 'extracted'
      },
      orderBy: {
        updated_at: 'asc'  // FIFO: oldest first
      },
      take: 10  // Process max 10 at once
    });

    if (extractedCVs.length > 0) {
      console.log(`[WORKER] 📋 Found ${extractedCVs.length} CV(s) ready for import`);

      // Process each CV sequentially
      for (const extraction of extractedCVs) {
        await processOneCVExtraction(extraction);
      }

      console.log(`[WORKER] ✅ Batch complete: ${extractedCVs.length} processed`);
    }

  } catch (error) {
    console.error(`[WORKER] ❌ Poll error:`, error.message);
    errorCount++;
  }
}

/**
 * Start the background worker
 * @param {number} intervalMs - Polling interval in milliseconds (default: 10000 = 10s)
 */
function startWorker(intervalMs = 10000) {
  if (isRunning) {
    console.log('[WORKER] Already running, skipping start');
    return;
  }

  console.log(`[WORKER] 🚀 Starting background worker (polling every ${intervalMs / 1000}s)`);
  isRunning = true;
  processedCount = 0;
  errorCount = 0;

  // Initial poll (both pending and extracted)
  pollAndStartPendingExtractions();
  pollAndProcessExtractions();

  // Set up interval
  workerInterval = setInterval(async () => {
    await pollAndStartPendingExtractions();  // Start pending jobs
    await pollAndProcessExtractions();  // Import extracted data
  }, intervalMs);

  console.log('[WORKER] ✅ Worker started successfully');
}

/**
 * Stop the background worker
 */
function stopWorker() {
  if (!isRunning) {
    console.log('[WORKER] Not running, skipping stop');
    return;
  }

  console.log('[WORKER] 🛑 Stopping background worker...');
  isRunning = false;

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  console.log(`[WORKER] ✅ Worker stopped (processed: ${processedCount}, errors: ${errorCount})`);
}

/**
 * Get worker statistics
 */
function getWorkerStats() {
  return {
    isRunning,
    processedCount,
    errorCount,
    uptime: isRunning ? 'running' : 'stopped'
  };
}

module.exports = {
  startWorker,
  stopWorker,
  getWorkerStats
};
