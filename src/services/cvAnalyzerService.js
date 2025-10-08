/**
 * CV Analyzer Service
 * Integrates with Python BE_py CV Analyzer endpoint
 *
 * @author AI Assistant
 * @date 5 October 2025, 18:25
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Python backend configuration
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';
const PYTHON_API_TOKEN = process.env.NODEJS_API_TOKEN || 'your-secret-token';

// Output directory for extracted CV data
const OUTPUT_DIR = path.join(__dirname, '../../../cv_extracted');

class CVAnalyzerService {
  /**
   * Analyze CV file using Python backend
   * @param {string} filePath - Absolute path to CV file
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeCV(filePath, options = {}) {
    const {
      parallel = true,
      which = 'both',  // 'skills', 'role', 'both'
      saveToDB = false,
      employeeId = null
    } = options;

    const requestId = uuidv4();
    const tenantId = options.tenantId || 'default';

    console.log(`[${requestId}] Starting CV analysis: ${path.basename(filePath)}`);
    console.log(`[${requestId}] Options:`, { parallel, which, saveToDB, employeeId });

    try {
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('parallel', String(parallel));
      formData.append('which', which);

      // Call Python backend
      console.log(`[${requestId}] Calling Python API: ${PYTHON_API_URL}/api/cv-analyzer/analyze-file`);

      const startTime = Date.now();
      const response = await axios.post(
        `${PYTHON_API_URL}/api/cv-analyzer/analyze-file`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${PYTHON_API_TOKEN}`,
            'X-Request-ID': requestId,
            'X-Tenant-ID': tenantId
          },
          timeout: 600000, // 10 minutes timeout
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[${requestId}] Analysis completed in ${processingTime}s`);

      const result = response.data;

      // Save JSON to output directory
      const outputPath = await this.saveResults(filePath, result, requestId);
      console.log(`[${requestId}] Results saved to: ${outputPath}`);

      // Optionally save to database
      if (saveToDB && employeeId) {
        await this.saveToDatabase(employeeId, result, tenantId);
        console.log(`[${requestId}] Results saved to database for employee: ${employeeId}`);
      }

      return {
        success: true,
        requestId,
        filename: path.basename(filePath),
        processingTime: parseFloat(processingTime),
        outputPath,
        data: result
      };

    } catch (error) {
      console.error(`[${requestId}] CV analysis failed:`, error.message);

      if (error.response) {
        console.error(`[${requestId}] Python API error:`, {
          status: error.response.status,
          data: error.response.data
        });
      }

      throw new Error(`CV analysis failed: ${error.message}`);
    }
  }

  /**
   * Save analysis results to JSON file
   * @param {string} cvFilePath - Original CV file path
   * @param {Object} results - Analysis results
   * @param {string} requestId - Request ID
   * @returns {Promise<string>} Output file path
   */
  async saveResults(cvFilePath, results, requestId) {
    const filename = path.basename(cvFilePath, path.extname(cvFilePath));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputFilename = `${filename}_${timestamp}_${requestId.substring(0, 8)}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write JSON file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(results, null, 2),
      'utf-8'
    );

    return outputPath;
  }

  /**
   * Save analysis results to database
   * @param {number} employeeId - Employee ID
   * @param {Object} results - Analysis results
   * @param {string} tenantId - Tenant ID
   */
  async saveToDatabase(employeeId, results, tenantId) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Save skills
      if (results.skills && results.skills.extracted_skills) {
        const skillsToSave = results.skills.extracted_skills
          .filter(skill => skill.id && skill.matched_skill)
          .map(skill => ({
            employee_id: employeeId,
            skill_id: skill.id,
            proficiency_level: skill.confidence || 0.8,
            source: 'cv_extracted',
            tenant_id: tenantId
          }));

        // Upsert skills (avoid duplicates)
        for (const skillData of skillsToSave) {
          await prisma.employee_skills.upsert({
            where: {
              employee_id_skill_id: {
                employee_id: employeeId,
                skill_id: skillData.skill_id
              }
            },
            update: {
              proficiency_level: skillData.proficiency_level,
              source: skillData.source
            },
            create: skillData
          });
        }

        console.log(`Saved ${skillsToSave.length} skills for employee ${employeeId}`);
      }

      // Save role and seniority
      if (results.role && results.role.id_sub_role) {
        const roleData = {
          employee_id: employeeId,
          sub_role_id: results.role.id_sub_role,
          role_id: results.role.id_role || null,
          anni_esperienza: results.role.relevant_years || 0,
          tenant_id: tenantId
        };

        // Check if role already exists
        const existingRole = await prisma.employee_roles.findFirst({
          where: {
            employee_id: employeeId,
            sub_role_id: results.role.id_sub_role
          }
        });

        if (existingRole) {
          await prisma.employee_roles.update({
            where: { id: existingRole.id },
            data: roleData
          });
        } else {
          await prisma.employee_roles.create({
            data: roleData
          });
        }

        console.log(`Saved role for employee ${employeeId}: ${results.role.matched_sub_role}`);
      }

    } catch (error) {
      console.error('Database save error:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Analyze multiple CVs in batch
   * @param {Array<string>} filePaths - Array of CV file paths
   * @param {Object} options - Analysis options
   * @returns {Promise<Array>} Array of results
   */
  async analyzeBatch(filePaths, options = {}) {
    const results = [];
    const errors = [];

    console.log(`Starting batch analysis of ${filePaths.length} CVs`);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      console.log(`\n[${i + 1}/${filePaths.length}] Processing: ${path.basename(filePath)}`);

      try {
        const result = await this.analyzeCV(filePath, options);
        results.push(result);
        console.log(`✓ Success: ${result.filename} (${result.processingTime}s)`);
      } catch (error) {
        console.error(`✗ Failed: ${path.basename(filePath)} - ${error.message}`);
        errors.push({
          filename: path.basename(filePath),
          error: error.message
        });
      }

      // Small delay between requests to avoid overwhelming the server
      if (i < filePaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n=== Batch Analysis Complete ===`);
    console.log(`Successful: ${results.length}/${filePaths.length}`);
    console.log(`Failed: ${errors.length}/${filePaths.length}`);

    return {
      successful: results,
      failed: errors,
      summary: {
        total: filePaths.length,
        successful: results.length,
        failed: errors.length,
        totalTime: results.reduce((sum, r) => sum + r.processingTime, 0)
      }
    };
  }

  /**
   * Health check for Python backend
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${PYTHON_API_URL}/api/cv-analyzer/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      throw new Error(`Python backend health check failed: ${error.message}`);
    }
  }
}

module.exports = new CVAnalyzerService();
