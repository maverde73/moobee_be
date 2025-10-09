/**
 * CV Data Save Service
 * Saves extracted CV data from extraction_result JSON to database tables
 * Created: 6 October 2025, 22:00
 * Updated: 7 October 2025, 23:00 - Added skill validation + fallback lookup
 */

const prisma = require('../config/database');

/**
 * Validate that Python-provided skill ID matches the skill_name
 * @param {number} skillId - ID provided by Python
 * @param {string} skillName - Skill name from extraction
 * @returns {Promise<boolean>} - true if ID is valid, false if mismatch
 */
async function validateSkillId(skillId, skillName) {
  if (!skillId || !skillName) return false;

  try {
    const skillRecord = await prisma.skills.findUnique({
      where: { id: skillId },
      select: { id: true, Skill: true, NameKnown_Skill: true, Synonyms_Skill: true }
    });

    if (!skillRecord) {
      console.log(`[Skill Validation] ❌ ID ${skillId} not found in skills table`);
      return false;
    }

    // Check if skill_name matches any of: Skill, NameKnown_Skill, or Synonyms_Skill
    const cleanName = skillName.trim().toLowerCase();
    const skillLower = (skillRecord.Skill || '').toLowerCase();
    const nameKnownLower = (skillRecord.NameKnown_Skill || '').toLowerCase();
    const synonyms = skillRecord.Synonyms_Skill || [];

    // Exact match on main field
    if (skillLower === cleanName) {
      console.log(`[Skill Validation] ✅ ID ${skillId} matches "${skillName}" (Skill field)`);
      return true;
    }

    // Exact match on NameKnown
    if (nameKnownLower === cleanName) {
      console.log(`[Skill Validation] ✅ ID ${skillId} matches "${skillName}" (NameKnown_Skill field)`);
      return true;
    }

    // Check synonyms
    const matchingSynonym = synonyms.find(syn => syn.toLowerCase() === cleanName);
    if (matchingSynonym) {
      console.log(`[Skill Validation] ✅ ID ${skillId} matches "${skillName}" (Synonyms_Skill)`);
      return true;
    }

    // Partial match check (for safety)
    if (skillLower.includes(cleanName) || cleanName.includes(skillLower)) {
      console.log(`[Skill Validation] ⚠️ ID ${skillId} partial match "${skillName}" ↔ "${skillRecord.Skill}"`);
      return true; // Accept partial match
    }

    // Mismatch!
    console.log(`[Skill Validation] ❌ ID ${skillId} ("${skillRecord.Skill}") does NOT match "${skillName}" - DISCARDING ID`);
    return false;

  } catch (error) {
    console.error(`[Skill Validation] Error validating ID ${skillId}:`, error.message);
    return false;
  }
}

/**
 * Search for skill ID in database using multi-level fallback
 * @param {string} skillName - Skill name to search
 * @returns {Promise<number|null>} - Skill ID or null if not found
 */
async function findSkillIdByName(skillName) {
  if (!skillName || skillName.trim() === '') return null;

  const cleanName = skillName.trim();

  try {
    // Level 1: Exact match on "Skill" field
    let skillRecord = await prisma.skills.findFirst({
      where: {
        Skill: { equals: cleanName, mode: 'insensitive' }
      },
      select: { id: true, Skill: true }
    });

    if (skillRecord) {
      console.log(`[Skill Lookup] ✅ Level 1 - Exact match on Skill: "${cleanName}" → ID ${skillRecord.id}`);
      return skillRecord.id;
    }

    // Level 2: Exact match on "NameKnown_Skill" field
    skillRecord = await prisma.skills.findFirst({
      where: {
        NameKnown_Skill: { equals: cleanName, mode: 'insensitive' }
      },
      select: { id: true, Skill: true }
    });

    if (skillRecord) {
      console.log(`[Skill Lookup] ✅ Level 2 - Exact match on NameKnown_Skill: "${cleanName}" → ID ${skillRecord.id}`);
      return skillRecord.id;
    }

    // Level 3: Partial match on "Skill" field (contains)
    skillRecord = await prisma.skills.findFirst({
      where: {
        Skill: { contains: cleanName, mode: 'insensitive' }
      },
      select: { id: true, Skill: true }
    });

    if (skillRecord) {
      console.log(`[Skill Lookup] ✅ Level 3 - Partial match on Skill: "${cleanName}" → ID ${skillRecord.id} ("${skillRecord.Skill}")`);
      return skillRecord.id;
    }

    // Level 4: Partial match on "NameKnown_Skill"
    skillRecord = await prisma.skills.findFirst({
      where: {
        NameKnown_Skill: { contains: cleanName, mode: 'insensitive' }
      },
      select: { id: true, Skill: true }
    });

    if (skillRecord) {
      console.log(`[Skill Lookup] ✅ Level 4 - Partial match on NameKnown_Skill: "${cleanName}" → ID ${skillRecord.id}`);
      return skillRecord.id;
    }

    // Level 5: Search in Synonyms_Skill array
    // Prisma doesn't support array search directly, use raw query
    const synonymResult = await prisma.$queryRaw`
      SELECT id, "Skill"
      FROM skills
      WHERE EXISTS (
        SELECT 1 FROM unnest("Synonyms_Skill") AS syn
        WHERE LOWER(syn) = LOWER(${cleanName})
      )
      LIMIT 1
    `;

    if (synonymResult && synonymResult.length > 0) {
      console.log(`[Skill Lookup] ✅ Level 5 - Found in Synonyms_Skill: "${cleanName}" → ID ${synonymResult[0].id}`);
      return synonymResult[0].id;
    }

    // Not found in any level
    console.log(`[Skill Lookup] ❌ Not found: "${cleanName}"`);
    return null;

  } catch (error) {
    console.error(`[Skill Lookup] Error searching for "${cleanName}":`, error.message);
    return null;
  }
}

class CVDataSaveService {
  /**
   * Normalize company name for duplicate detection
   * Handles: case, legal suffixes, special chars, multiple companies
   *
   * Examples:
   *   "Taal Srl" → "taal"
   *   "RINGMASTER - Lottomatica" → "ringmaster lottomatica"
   *   "CheBanca! e KBCI" → "chebanca kbci"
   *
   * @param {string} companyName - Original company name
   * @returns {string} - Normalized name
   */
  normalizeCompanyName(companyName) {
    if (!companyName) return '';

    let normalized = companyName
      .toLowerCase()
      .trim();

    // Remove legal suffixes (Italian and international)
    const legalSuffixes = [
      'srl', 's.r.l.', 's.r.l', 'spa', 's.p.a.', 's.p.a',
      'ltd', 'ltd.', 'inc', 'inc.', 'llc', 'llc.',
      'gmbh', 'sa', 's.a.', 'ag', 'nv', 'bv',
      'corporation', 'corp', 'corp.', 'limited',
      'company', 'co.', 'co'
    ];

    // Remove suffixes (with word boundaries)
    legalSuffixes.forEach(suffix => {
      const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    });

    // Remove special characters but keep spaces
    normalized = normalized
      .replace(/[&!.,\-()]/g, ' ')  // Replace special chars with space
      .replace(/\s+/g, ' ')          // Collapse multiple spaces
      .trim();

    // Handle multiple companies separated by "e", "and", "/"
    // "CheBanca e KBCI" → "chebanca kbci"
    normalized = normalized
      .replace(/\b(e|and|et)\b/g, ' ')
      .replace(/\//g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized;
  }

  /**
   * Save all extracted data from cv_extraction to employee tables
   * @param {string} cvExtractionId - UUID of cv_extraction record
   * @returns {Promise<{success: boolean, stats: object}>}
   */
  async saveExtractedDataToTables(cvExtractionId) {
    try {
      console.log(`[CV Data Save] Starting for extraction ${cvExtractionId}`);

      // Get extraction record
      const extraction = await prisma.cv_extractions.findUnique({
        where: { id: cvExtractionId }
      });

      if (!extraction) {
        throw new Error('CV extraction not found');
      }

      if (!extraction.extraction_result) {
        throw new Error('No extraction_result data found');
      }

      const data = extraction.extraction_result;
      const employeeId = extraction.employee_id;
      const tenantId = extraction.tenant_id;

      // Get employee to verify tenant
      const employee = await prisma.employees.findUnique({
        where: { id: employeeId },
        select: { tenant_id: true }
      });

      if (!employee) {
        throw new Error(`Employee ${employeeId} not found`);
      }

      // Use employee's tenant_id as source of truth
      const finalTenantId = employee.tenant_id;

      const stats = {
        personal_info_updated: false,
        education_created: 0,
        education_updated: 0,
        work_experiences_created: 0,
        work_experiences_updated: 0,
        skills_saved: 0,
        languages_created: 0,
        languages_updated: 0,
        certifications_created: 0,
        certifications_updated: 0,
        domain_knowledge_saved: 0
      };

      // Save Personal Info to employees table (if available)
      if (data.personal_info && Object.keys(data.personal_info).length > 0) {
        const personalInfo = data.personal_info;

        // Get current employee data to check which fields are empty
        const currentEmployee = await prisma.employees.findUnique({
          where: { id: employeeId },
          select: {
            first_name: true,
            last_name: true,
            email: true,
            phone: true
          }
        });

        if (!currentEmployee) {
          console.log(`[CV Data Save] Employee ${employeeId} not found, skipping personal info update`);
        } else {
          const updateData = {};

          // Only update fields that are present in CV AND currently empty/null in DB
          if (personalInfo.full_name) {
            // Split full name into first_name and last_name
            const nameParts = personalInfo.full_name.trim().split(' ');
            const cvFirstName = nameParts[0];
            const cvLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

            // Update first_name only if currently empty or different
            if (!currentEmployee.first_name || currentEmployee.first_name.trim() === '') {
              updateData.first_name = cvFirstName;
            }

            // Update last_name only if currently empty or different
            if (cvLastName && (!currentEmployee.last_name || currentEmployee.last_name.trim() === '')) {
              updateData.last_name = cvLastName;
            }
          }

          // Update email only if currently empty
          if (personalInfo.email && (!currentEmployee.email || currentEmployee.email.trim() === '')) {
            updateData.email = personalInfo.email;
          }

          // Update phone only if currently empty
          if (personalInfo.phone && (!currentEmployee.phone || currentEmployee.phone.trim() === '')) {
            updateData.phone = personalInfo.phone;
          }

          // Update employee record if we have data to update
          if (Object.keys(updateData).length > 0) {
            await prisma.employees.update({
              where: { id: employeeId },
              data: {
                ...updateData,
                updated_at: new Date()
              }
            });
            stats.personal_info_updated = true;
            console.log(`[CV Data Save] Personal info updated for employee ${employeeId}:`, Object.keys(updateData));
          } else {
            console.log(`[CV Data Save] No personal info fields to update (all fields already populated)`);
          }

          // Save all additional personal info to employee_additional_info
          if (personalInfo.email || personalInfo.phone || personalInfo.location ||
              personalInfo.date_of_birth || personalInfo.place_of_birth ||
              personalInfo.nationality || personalInfo.marital_status ||
              personalInfo.personal_email || personalInfo.personal_phone ||
              personalInfo.linkedin_url || personalInfo.github_url ||
              personalInfo.portfolio_url || personalInfo.hobbies_interests ||
              personalInfo.volunteer_experience) {
            console.log(`[CV Data Save] Saving comprehensive personal info to employee_additional_info`);

            // Parse date_of_birth if present
            let dateOfBirth = null;
            if (personalInfo.date_of_birth) {
              try {
                dateOfBirth = new Date(personalInfo.date_of_birth);
                if (isNaN(dateOfBirth.getTime())) {
                  console.warn(`[CV Data Save] Invalid date_of_birth: ${personalInfo.date_of_birth}`);
                  dateOfBirth = null;
                }
              } catch (e) {
                console.warn(`[CV Data Save] Error parsing date_of_birth: ${e.message}`);
                dateOfBirth = null;
              }
            }

            // Parse hobbies_interests to array (Prisma String[] field)
            let hobbiesArray = [];
            if (personalInfo.hobbies_interests) {
              if (typeof personalInfo.hobbies_interests === 'string') {
                // Split by comma, semicolon, or newline
                hobbiesArray = personalInfo.hobbies_interests
                  .split(/[,;\n]+/)
                  .map(s => s.trim())
                  .filter(s => s.length > 0);
              } else if (Array.isArray(personalInfo.hobbies_interests)) {
                hobbiesArray = personalInfo.hobbies_interests;
              }
            }

            await prisma.employee_additional_info.upsert({
              where: { employee_id: employeeId },
              update: {
                personal_email: personalInfo.personal_email || personalInfo.email || undefined,
                personal_phone: personalInfo.personal_phone || personalInfo.phone || undefined,
                date_of_birth: dateOfBirth || undefined,
                place_of_birth: personalInfo.place_of_birth || undefined,
                nationality: personalInfo.nationality || undefined,
                marital_status: personalInfo.marital_status || undefined,
                linkedin_url: personalInfo.linkedin_url || undefined,
                github_url: personalInfo.github_url || undefined,
                portfolio_url: personalInfo.portfolio_url || undefined,
                hobbies_interests: hobbiesArray.length > 0 ? hobbiesArray : undefined,
                volunteer_experience: personalInfo.volunteer_experience || undefined,
                cv_extractions: cvExtractionId ? {
                  connect: { id: cvExtractionId }
                } : undefined,
                updated_at: new Date()
              },
              create: {
                employees: {
                  connect: { id: employeeId }
                },
                tenants: {
                  connect: { id: finalTenantId }
                },
                personal_email: personalInfo.personal_email || personalInfo.email || null,
                personal_phone: personalInfo.personal_phone || personalInfo.phone || null,
                date_of_birth: dateOfBirth,
                place_of_birth: personalInfo.place_of_birth || null,
                nationality: personalInfo.nationality || null,
                marital_status: personalInfo.marital_status || null,
                linkedin_url: personalInfo.linkedin_url || null,
                github_url: personalInfo.github_url || null,
                portfolio_url: personalInfo.portfolio_url || null,
                hobbies_interests: hobbiesArray,
                volunteer_experience: personalInfo.volunteer_experience || null,
                cv_extractions: cvExtractionId ? {
                  connect: { id: cvExtractionId }
                } : undefined,
                created_at: new Date(),
                updated_at: new Date()
              }
            });

            console.log(`[CV Data Save] Comprehensive personal info saved: date_of_birth=${dateOfBirth ? 'YES' : 'NO'}, nationality=${personalInfo.nationality || 'N/A'}, linkedin=${personalInfo.linkedin_url ? 'YES' : 'NO'}`);
          }
        }
      }

      // Save Education
      if (data.education && Array.isArray(data.education)) {
        for (const edu of data.education) {
          const eduStartDate = edu.start_date ? new Date(edu.start_date) : null;
          const eduEndDate = edu.end_date ? new Date(edu.end_date) : null;

          // Check for existing education to prevent duplicates
          const existingEducation = await prisma.employee_education.findFirst({
            where: {
              employee_id: employeeId,
              institution_name: edu.institution_name || 'Unknown',
              degree_name: edu.degree_name || 'Unknown',
              start_date: eduStartDate
            }
          });

          if (existingEducation) {
            // UPDATE existing record
            await prisma.employee_education.update({
              where: { id: existingEducation.id },
              data: {
                field_of_study: edu.field_of_study || existingEducation.field_of_study,
                end_date: eduEndDate || existingEducation.end_date,
                is_current: edu.is_current !== undefined ? edu.is_current : existingEducation.is_current,
                grade: edu.grade || existingEducation.grade,
                cv_extractions: cvExtractionId ? {
                  connect: { id: cvExtractionId }
                } : undefined,
                updated_at: new Date()
              }
            });
            console.log(`[CV Data Save] Updated existing education: ${edu.degree_name} at ${edu.institution_name}`);
            stats.education_updated++;
          } else {
            // CREATE new record
            await prisma.employee_education.create({
              data: {
                employees: {
                  connect: { id: employeeId }
                },
                degree_name: edu.degree_name || 'Unknown',
                institution_name: edu.institution_name || 'Unknown',
                field_of_study: edu.field_of_study || null,
                start_date: eduStartDate,
                end_date: eduEndDate,
                is_current: edu.is_current || false,
                cv_extractions: {
                  connect: { id: cvExtractionId }
                },
                tenants: {
                  connect: { id: finalTenantId }
                }
              }
            });
            console.log(`[CV Data Save] Created new education: ${edu.degree_name} at ${edu.institution_name}`);
            stats.education_created++;
          }
        }
      }

      // Save Work Experiences
      if (data.work_experience && Array.isArray(data.work_experience)) {
        for (const work of data.work_experience) {
          let companyId = null;

          // Check if company exists, create if not
          if (work.company_name && work.company_name !== 'Unknown') {
            // Advanced company name normalization
            const companyNameNormalized = this.normalizeCompanyName(work.company_name);

            let company = await prisma.companies.findFirst({
              where: {
                normalized_name: companyNameNormalized
              }
            });

            if (!company) {
              // Create new company
              company = await prisma.companies.create({
                data: {
                  name: work.company_name,
                  normalized_name: companyNameNormalized,
                  industry_id: null, // Can be filled later
                  website: null
                }
              });
              console.log(`[CV Data Save] Created new company: ${work.company_name} (normalized: ${companyNameNormalized})`);
            } else {
              console.log(`[CV Data Save] Found existing company: ${company.name} (normalized: ${companyNameNormalized})`);
            }

            companyId = company.id;
          }

          // Check for existing work experience to prevent duplicates
          const startDate = work.start_date ? new Date(work.start_date) : null;
          const endDate = work.end_date ? new Date(work.end_date) : null;

          const existingWorkExp = await prisma.employee_work_experiences.findFirst({
            where: {
              employee_id: employeeId,
              company_name: work.company_name || 'Unknown',
              job_title: work.job_title || 'Unknown',
              start_date: startDate
            }
          });

          if (existingWorkExp) {
            // UPDATE existing record
            await prisma.employee_work_experiences.update({
              where: { id: existingWorkExp.id },
              data: {
                companies: (companyId && companyId !== existingWorkExp.company_id) ? {
                  connect: { id: companyId }
                } : undefined,
                company_location: work.company_location || existingWorkExp.company_location,
                end_date: endDate || existingWorkExp.end_date,
                is_current: work.is_current !== undefined ? work.is_current : existingWorkExp.is_current,
                description: work.description || existingWorkExp.description,
                responsibilities: work.responsibilities?.length > 0 ? work.responsibilities : existingWorkExp.responsibilities,
                achievements: work.achievements?.length > 0 ? work.achievements : existingWorkExp.achievements,
                cv_extractions: cvExtractionId ? { connect: { id: cvExtractionId } } : undefined,
                updated_at: new Date()
              }
            });
            console.log(`[CV Data Save] Updated existing work experience: ${work.job_title} at ${work.company_name}`);
            stats.work_experiences_updated++;
          } else {
            // CREATE new record
            await prisma.employee_work_experiences.create({
              data: {
                employees: {
                  connect: { id: employeeId }
                },
                companies: companyId ? {
                  connect: { id: companyId }
                } : undefined,
                company_name: work.company_name || 'Unknown',
                company_location: work.company_location || null,
                job_title: work.job_title || 'Unknown',
                start_date: startDate,
                end_date: endDate,
                is_current: work.is_current || false,
                description: work.description || null,
                responsibilities: work.responsibilities || [],
                achievements: work.achievements || [],
                cv_extractions: {
                  connect: { id: cvExtractionId }
                },
                tenants: {
                  connect: { id: finalTenantId }
                }
              }
            });
            console.log(`[CV Data Save] Created new work experience: ${work.job_title} at ${work.company_name}`);
            stats.work_experiences_created++;
          }
        }
      }

      // Save Skills (only extracted_skills with matched IDs)
      console.log(`[CV Data Save] Checking skills data...`);
      console.log(`[CV Data Save] data.skills exists: ${!!data.skills}`);
      console.log(`[CV Data Save] data.skills.extracted_skills exists: ${!!data.skills?.extracted_skills}`);
      console.log(`[CV Data Save] extracted_skills count: ${data.skills?.extracted_skills?.length || 0}`);

      if (data.skills && data.skills.extracted_skills && Array.isArray(data.skills.extracted_skills)) {
        console.log(`[CV Data Save] Processing ${data.skills.extracted_skills.length} skills...`);

        for (const skill of data.skills.extracted_skills) {
          console.log(`[CV Data Save] Processing skill: ${skill.skill_name} (ID from Python: ${skill.id})`);

          let skillId = skill.id;
          let needsFallback = false;

          // STEP 1: Se Python ha fornito un ID, VALIDARLO
          if (skillId && skillId !== null) {
            const isValidId = await validateSkillId(skillId, skill.skill_name);

            if (!isValidId) {
              console.log(`[CV Data Save] ⚠️ Python ID ${skillId} is INVALID for "${skill.skill_name}", discarding and using fallback`);
              skillId = null;
              needsFallback = true;
              stats.skills_validation_failed = (stats.skills_validation_failed || 0) + 1;
            } else {
              console.log(`[CV Data Save] ✅ Python ID ${skillId} validated for "${skill.skill_name}"`);
            }
          } else {
            needsFallback = true;
          }

          // STEP 2: Se ID non valido o mancante, usa fallback lookup
          if (needsFallback || !skillId) {
            console.log(`[CV Data Save] Attempting fallback lookup for "${skill.skill_name}"...`);
            skillId = await findSkillIdByName(skill.skill_name);

            if (skillId) {
              stats.skills_fallback_found = (stats.skills_fallback_found || 0) + 1;
            }
          }

          // STEP 3: Salva skill se abbiamo un ID valido
          if (skillId) {
            try {
              // Check if skill already exists
              const existing = await prisma.employee_skills.findFirst({
                where: {
                  employee_id: employeeId,
                  skill_id: skillId
                }
              });

              if (existing) {
                console.log(`[CV Data Save] ⚠️ Skill already exists: ${skill.skill_name} (ID: ${skillId})`);
              } else {
                await prisma.employee_skills.create({
                  data: {
                    employees: {
                      connect: { id: employeeId }
                    },
                    skill_id: skillId,
                    proficiency_level: 0, // Default, can be updated later
                    source: 'cv_extracted',
                    cv_extractions: {
                      connect: { id: cvExtractionId }
                    },
                    tenants: {
                      connect: { id: finalTenantId }
                    }
                  }
                });
                stats.skills_saved++;
                console.log(`[CV Data Save] ✅ Skill saved: ${skill.skill_name} (ID: ${skillId})`);
              }
            } catch (error) {
              console.error(`[CV Data Save] ❌ Error saving skill ${skill.skill_name}:`, error.message);
            }
          } else {
            console.log(`[CV Data Save] ⚠️ Skill not found in database, skipping: ${skill.skill_name}`);
            stats.skills_not_found = (stats.skills_not_found || 0) + 1;
          }
        }

        console.log(`[CV Data Save] ✅ Skills processing complete.`);
        console.log(`[CV Data Save]    - Saved: ${stats.skills_saved}`);
        console.log(`[CV Data Save]    - Validation failed (ID discarded): ${stats.skills_validation_failed || 0}`);
        console.log(`[CV Data Save]    - Fallback found: ${stats.skills_fallback_found || 0}`);
        console.log(`[CV Data Save]    - Not found: ${stats.skills_not_found || 0}`);
      } else {
        console.log(`[CV Data Save] ⚠️ No skills data to process`);
      }

      // Save Languages
      console.log(`[CV Data Save] Checking languages data...`);
      console.log(`[CV Data Save] data.languages exists: ${!!data.languages}`);
      console.log(`[CV Data Save] languages count: ${data.languages?.length || 0}`);
      console.log(`[CV Data Save] languages data:`, JSON.stringify(data.languages, null, 2));

      if (data.languages && Array.isArray(data.languages)) {
        console.log(`[CV Data Save] Processing ${data.languages.length} languages...`);

        for (const lang of data.languages) {
          // Extract language name from CV data
          const languageName = lang.language || lang.language_name;
          console.log(`[CV Data Save] Processing language: ${languageName || 'UNNAMED'}`);

          if (!languageName) {
            console.log(`[CV Data Save] ⚠️ Skipping language - no name provided:`, lang);
            continue;
          }

          // Find language_id from languages table by name
          const languageRecord = await prisma.languages.findFirst({
            where: {
              OR: [
                { name: { equals: languageName, mode: 'insensitive' } },
                { name: { contains: languageName, mode: 'insensitive' } }
              ]
            }
          });

          if (languageRecord) {
            console.log(`[CV Data Save] ✅ Language found in master table: ${languageName} (ID: ${languageRecord.id})`);

            // Map proficiency to CEF levels
            // Proficiency can be: "Native", "Fluent", "Professional", "Intermediate", "Basic"
            // CEF levels: A1, A2, B1, B2, C1, C2
            let cefLevel = lang.cef_level; // Use explicit CEF level if provided

            if (!cefLevel && lang.proficiency) {
              // Map proficiency to approximate CEF level
              const proficiencyMap = {
                'Native': 'C2',
                'Fluent': 'C1',
                'Professional': 'B2',
                'Intermediate': 'B1',
                'Basic': 'A2'
              };
              cefLevel = proficiencyMap[lang.proficiency] || null;
              console.log(`[CV Data Save] Mapped proficiency "${lang.proficiency}" to CEF level: ${cefLevel}`);
            }

            try {
              // Check if already exists
              const existing = await prisma.employee_languages.findFirst({
                where: {
                  employee_id: employeeId,
                  language_id: languageRecord.id
                }
              });

              if (existing) {
                console.log(`[CV Data Save] ⚠️ Language already exists, updating: ${languageName}`);
                // UPDATE existing language with new proficiency data
                await prisma.employee_languages.update({
                  where: { id: existing.id },
                  data: {
                    listening_level: cefLevel || existing.listening_level,
                    reading_level: cefLevel || existing.reading_level,
                    spoken_interaction_level: cefLevel || existing.spoken_interaction_level,
                    spoken_production_level: cefLevel || existing.spoken_production_level,
                    writing_level: cefLevel || existing.writing_level,
                    is_native: (lang.proficiency === 'Native') || existing.is_native,
                    cv_extractions: cvExtractionId ? { connect: { id: cvExtractionId } } : undefined,
                    updated_at: new Date()
                  }
                });
                console.log(`[CV Data Save] ✅ Updated existing language: ${languageName} (${lang.proficiency || cefLevel})`);
                stats.languages_updated++;
              } else {
                console.log(`[CV Data Save] Creating new language record: ${languageName}`);
                // CREATE new language
                await prisma.employee_languages.create({
                data: {
                  employees: {
                    connect: { id: employeeId }
                  },
                  languages: {
                    connect: { id: languageRecord.id }
                  },
                  listening_level: cefLevel || null,
                  reading_level: cefLevel || null,
                  spoken_interaction_level: cefLevel || null,
                  spoken_production_level: cefLevel || null,
                  writing_level: cefLevel || null,
                  is_native: (lang.proficiency === 'Native') || false,
                  cv_extractions: {
                    connect: { id: cvExtractionId }
                  },
                  tenants: {
                    connect: { id: finalTenantId }
                  }
                }
              });
                console.log(`[CV Data Save] ✅ Created new language: ${languageName} (${lang.proficiency || cefLevel})`);
                stats.languages_created++;
              }
            } catch (error) {
              console.error(`[CV Data Save] ❌ Error saving language ${languageName}:`, error.message);
            }
          } else {
            console.log(`[CV Data Save] ❌ Language not found in master table: ${languageName}`);
          }
        }

        console.log(`[CV Data Save] ✅ Languages processing complete. Created: ${stats.languages_created}, Updated: ${stats.languages_updated}`);
      } else {
        console.log(`[CV Data Save] ⚠️ No languages data to process`);
      }

      // Save Certifications
      if (data.certifications && Array.isArray(data.certifications)) {
        for (const cert of data.certifications) {
          // Check for existing certification to prevent duplicates
          const existingCertification = await prisma.employee_certifications.findFirst({
            where: {
              employee_id: employeeId,
              certification_name: cert.certification_name || 'Unknown',
              issuing_organization: cert.issuing_organization || null
            }
          });

          if (existingCertification) {
            // UPDATE existing record
            await prisma.employee_certifications.update({
              where: { id: existingCertification.id },
              data: {
                issue_date: cert.issue_date ? new Date(cert.issue_date) : existingCertification.issue_date,
                expiry_date: cert.expiry_date ? new Date(cert.expiry_date) : existingCertification.expiry_date,
                credential_id: cert.credential_id || existingCertification.credential_id,
                credential_url: cert.credential_url || existingCertification.credential_url,
                is_active: true,
                cv_extractions: cvExtractionId ? { connect: { id: cvExtractionId } } : undefined,
                updated_at: new Date()
              }
            });
            console.log(`[CV Data Save] Updated existing certification: ${cert.certification_name}`);
            stats.certifications_updated++;
          } else {
            // CREATE new record
            await prisma.employee_certifications.create({
              data: {
                employees: {
                  connect: { id: employeeId }
                },
                certification_name: cert.certification_name || 'Unknown',
                issuing_organization: cert.issuing_organization || null,
                issue_date: cert.issue_date ? new Date(cert.issue_date) : null,
                expiry_date: cert.expiry_date ? new Date(cert.expiry_date) : null,
                credential_id: cert.credential_id || null,
                credential_url: cert.credential_url || null,
                is_active: true,
                cv_extractions: {
                  connect: { id: cvExtractionId }
                },
                tenants: {
                  connect: { id: finalTenantId }
                }
              }
            });
            console.log(`[CV Data Save] Created new certification: ${cert.certification_name}`);
            stats.certifications_created++;
          }
        }
      }

      // Save Domain Knowledge
      console.log(`[CV Data Save] Checking domain_knowledge:`, JSON.stringify(data.domain_knowledge, null, 2));
      if (data.domain_knowledge && Object.keys(data.domain_knowledge).length > 0) {
        const dk = data.domain_knowledge;
        let totalDomainsSaved = 0;
        console.log(`[CV Data Save] Domain knowledge found, processing...`);

        // Define domain type mapping
        const domainCategories = [
          { key: 'industry_domains', type: 'industry' },
          { key: 'standards_protocols', type: 'standard' },
          { key: 'business_processes', type: 'process' },
          { key: 'client_sectors', type: 'sector' }
        ];

        for (const category of domainCategories) {
          const domains = dk[category.key] || [];
          console.log(`[CV Data Save] Processing ${category.key} (${category.type}): ${domains.length} entries`);

          for (const domainValue of domains) {
            if (!domainValue || domainValue.trim() === '') continue;
            console.log(`[CV Data Save] Saving domain: ${category.type}/${domainValue}`);

            try {
              await prisma.employee_domain_knowledge.upsert({
                where: {
                  employee_id_domain_type_domain_value: {
                    employee_id: employeeId,
                    domain_type: category.type,
                    domain_value: domainValue
                  }
                },
                update: {
                  updated_at: new Date(),
                  cv_extractions: cvExtractionId ? { connect: { id: cvExtractionId } } : undefined,
                  source: 'cv_extracted'
                },
                create: {
                  employees: {
                    connect: { id: employeeId }
                  },
                  domain_type: category.type,
                  domain_value: domainValue,
                  source: 'cv_extracted',
                  cv_extractions: cvExtractionId ? { connect: { id: cvExtractionId } } : undefined,
                  tenants: {
                    connect: { id: finalTenantId }
                  }
                }
              });

              totalDomainsSaved++;
            } catch (error) {
              console.error(`[CV Data Save] Error saving domain knowledge: ${category.type}/${domainValue}`, error.message);
            }
          }
        }

        stats.domain_knowledge_saved = totalDomainsSaved;
        console.log(`[CV Data Save] Domain knowledge saved: ${totalDomainsSaved} entries`);
      }

      // Save Role and Seniority
      console.log(`\n========================================`);
      console.log(`[CV Data Save] 🎯 ROLE SAVE SECTION START`);
      console.log(`========================================`);
      console.log(`[CV Data Save] Checking role data...`);
      console.log(`[CV Data Save] data.role exists: ${!!data.role}`);
      console.log(`[CV Data Save] role data received:`, JSON.stringify(data.role, null, 2));
      console.log(`[CV Data Save] role data type: ${typeof data.role}`);

      // Support both single role object and array of roles
      let rolesArray = [];
      if (data.role && Object.keys(data.role).length > 0) {
        rolesArray = [data.role]; // Single role as array
      } else if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
        rolesArray = data.roles; // Multiple roles
      }

      if (rolesArray.length > 0) {
        console.log(`[CV Data Save] ✅ Role data is present and not empty`);
        console.log(`[CV Data Save] Processing ${rolesArray.length} role(s)...`);

        /**
         * Select which role should be marked as is_current based on priority:
         * 1. Highest seniority (Senior > Mid > Junior > null)
         * 2. Highest anni_esperienza
         * 3. First in array
         */
        function selectCurrentRoleIndex(roles) {
          if (roles.length === 1) {
            console.log(`[CV Data Save] Single role detected - will be set as is_current`);
            return 0;
          }

          const seniorityOrder = { 'Senior': 3, 'Mid': 2, 'Junior': 1 };

          const rolesWithIndex = roles.map((role, index) => ({
            ...role,
            originalIndex: index,
            seniorityValue: seniorityOrder[role.seniority] || 0,
            experience: role.years_experience || role.total_years_experience || 0
          }));

          // Sort by seniority DESC, then experience DESC
          rolesWithIndex.sort((a, b) => {
            if (a.seniorityValue !== b.seniorityValue) {
              return b.seniorityValue - a.seniorityValue; // Higher seniority first
            }
            return b.experience - a.experience; // Higher experience first
          });

          const selected = rolesWithIndex[0];
          console.log(`[CV Data Save] Multiple roles detected - selected index ${selected.originalIndex} as is_current (seniority: ${selected.seniority || 'none'}, experience: ${selected.experience} years)`);
          return selected.originalIndex;
        }

        const currentRoleIndex = selectCurrentRoleIndex(rolesArray);
        let rolesProcessed = 0;

        // Process each role
        for (let i = 0; i < rolesArray.length; i++) {
          const roleData = rolesArray[i];
          const isCurrent = (i === currentRoleIndex);

          console.log(`\n[CV Data Save] --- Processing role ${i + 1}/${rolesArray.length} (is_current: ${isCurrent}) ---`);
          console.log(`[CV Data Save] Role data fields:`, Object.keys(roleData));
          console.log(`[CV Data Save] id_sub_role: ${roleData.id_sub_role}`);
          console.log(`[CV Data Save] id_role: ${roleData.id_role}`);
          console.log(`[CV Data Save] matched_sub_role: ${roleData.matched_sub_role}`);
          console.log(`[CV Data Save] matched_role: ${roleData.matched_role}`);
          console.log(`[CV Data Save] seniority: ${roleData.seniority || 'N/A'}`);

          let subRoleId = null;
          let roleId = null;

          // Priority 1: Use IDs directly from extraction result if available
          if (roleData.id_sub_role && roleData.id_role) {
            subRoleId = roleData.id_sub_role;
            roleId = roleData.id_role;
            console.log(`[CV Data Save] ✅ Using extracted IDs: role_id=${roleId}, sub_role_id=${subRoleId}`);
          }
          // Priority 2: Try to find matching sub_role by name
          else if (roleData.matched_sub_role) {
            console.log(`[CV Data Save] ⚠️ Extracted IDs not available (id_sub_role: ${roleData.id_sub_role}, id_role: ${roleData.id_role}) - trying fallback...`);
            const subRole = await prisma.sub_roles.findFirst({
              where: {
                OR: [
                  { Sub_Role: { contains: roleData.matched_sub_role, mode: 'insensitive' } },
                  { NameKnown_Sub_Role: { contains: roleData.matched_sub_role, mode: 'insensitive' } }
                ]
              }
            });

            if (subRole) {
              subRoleId = subRole.id;

              // Find parent role_id from role_sub_role mapping
              const roleMapping = await prisma.role_sub_role.findFirst({
                where: {
                  id_sub_role: subRoleId
                },
                select: {
                  id_role: true
                }
              });

              if (roleMapping) {
                roleId = roleMapping.id_role;
                console.log(`[CV Data Save] Found parent role_id ${roleId} for sub_role_id ${subRoleId}`);
              } else {
                console.log(`[CV Data Save] Warning: No parent role found for sub_role_id ${subRoleId}`);
                roleId = null;
              }
            } else {
              console.log(`[CV Data Save] ❌ Sub-role not found: ${roleData.matched_sub_role}`);
            }
          } else {
            console.log(`[CV Data Save] ⚠️ No matched_sub_role available for fallback lookup`);
          }

          // Extract years of experience
          const anniEsperienza = roleData.years_experience || roleData.total_years_experience || 0;
          console.log(`[CV Data Save] Years of experience: ${anniEsperienza}`);

          // Check if role already exists (to avoid duplicates)
          console.log(`[CV Data Save] Checking for existing role: employee_id=${employeeId}, sub_role_id=${subRoleId}`);

          try {
            const existingRole = await prisma.employee_roles.findFirst({
              where: {
                employee_id: employeeId,
                sub_role_id: subRoleId
              }
            });

            if (existingRole) {
              console.log(`[CV Data Save] ⚠️ Role already exists for employee ${employeeId}, sub_role_id ${subRoleId} - updating is_current if needed`);

              // Update is_current if this is the selected current role
              if (isCurrent && !existingRole.is_current) {
                await prisma.employee_roles.update({
                  where: { id: existingRole.id },
                  data: { is_current: true }
                });
                console.log(`[CV Data Save] ✅ Updated existing role to is_current=true`);
              }
              rolesProcessed++;
            } else if (subRoleId && roleId) {
              console.log(`[CV Data Save] Creating new employee_role record...`);
              await prisma.employee_roles.create({
                data: {
                  employees: {
                    connect: { id: employeeId }
                  },
                  role_id: roleId,
                  sub_role_id: subRoleId,
                  anni_esperienza: anniEsperienza,
                  seniority: roleData.seniority || null,
                  is_current: isCurrent,  // Set based on selection logic
                  tenants: {
                    connect: { id: finalTenantId }
                  }
                }
              });
              rolesProcessed++;
              console.log(`[CV Data Save] ✅ Role saved: ${roleData.matched_sub_role || roleData.role} (role_id: ${roleId}, sub_role_id: ${subRoleId}, ${anniEsperienza} years, seniority: ${roleData.seniority || 'N/A'}, is_current: ${isCurrent})`);
            } else {
              console.log(`[CV Data Save] ❌ Could not save role: role_id=${roleId}, sub_role_id=${subRoleId}`);
              console.log(`[CV Data Save] ❌ Reason: Missing role_id or sub_role_id after all fallback attempts`);
            }
          } catch (error) {
            console.error(`[CV Data Save] ❌ Error saving role:`, error);
            console.error(`[CV Data Save] ❌ Error stack:`, error.stack);
          }
        }

        stats.roles_saved = rolesProcessed;
        console.log(`[CV Data Save] ✅ Processed ${rolesProcessed} role(s)`);
      } else {
        console.log(`[CV Data Save] ❌ No role data to process`);
        console.log(`[CV Data Save] ❌ Condition check: data.role=${!!data.role}, Object.keys length=${data.role ? Object.keys(data.role).length : 'N/A'}`);
      }

      console.log(`========================================`);
      console.log(`[CV Data Save] 🎯 ROLE SAVE SECTION END`);
      console.log(`========================================\n`);

      console.log(`[CV Data Save] Completed for extraction ${cvExtractionId}:`, stats);

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('[CV Data Save] Error:', error);
      return {
        success: false,
        error: error.message,
        stats: {}
      };
    }
  }
}

module.exports = new CVDataSaveService();
