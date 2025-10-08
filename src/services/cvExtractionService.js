/**
 * CV Extraction Service
 * Date: 6 October 2025, 16:00
 *
 * Service for extracting CV data via Python API and saving to database
 */

const axios = require('axios');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class CVExtractionService {
  constructor() {
    this.pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8001';
  }

  /**
   * Main method: Extract CV and save to database
   *
   * @param {Object} file - File object with buffer, originalname, size
   * @param {number} employeeId - Employee ID
   * @param {string} tenantId - Tenant ID (UUID)
   * @param {string} userId - User ID who triggered extraction
   * @returns {Promise<Object>} Extraction result with stats
   */
  async extractAndSave(file, employeeId, tenantId, userId) {
    console.log('[CVExtractionService] Starting extraction and save');
    console.log(`[CVExtractionService] Employee: ${employeeId}, Tenant: ${tenantId}`);

    let extractionId = null;

    try {
      // 1. Call Python API for extraction
      console.log('[CVExtractionService] Calling Python extraction API...');
      const extractedData = await this.callPythonExtractor(file);

      if (!extractedData || !extractedData.success) {
        throw new Error('Python API extraction failed: ' + (extractedData?.error || 'Unknown error'));
      }

      console.log('[CVExtractionService] Extraction completed successfully');

      // 2. Save to database (with file buffer)
      console.log('[CVExtractionService] Saving to database...');
      const result = await this.saveToDB(extractedData, employeeId, tenantId, userId, file);

      extractionId = result.extractionId;

      console.log('[CVExtractionService] Database save completed');
      console.log('[CVExtractionService] Stats:', JSON.stringify(result.stats, null, 2));

      return {
        success: true,
        extraction_id: extractionId,
        stats: result.stats,
        message: 'CV extracted and saved successfully'
      };

    } catch (error) {
      console.error('[CVExtractionService] Error:', error);

      // Update extraction status to failed if we have an ID
      if (extractionId) {
        await prisma.cv_extractions.update({
          where: { id: extractionId },
          data: {
            status: 'failed',
            error_message: error.message
          }
        }).catch(err => console.error('Failed to update extraction status:', err));
      }

      throw error;
    }
  }

  /**
   * Call Python API to extract CV data
   *
   * @param {Object} file - File object with buffer, originalname, size
   * @returns {Promise<Object>} Extracted JSON data
   */
  async callPythonExtractor(file) {
    const formData = new FormData();

    // Append buffer as stream with correct content type
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.originalname.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      knownLength: file.size
    });

    try {
      console.log(`[CVExtractionService] Calling Python API at ${this.pythonApiUrl}/cv-analyzer/analyze-file`);
      console.log(`[CVExtractionService] File: ${file.originalname}, Size: ${file.size} bytes`);

      const response = await axios.post(
        `${this.pythonApiUrl}/cv-analyzer/analyze-file`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 480000, // 8 minutes
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      console.log('[CVExtractionService] Python API response received');
      return response.data;

    } catch (error) {
      console.error('[CVExtractionService] Python API error:', error.message);
      if (error.response) {
        console.error('[CVExtractionService] Response status:', error.response.status);
        console.error('[CVExtractionService] Response data:', error.response.data);
      }
      throw new Error(`Python extraction failed: ${error.message}`);
    }
  }

  /**
   * Save extracted data to database in transaction
   *
   * @param {Object} jsonData - Extracted JSON from Python API
   * @param {number} employeeId - Employee ID
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID
   * @param {Object} file - File object with buffer for binary storage
   * @returns {Promise<Object>} Save result with stats
   */
  async saveToDB(jsonData, employeeId, tenantId, userId, file) {
    const stats = {
      personal_info_updated: false,
      education_saved: 0,
      work_experiences_saved: 0,
      languages_saved: 0,
      certifications_saved: 0,
      skills_saved: 0,
      skills_custom_created: 0,
      role_updated: false,
      total_experience_years: 0
    };

    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create cv_extractions record
      const extraction = await tx.cv_extractions.create({
        data: {
          id: uuidv4(),
          employee_id: employeeId,
          tenant_id: tenantId,
          original_filename: jsonData.filename || file.originalname || 'unknown.pdf',
          file_size_bytes: BigInt(jsonData.file_size_bytes || file.size || 0),
          file_type: jsonData.filename?.endsWith('.pdf') ? 'pdf' : 'docx',
          file_content: file.buffer,  // NEW: Binary file content
          extracted_text: jsonData.extracted_text || null,  // NEW: Extracted text from PDF
          status: 'processing',
          extraction_result: jsonData,
          llm_model_used: jsonData.model_used || 'gpt-4',
          llm_tokens_used: jsonData.llm_tokens_used || null,  // NEW: Token count
          llm_cost: jsonData.llm_cost || this.calculateCost(jsonData),  // NEW: Cost calculation
          processing_time_seconds: jsonData.processing_time || 0,
          updated_by: userId
        }
      });

      const extractionId = extraction.id;
      console.log(`[CVExtractionService] Created extraction record: ${extractionId}`);

      // 2. Update personal info
      if (jsonData.personal_info) {
        await this.updatePersonalInfo(tx, employeeId, jsonData.personal_info);
        stats.personal_info_updated = true;
      }

      // 3. Save education
      if (jsonData.education && Array.isArray(jsonData.education)) {
        stats.education_saved = await this.saveEducation(tx, employeeId, extractionId, jsonData.education);
      }

      // 4. Save work experiences
      if (jsonData.work_experience && Array.isArray(jsonData.work_experience)) {
        stats.work_experiences_saved = await this.saveWorkExperiences(
          tx, employeeId, tenantId, extractionId, jsonData.work_experience
        );
      }

      // 5. Save languages
      if (jsonData.languages && Array.isArray(jsonData.languages)) {
        stats.languages_saved = await this.saveLanguages(tx, employeeId, extractionId, jsonData.languages);
      }

      // 6. Save certifications
      if (jsonData.certifications && Array.isArray(jsonData.certifications)) {
        stats.certifications_saved = await this.saveCertifications(
          tx, employeeId, tenantId, extractionId, jsonData.certifications
        );
      }

      // 7. Save skills
      if (jsonData.skills && Array.isArray(jsonData.skills)) {
        const skillsResult = await this.saveSkills(tx, employeeId, tenantId, extractionId, jsonData.skills);
        stats.skills_saved = skillsResult.saved;
        stats.skills_custom_created = skillsResult.customCreated;
      }

      // 8. Save role and seniority
      if (jsonData.seniority_info) {
        const totalExp = await this.saveRole(tx, employeeId, tenantId, jsonData.seniority_info);
        stats.role_updated = true;
        stats.total_experience_years = totalExp;
      }

      // 9. Update extraction status to completed
      await tx.cv_extractions.update({
        where: { id: extractionId },
        data: { status: 'completed' }
      });

      return { extractionId, stats };
    });

    return result;
  }

  /**
   * Update employee personal info
   */
  async updatePersonalInfo(tx, employeeId, personalInfo) {
    const updateData = {};

    if (personalInfo.full_name) {
      const nameParts = personalInfo.full_name.trim().split(' ');
      if (nameParts.length >= 2) {
        updateData.first_name = nameParts[0];
        updateData.last_name = nameParts.slice(1).join(' ');
      }
    }

    if (personalInfo.email) {
      updateData.email = personalInfo.email;
    }

    if (personalInfo.phone) {
      updateData.phone = personalInfo.phone;
    }

    // Note: No 'address' field in employees table, skipping location

    if (Object.keys(updateData).length > 0) {
      await tx.employees.update({
        where: { id: employeeId },
        data: updateData
      });
      console.log('[CVExtractionService] Updated personal info');
    }
  }

  /**
   * Save education entries
   */
  async saveEducation(tx, employeeId, extractionId, educationList) {
    let count = 0;

    for (const edu of educationList) {
      await tx.employee_education.create({
        data: {
          employee_id: employeeId,
          cv_extraction_id: extractionId,
          degree_name: edu.degree_name || edu.degree || 'Unknown',
          institution_name: edu.institution_name || edu.institution || 'Unknown',
          field_of_study: edu.field_of_study || null,
          start_date: edu.start_date ? new Date(edu.start_date) : null,
          end_date: edu.end_date ? new Date(edu.end_date) : null,
          is_current: edu.is_current || false,
          grade: edu.grade || null
        }
      });
      count++;
    }

    console.log(`[CVExtractionService] Saved ${count} education entries`);
    return count;
  }

  /**
   * Save work experiences with company normalization
   */
  async saveWorkExperiences(tx, employeeId, tenantId, extractionId, workList) {
    let count = 0;

    for (const work of workList) {
      // Ensure company exists
      let companyId = null;
      const companyName = work.company_name || work.company || 'Unknown Company';

      if (companyName && companyName !== 'Unknown Company') {
        companyId = await this.ensureCompanyExists(tx, companyName, tenantId);
      }

      await tx.employee_work_experiences.create({
        data: {
          employee_id: employeeId,
          cv_extraction_id: extractionId,
          company_id: companyId,
          company_name: companyName,
          job_title: work.job_title || work.title || 'Unknown Position',
          start_date: work.start_date ? new Date(work.start_date) : null,
          end_date: work.end_date ? new Date(work.end_date) : null,
          is_current: work.is_current || false,
          description: work.description || null,
          responsibilities: Array.isArray(work.responsibilities) ? work.responsibilities : (work.responsibilities ? [work.responsibilities] : []),
          achievements: Array.isArray(work.achievements) ? work.achievements : (work.achievements ? [work.achievements] : [])
        }
      });
      count++;
    }

    console.log(`[CVExtractionService] Saved ${count} work experiences`);
    return count;
  }

  /**
   * Save languages with proficiency mapping
   */
  async saveLanguages(tx, employeeId, extractionId, languagesList) {
    let count = 0;

    // Language name normalization (Italian → English)
    const languageMap = {
      'italiano': 'Italian',
      'inglese': 'English',
      'spagnolo': 'Spanish',
      'francese': 'French',
      'tedesco': 'German',
      'portoghese': 'Portuguese',
      'cinese': 'Chinese',
      'giapponese': 'Japanese',
      'russo': 'Russian',
      'arabo': 'Arabic'
    };

    for (const lang of languagesList) {
      // Normalize language name
      let languageName = lang.language || lang.name;
      if (!languageName) continue;

      const normalized = languageMap[languageName.toLowerCase()] || languageName;

      // Find or create language
      const language = await this.ensureLanguageExists(tx, normalized);

      // Map proficiency to proficiency_level_id
      let proficiencyLevelId = null;
      if (lang.proficiency) {
        const profLevel = await tx.language_proficiency_levels.findFirst({
          where: {
            OR: [
              { level: { equals: lang.proficiency, mode: 'insensitive' } },
              { cefr_code: { equals: lang.proficiency, mode: 'insensitive' } }
            ]
          }
        });
        proficiencyLevelId = profLevel?.id || null;
      }

      await tx.employee_languages.create({
        data: {
          employee_id: employeeId,
          cv_extraction_id: extractionId,
          language_id: language.id,
          proficiency_level_id: proficiencyLevelId
        }
      });
      count++;
    }

    console.log(`[CVExtractionService] Saved ${count} languages`);
    return count;
  }

  /**
   * Save certifications with global lookup
   */
  async saveCertifications(tx, employeeId, tenantId, extractionId, certsList) {
    let count = 0;

    for (const cert of certsList) {
      // Try to find global certification by name
      const globalCert = await this.lookupGlobalCertification(tx, cert.certification_name);

      await tx.employee_certifications.create({
        data: {
          employee_id: employeeId,
          cv_extraction_id: extractionId,
          global_certification_id: globalCert?.id || null,
          certification_name: cert.certification_name || null,
          issuing_organization: cert.issuing_organization || null,
          issue_date: cert.issue_date ? new Date(cert.issue_date) : null,
          expiry_date: cert.expiry_date ? new Date(cert.expiry_date) : null,
          credential_id: cert.credential_id || null,
          source: 'cv_extracted'
        }
      });
      count++;
    }

    console.log(`[CVExtractionService] Saved ${count} certifications`);
    return count;
  }

  /**
   * Save skills with custom creation support
   */
  async saveSkills(tx, employeeId, tenantId, extractionId, skillsList) {
    let saved = 0;
    let customCreated = 0;

    for (const skill of skillsList) {
      // Ensure skill exists (create custom if not global)
      const skillRecord = await this.ensureSkillExists(tx, skill.skill_name, tenantId);

      if (skillRecord.isCustom) {
        customCreated++;
      }

      // Map confidence to proficiency_level (0.0-1.0 scale)
      const proficiency = skill.confidence || 0;

      await tx.employee_skills.create({
        data: {
          employee_id: employeeId,
          cv_extraction_id: extractionId,
          skill_id: skillRecord.id,
          proficiency_level: proficiency,
          source: 'cv_extracted'
        }
      });
      saved++;
    }

    console.log(`[CVExtractionService] Saved ${saved} skills (${customCreated} custom)`);
    return { saved, customCreated };
  }

  /**
   * Save employee role and seniority
   */
  async saveRole(tx, employeeId, tenantId, seniorityInfo) {
    // Calculate total experience from work history
    const totalExp = await this.calculateTotalExperience(tx, employeeId);

    // Get role and sub_role IDs from JSON (already matched by Python API)
    const roleId = seniorityInfo.id_role || null;
    const subRoleId = seniorityInfo.id_sub_role || null;

    if (!roleId || !subRoleId) {
      console.log('[CVExtractionService] No role/sub-role IDs in JSON, skipping role save');
      return totalExp;
    }

    // Check if employee_roles record exists
    const existingRole = await tx.employee_roles.findFirst({
      where: {
        employee_id: employeeId,
        sub_role_id: subRoleId
      }
    });

    if (existingRole) {
      // Update existing
      await tx.employee_roles.update({
        where: { id: existingRole.id },
        data: {
          role_id: roleId,
          anni_esperienza: totalExp
        }
      });
      console.log(`[CVExtractionService] Updated role: ${roleId}/${subRoleId} with ${totalExp} years`);
    } else {
      // Create new
      await tx.employee_roles.create({
        data: {
          employee_id: employeeId,
          tenant_id: tenantId,
          role_id: roleId,  // NOW USING: Parent role from JSON
          sub_role_id: subRoleId,  // NOW USING: Sub-role from JSON
          anni_esperienza: totalExp
        }
      });
      console.log(`[CVExtractionService] Created role: ${roleId}/${subRoleId} with ${totalExp} years`);
    }

    return totalExp;
  }

  /**
   * Ensure skill exists (create custom if not found)
   */
  async ensureSkillExists(tx, skillName, tenantId) {
    if (!skillName) {
      throw new Error('Skill name is required');
    }

    // 1. Try to find global skill
    const globalSkill = await tx.skills.findFirst({
      where: {
        tenant_id: null,
        OR: [
          { Skill: { equals: skillName, mode: 'insensitive' } },
          { NameKnown_Skill: { equals: skillName, mode: 'insensitive' } }
        ]
      }
    });

    if (globalSkill) {
      return { id: globalSkill.id, isCustom: false };
    }

    // 2. Try to find custom skill for this tenant
    const customSkill = await tx.skills.findFirst({
      where: {
        tenant_id: tenantId,
        Skill: { equals: skillName, mode: 'insensitive' }
      }
    });

    if (customSkill) {
      return { id: customSkill.id, isCustom: true };
    }

    // 3. Create new custom skill
    const newSkill = await tx.skills.create({
      data: {
        Skill: skillName,
        NameKnown_Skill: skillName,
        tenant_id: tenantId,
        is_active: true
      }
    });

    console.log(`[CVExtractionService] Created custom skill: ${skillName}`);
    return { id: newSkill.id, isCustom: true };
  }

  /**
   * Ensure language exists in languages table
   */
  async ensureLanguageExists(tx, languageName) {
    const existing = await tx.languages.findFirst({
      where: {
        name: { equals: languageName, mode: 'insensitive' }
      }
    });

    if (existing) {
      return existing;
    }

    // Create new language
    const newLang = await tx.languages.create({
      data: {
        name: languageName,
        iso_code_639_1: null,
        iso_code_639_3: null
      }
    });

    console.log(`[CVExtractionService] Created new language: ${languageName}`);
    return newLang;
  }

  /**
   * Ensure company exists in companies table
   */
  async ensureCompanyExists(tx, companyName, tenantId) {
    const existing = await tx.companies.findFirst({
      where: {
        name: { equals: companyName, mode: 'insensitive' }
      }
    });

    if (existing) {
      return existing.id;
    }

    // Create new company (note: companies table doesn't have tenant_id)
    const newCompany = await tx.companies.create({
      data: {
        name: companyName,
        normalized_name: companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
      }
    });

    console.log(`[CVExtractionService] Created new company: ${companyName}`);
    return newCompany.id;
  }

  /**
   * Lookup global certification by name
   */
  async lookupGlobalCertification(tx, certName) {
    if (!certName) return null;

    return await tx.certifications.findFirst({
      where: {
        OR: [
          { name: { contains: certName, mode: 'insensitive' } },
          { synonyms: { has: certName } }
        ]
      }
    });
  }

  /**
   * Calculate total years of experience from work history
   */
  async calculateTotalExperience(tx, employeeId) {
    const workExperiences = await tx.employee_work_experiences.findMany({
      where: { employee_id: employeeId },
      select: { start_date: true, end_date: true }
    });

    if (workExperiences.length === 0) return 0;

    let totalMonths = 0;

    for (const exp of workExperiences) {
      if (exp.start_date) {
        const start = new Date(exp.start_date);
        const end = exp.end_date ? new Date(exp.end_date) : new Date();

        const months = (end.getFullYear() - start.getFullYear()) * 12
                     + (end.getMonth() - start.getMonth());

        totalMonths += Math.max(0, months);
      }
    }

    const totalYears = Math.floor(totalMonths / 12);
    return totalYears;
  }

  /**
   * Calculate LLM cost based on model and tokens
   *
   * @param {Object} jsonData - Extraction data with model info
   * @returns {Number} Estimated cost in USD
   */
  calculateCost(jsonData) {
    const model = jsonData.model_used || jsonData.llm_model_used || 'gpt-4';
    const tokens = jsonData.llm_tokens_used || 0;

    // Pricing per 1M tokens (as of Oct 2025)
    const pricing = {
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-opus': { input: 15.00, output: 75.00 }
    };

    const modelPricing = pricing[model] || pricing['gpt-4'];

    // Assume 70% input, 30% output ratio
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    const cost = (inputTokens * modelPricing.input / 1000000) +
                 (outputTokens * modelPricing.output / 1000000);

    return Number(cost.toFixed(6));
  }
}

module.exports = CVExtractionService;
