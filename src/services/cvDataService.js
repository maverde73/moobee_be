/**
 * CV Data Service - Database Integration for CV Extractor
 * Data: 30 Settembre 2025, 18:35
 *
 * Handles saving CV extraction results to the database with proper tenant isolation
 * and normalized data structures.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CVDataService {
  /**
   * Main entry point: Save complete CV extraction to database
   *
   * @param {number} employeeId - Employee ID (from employees table)
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {Object} cvResult - Extraction result from Python service
   * @param {Object} fileInfo - Original file information
   * @returns {Promise<Object>} Created extraction record with ID
   */
  static async saveCVExtraction(employeeId, tenantId, cvResult, fileInfo = {}) {
    console.log(`Saving CV extraction for employee ${employeeId}, tenant ${tenantId}`);

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Create main cv_extractions record
        const extraction = await tx.cv_extractions.create({
          data: {
            tenant_id: tenantId,
            employee_id: parseInt(employeeId),

            // File information
            original_filename: fileInfo.originalname || null,
            original_file_path: fileInfo.path || null,
            file_size_bytes: fileInfo.size ? BigInt(fileInfo.size) : null,
            file_type: fileInfo.mimetype || null,

            // Extraction result as JSONB
            extraction_result: cvResult,

            // Status
            status: 'completed',

            // Processing metadata
            processing_time_seconds: cvResult.processing_time || null,
            llm_model_used: cvResult.model_used || 'gpt-4',
            llm_tokens_used: cvResult.tokens_used || null,

            // Timestamps
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        console.log(`Created cv_extraction record: ${extraction.id}`);

        // 2. Save education records (if present)
        if (cvResult.education && Array.isArray(cvResult.education) && cvResult.education.length > 0) {
          await this._saveEducationRecords(tx, employeeId, cvResult.education, extraction.id);
        }

        // 3. Save work experience records (if present)
        if (cvResult.work_experience && Array.isArray(cvResult.work_experience) && cvResult.work_experience.length > 0) {
          await this._saveWorkExperienceRecords(tx, employeeId, cvResult.work_experience, extraction.id);
        }

        // 4. Save additional info (if present)
        if (cvResult.personal_info) {
          await this._saveAdditionalInfo(tx, employeeId, cvResult.personal_info, extraction.id);
        }

        return extraction;
      });
    } catch (error) {
      console.error('Error saving CV extraction:', error);
      throw error;
    }
  }

  /**
   * Save education records to employee_education table
   *
   * @private
   */
  static async _saveEducationRecords(tx, employeeId, educationList, extractionId) {
    console.log(`Saving ${educationList.length} education records...`);

    for (const edu of educationList) {
      try {
        // Find or create degree
        const degreeId = await this._findOrCreateDegree(tx, edu.degree_name);

        await tx.employee_education.create({
          data: {
            employee_id: parseInt(employeeId),
            degree_id: degreeId,
            degree_name: edu.degree_name,
            institution_name: edu.institution_name,
            start_date: edu.start_date ? new Date(edu.start_date) : null,
            end_date: edu.end_date ? new Date(edu.end_date) : null,
            is_current: edu.is_current || false,
            cv_extraction_id: extractionId,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        console.log(`Saved education: ${edu.degree_name} at ${edu.institution_name}`);
      } catch (error) {
        console.error(`Error saving education record:`, error);
        // Continue with next record instead of failing entire transaction
      }
    }
  }

  /**
   * Save work experience records to employee_work_experiences table
   *
   * @private
   */
  static async _saveWorkExperienceRecords(tx, employeeId, workList, extractionId) {
    console.log(`Saving ${workList.length} work experience records...`);

    for (const work of workList) {
      try {
        // Find or create company
        const companyId = await this._findOrCreateCompany(tx, work.company_name);

        await tx.employee_work_experiences.create({
          data: {
            employee_id: parseInt(employeeId),
            company_id: companyId,
            company_name: work.company_name,
            job_title: work.job_title,
            start_date: work.start_date ? new Date(work.start_date) : null,
            end_date: work.end_date ? new Date(work.end_date) : null,
            is_current: work.is_current || false,
            description: work.description || null,
            cv_extraction_id: extractionId,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        console.log(`Saved work experience: ${work.job_title} at ${work.company_name}`);
      } catch (error) {
        console.error(`Error saving work experience record:`, error);
        // Continue with next record
      }
    }
  }

  /**
   * Save additional personal info to employee_additional_info table (1:1 relation)
   *
   * @private
   */
  static async _saveAdditionalInfo(tx, employeeId, personalInfo, extractionId) {
    try {
      // Check if record already exists (1:1 relationship)
      const existing = await tx.employee_additional_info.findUnique({
        where: { employee_id: parseInt(employeeId) }
      });

      if (existing) {
        // Update existing record
        await tx.employee_additional_info.update({
          where: { employee_id: parseInt(employeeId) },
          data: {
            personal_email: personalInfo.email || null,
            personal_phone: personalInfo.phone || null,
            linkedin_url: personalInfo.linkedin || null,
            github_url: personalInfo.github || null,
            cv_extraction_id: extractionId,
            updated_at: new Date()
          }
        });
        console.log('Updated employee additional info');
      } else {
        // Create new record
        await tx.employee_additional_info.create({
          data: {
            employee_id: parseInt(employeeId),
            personal_email: personalInfo.email || null,
            personal_phone: personalInfo.phone || null,
            linkedin_url: personalInfo.linkedin || null,
            github_url: personalInfo.github || null,
            cv_extraction_id: extractionId,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        console.log('Created employee additional info');
      }
    } catch (error) {
      console.error('Error saving additional info:', error);
      // Non-critical, continue
    }
  }

  /**
   * Find or create education degree in lookup table
   *
   * @private
   * @param {Object} tx - Prisma transaction
   * @param {string} degreeName - Degree name to find/create
   * @returns {Promise<number>} Degree ID
   */
  static async _findOrCreateDegree(tx, degreeName) {
    if (!degreeName) return null;

    // Normalize degree name for matching
    const normalizedName = degreeName.toLowerCase().trim();

    // Map common degree names to our standardized types
    const degreeMapping = {
      "bachelor": "Bachelor's Degree",
      "laurea triennale": "Bachelor's Degree",
      "master": "Master's Degree",
      "magistrale": "Master's Degree",
      "mba": "MBA",
      "phd": "Doctorate/PhD",
      "dottorato": "Doctorate/PhD",
      "diploma": "High School Diploma"
    };

    // Find matching degree type
    let degreeType = null;
    for (const [key, value] of Object.entries(degreeMapping)) {
      if (normalizedName.includes(key)) {
        degreeType = value;
        break;
      }
    }

    if (!degreeType) {
      degreeType = "Certificate"; // Default fallback
    }

    // Find degree in database
    const degree = await tx.education_degrees.findFirst({
      where: { degree_type: degreeType }
    });

    return degree ? degree.id : null;
  }

  /**
   * Find or create company in lookup table
   *
   * @private
   * @param {Object} tx - Prisma transaction
   * @param {string} companyName - Company name to find/create
   * @returns {Promise<number|null>} Company ID or null
   */
  static async _findOrCreateCompany(tx, companyName) {
    if (!companyName) return null;

    // Normalize company name for search
    const normalizedName = companyName.toLowerCase().trim()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ');    // Normalize spaces

    // Try to find existing company
    let company = await tx.companies.findFirst({
      where: {
        OR: [
          { name: companyName },
          { normalized_name: normalizedName }
        ]
      }
    });

    // If not found, create new company
    if (!company) {
      try {
        company = await tx.companies.create({
          data: {
            name: companyName,
            normalized_name: normalizedName,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        console.log(`Created new company: ${companyName}`);
      } catch (error) {
        console.error(`Error creating company ${companyName}:`, error);
        return null;
      }
    }

    return company.id;
  }

  /**
   * Get CV extraction by ID
   *
   * @param {string} extractionId - Extraction UUID
   * @returns {Promise<Object>} Extraction record with related data
   */
  static async getExtraction(extractionId) {
    try {
      const extraction = await prisma.cv_extractions.findUnique({
        where: { id: extractionId },
        include: {
          employees: {
            select: {
              id: true,
              employee_code: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          employee_education: {
            orderBy: { start_date: 'desc' }
          },
          employee_work_experiences: {
            orderBy: { start_date: 'desc' }
          },
          employee_additional_info: true
        }
      });

      return extraction;
    } catch (error) {
      console.error('Error fetching extraction:', error);
      throw error;
    }
  }

  /**
   * Get all CV extractions for an employee
   *
   * @param {number} employeeId - Employee ID
   * @param {string} tenantId - Tenant ID for filtering
   * @returns {Promise<Array>} List of extractions
   */
  static async getEmployeeExtractions(employeeId, tenantId) {
    try {
      const extractions = await prisma.cv_extractions.findMany({
        where: {
          employee_id: parseInt(employeeId),
          tenant_id: tenantId,
          deleted_at: null
        },
        orderBy: { created_at: 'desc' },
        include: {
          employee_education: true,
          employee_work_experiences: true
        }
      });

      return extractions;
    } catch (error) {
      console.error('Error fetching employee extractions:', error);
      throw error;
    }
  }

  /**
   * Mark extraction as failed with error message
   *
   * @param {string} extractionId - Extraction UUID
   * @param {string} errorMessage - Error description
   */
  static async markExtractionFailed(extractionId, errorMessage) {
    try {
      await prisma.cv_extractions.update({
        where: { id: extractionId },
        data: {
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date()
        }
      });
    } catch (error) {
      console.error('Error marking extraction as failed:', error);
    }
  }
}

module.exports = CVDataService;
