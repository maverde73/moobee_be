/**
 * Job Family API Routes
 * Provides endpoints for job families and their soft skills
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * GET /api/job-families
 * List all active job families
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const jobFamilies = await prisma.job_family.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            job_family_soft_skills: true
          }
        }
      }
    });

    res.json({
      success: true,
      count: jobFamilies.length,
      job_families: jobFamilies
    });
  } catch (error) {
    console.error('Error fetching job families:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job families'
    });
  }
});

/**
 * GET /api/job-families/:id
 * Get single job family with details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const jobFamily = await prisma.job_family.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            job_family_soft_skills: true,
            assessment_templates: true
          }
        }
      }
    });

    if (!jobFamily) {
      return res.status(404).json({
        success: false,
        error: 'Job family not found'
      });
    }

    res.json({
      success: true,
      job_family: jobFamily
    });
  } catch (error) {
    console.error('Error fetching job family:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job family'
    });
  }
});

/**
 * GET /api/job-families/:id/soft-skills
 * Get soft skills for a job family with full details
 */
router.get('/:id/soft-skills', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { requiredOnly } = req.query;

    // Build where clause
    const where = {
      job_family_id: parseInt(id)
    };

    if (requiredOnly === 'true') {
      where.is_required = true;
    }

    const softSkillMappings = await prisma.job_family_soft_skills.findMany({
      where,
      include: {
        job_family: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        soft_skills: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            description: true,
            category: true,
            code: true
          }
        }
      },
      orderBy: { priority: 'asc' }
    });

    // Transform to flat structure
    const softSkills = softSkillMappings.map(mapping => {
      // Convert Decimal to number properly
      const weightValue = mapping.weight ? parseFloat(mapping.weight.toString()) : 0;

      return {
        id: mapping.soft_skills.id,
        name: mapping.soft_skills.name,
        nameEn: mapping.soft_skills.nameEn,
        description: mapping.description || mapping.soft_skills.description,
        category: mapping.soft_skills.category,
        code: mapping.soft_skills.code,
        priority: mapping.priority,
        min_score: mapping.min_score,
        is_required: mapping.is_required,
        weight: weightValue,
        target_score: mapping.target_score
      };
    });

    res.json({
      success: true,
      job_family: softSkillMappings[0]?.job_family || null,
      count: softSkills.length,
      soft_skills: softSkills
    });
  } catch (error) {
    console.error('Error fetching job family soft skills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch soft skills'
    });
  }
});

module.exports = router;
