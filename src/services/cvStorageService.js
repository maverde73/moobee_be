/**
 * CV Storage Service
 *
 * Handles CV file storage with automatic environment detection:
 * - Local development: Saves to ./temp_uploads directory
 * - Railway production: Saves to /cv-storage mounted volume
 *
 * Date: 2025-10-10
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CVStorageService {
  constructor() {
    // Detect environment and set storage path
    this.isProduction = this._detectProductionEnvironment();
    this.storagePath = this._getStoragePath();
    this._initialized = false;

    // Initialize storage directory (async)
    this._initStorageDirectory().then(() => {
      this._initialized = true;
      console.log(`[CVStorageService] Initialized in ${this.isProduction ? 'PRODUCTION' : 'LOCAL'} mode`);
      console.log(`[CVStorageService] Storage path: ${this.storagePath}`);
    }).catch(error => {
      console.error(`[CVStorageService] Initialization failed:`, error.message);
    });
  }

  /**
   * Detect if running in production (Railway) environment
   * @returns {boolean}
   */
  _detectProductionEnvironment() {
    // Check for Railway volume existence
    if (fsSync.existsSync('/cv-storage')) {
      console.log('[CVStorageService] Detected Railway volume at /cv-storage');
      return true;
    }

    // Check for Railway environment variable
    if (process.env.RAILWAY_ENVIRONMENT === 'production') {
      console.log('[CVStorageService] Detected RAILWAY_ENVIRONMENT=production');
      return true;
    }

    // Check for explicit CV_STORAGE_MODE env var
    if (process.env.CV_STORAGE_MODE === 'production') {
      console.log('[CVStorageService] Detected CV_STORAGE_MODE=production');
      return true;
    }

    console.log('[CVStorageService] Running in LOCAL development mode');
    return false;
  }

  /**
   * Get storage path based on environment
   * @returns {string}
   */
  _getStoragePath() {
    if (this.isProduction) {
      // Production: Use Railway mounted volume
      return '/cv-storage';
    } else {
      // Local: Use temp_uploads directory in project root
      return path.join(__dirname, '../../temp_uploads');
    }
  }

  /**
   * Initialize storage directory (create if not exists)
   */
  async _initStorageDirectory() {
    try {
      // Check if directory exists
      await fs.access(this.storagePath);
      console.log(`[CVStorageService] Storage directory exists: ${this.storagePath}`);
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await fs.mkdir(this.storagePath, { recursive: true });
        console.log(`[CVStorageService] Created storage directory: ${this.storagePath}`);
      } catch (mkdirError) {
        console.error(`[CVStorageService] Failed to create storage directory: ${mkdirError.message}`);
        throw new Error(`Cannot initialize storage directory: ${mkdirError.message}`);
      }
    }
  }

  /**
   * Wait for storage service to be initialized
   * @returns {Promise<void>}
   */
  async _waitForInit() {
    // If already initialized, return immediately
    if (this._initialized) {
      return;
    }

    // Wait up to 5 seconds for initialization
    const maxWaitMs = 5000;
    const startTime = Date.now();

    while (!this._initialized && (Date.now() - startTime) < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (!this._initialized) {
      throw new Error('Storage service initialization timeout');
    }
  }

  /**
   * Generate unique filename for CV
   * @param {string} originalFilename - Original uploaded filename (only used to extract extension)
   * @param {string} extractionId - UUID of extraction record
   * @returns {string} - Generated filename
   */
  _generateFilename(originalFilename, extractionId) {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const ext = path.extname(originalFilename) || '.pdf';

    // Format: cv_<extractionId>_<date>.pdf
    // Safer: avoids special characters from user-uploaded filenames
    return `cv_${extractionId}_${timestamp}${ext}`;
  }

  /**
   * Save CV file to storage
   * @param {Buffer} fileBuffer - File content buffer
   * @param {string} originalFilename - Original filename
   * @param {Object} metadata - File metadata
   * @param {string} metadata.extractionId - UUID of cv_extraction record
   * @param {string} metadata.tenantId - Tenant ID
   * @param {string} [metadata.mimeType] - MIME type (default: application/pdf)
   * @returns {Promise<Object>} - File info { filePath, fileSize, mimeType, originalFilename }
   */
  async saveFile(fileBuffer, originalFilename, metadata) {
    // Wait for initialization to complete
    await this._waitForInit();

    try {
      const { extractionId, tenantId, mimeType = 'application/pdf' } = metadata;

      if (!extractionId || !tenantId) {
        throw new Error('extractionId and tenantId are required in metadata');
      }

      // Generate unique filename
      const filename = this._generateFilename(originalFilename, extractionId);
      const filePath = path.join(this.storagePath, filename);

      // Save file to disk
      await fs.writeFile(filePath, fileBuffer);

      const fileSize = fileBuffer.length;

      console.log(`[CVStorageService] File saved successfully:`);
      console.log(`  - Path: ${filePath}`);
      console.log(`  - Size: ${fileSize} bytes`);
      console.log(`  - Extraction ID: ${extractionId}`);
      console.log(`  - Tenant ID: ${tenantId}`);

      return {
        filename,
        filePath,
        fileSize,
        mimeType,
        originalFilename,
        storageType: this.isProduction ? 'volume' : 'local'
      };
    } catch (error) {
      console.error(`[CVStorageService] Failed to save file: ${error.message}`);
      throw new Error(`Failed to save CV file: ${error.message}`);
    }
  }

  /**
   * Get file path for an extraction ID
   * @param {string} extractionId - UUID of extraction record
   * @returns {Promise<string|null>} - File path or null if not found
   */
  async getFilePath(extractionId) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const cvFile = await prisma.cv_files.findUnique({
        where: { extraction_id: extractionId }
      });

      await prisma.$disconnect();

      if (!cvFile) {
        console.log(`[CVStorageService] No file found for extraction ID: ${extractionId}`);
        return null;
      }

      return cvFile.file_path;
    } catch (error) {
      console.error(`[CVStorageService] Failed to get file path: ${error.message}`);
      throw new Error(`Failed to get file path: ${error.message}`);
    }
  }

  /**
   * Read file content from storage
   * @param {string} filePath - Full file path
   * @returns {Promise<Buffer>} - File content buffer
   */
  async readFile(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      console.log(`[CVStorageService] File read successfully: ${filePath} (${fileBuffer.length} bytes)`);
      return fileBuffer;
    } catch (error) {
      console.error(`[CVStorageService] Failed to read file ${filePath}: ${error.message}`);
      throw new Error(`Failed to read CV file: ${error.message}`);
    }
  }

  /**
   * Read file by extraction ID
   * @param {string} extractionId - UUID of extraction record
   * @returns {Promise<Buffer>} - File content buffer
   */
  async readFileByExtractionId(extractionId) {
    const filePath = await this.getFilePath(extractionId);

    if (!filePath) {
      throw new Error(`No file found for extraction ID: ${extractionId}`);
    }

    return await this.readFile(filePath);
  }

  /**
   * Delete file from storage
   * @param {string} filePath - Full file path
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`[CVStorageService] File deleted successfully: ${filePath}`);
      return true;
    } catch (error) {
      // File might not exist (already deleted or never created)
      if (error.code === 'ENOENT') {
        console.log(`[CVStorageService] File not found (already deleted): ${filePath}`);
        return true;
      }

      console.error(`[CVStorageService] Failed to delete file ${filePath}: ${error.message}`);
      throw new Error(`Failed to delete CV file: ${error.message}`);
    }
  }

  /**
   * Delete file by extraction ID
   * @param {string} extractionId - UUID of extraction record
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFileByExtractionId(extractionId) {
    const filePath = await this.getFilePath(extractionId);

    if (!filePath) {
      console.log(`[CVStorageService] No file to delete for extraction ID: ${extractionId}`);
      return true;
    }

    return await this.deleteFile(filePath);
  }

  /**
   * Check if storage is healthy (directory accessible and writable)
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    try {
      // Check directory exists and is accessible
      await fs.access(this.storagePath, fsSync.constants.R_OK | fsSync.constants.W_OK);

      // Try to write a test file
      const testFilePath = path.join(this.storagePath, '.health_check_test');
      await fs.writeFile(testFilePath, 'test');
      await fs.unlink(testFilePath);

      return {
        status: 'healthy',
        environment: this.isProduction ? 'production' : 'local',
        storagePath: this.storagePath,
        writable: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        environment: this.isProduction ? 'production' : 'local',
        storagePath: this.storagePath,
        writable: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get CVStorageService singleton instance
 * @returns {CVStorageService}
 */
function getCVStorageService() {
  if (!instance) {
    instance = new CVStorageService();
  }
  return instance;
}

module.exports = {
  CVStorageService,
  getCVStorageService
};
