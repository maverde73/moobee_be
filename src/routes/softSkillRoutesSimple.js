const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middlewares/authMiddleware');

// =============== PUBLIC ROUTES ===============

// Get all soft skills from DB
router.get('/skills', async (req, res) => {
  try {
    const skills = await prisma.soft_skills.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' }
    });

    // Map DB fields to the format expected by the frontend
    const formattedSkills = skills.map(skill => ({
      id: String(skill.id),
      code: skill.code,
      name: skill.name,
      nameEn: skill.nameEn || skill.name,
      category: skill.category || 'general',
      description: skill.description || '',
      descriptionEn: skill.descriptionEn || skill.description || '',
      indicators: skill.evaluationCriteria?.indicators || [],
      weight: skill.evaluationCriteria?.weight || 1,
      assessmentMethods: skill.evaluationCriteria?.assessmentMethods || [],
      developmentStrategies: skill.evaluationCriteria?.developmentStrategies || []
    }));

    res.json({
      success: true,
      data: formattedSkills
    });
  } catch (error) {
    console.error('Error in GET /skills:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single soft skill from DB
router.get('/skills/:id', async (req, res) => {
  try {
    const skillId = parseInt(req.params.id);
    if (isNaN(skillId)) {
      return res.status(400).json({ success: false, message: 'Invalid skill ID' });
    }

    const skill = await prisma.soft_skills.findUnique({
      where: { id: skillId }
    });

    if (!skill) {
      return res.status(404).json({ success: false, message: 'Soft skill not found' });
    }

    res.json({
      success: true,
      data: {
        id: String(skill.id),
        code: skill.code,
        name: skill.name,
        nameEn: skill.nameEn || skill.name,
        category: skill.category || 'general',
        description: skill.description || '',
        descriptionEn: skill.descriptionEn || skill.description || '',
        indicators: skill.evaluationCriteria?.indicators || [],
        weight: skill.evaluationCriteria?.weight || 1,
        assessmentMethods: skill.evaluationCriteria?.assessmentMethods || [],
        developmentStrategies: skill.evaluationCriteria?.developmentStrategies || []
      }
    });
  } catch (error) {
    console.error('Error in GET /skills/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get skills for a specific role from DB
router.get('/roles/:roleId/skills', async (req, res) => {
  try {
    const roleId = parseInt(req.params.roleId);
    if (isNaN(roleId)) {
      return res.status(400).json({ success: false, message: 'Invalid role ID' });
    }

    const roleSkills = await prisma.role_soft_skills.findMany({
      where: { roleId },
      include: { soft_skills: true },
      orderBy: { priority: 'asc' }
    });

    const formattedSkills = roleSkills.map(rs => ({
      id: String(rs.soft_skills.id),
      softSkillId: rs.softSkillId,
      name: rs.soft_skills.name,
      nameEn: rs.soft_skills.nameEn || rs.soft_skills.name,
      category: rs.soft_skills.category || 'general',
      priority: rs.priority,
      minScore: rs.minScore,
      weight: rs.weight,
      isRequired: rs.isRequired
    }));

    res.json({
      success: true,
      data: formattedSkills
    });
  } catch (error) {
    console.error('Error in GET /roles/:roleId/skills:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get roles that require a specific skill from DB
router.get('/skills/:skillId/roles', async (req, res) => {
  try {
    const skillId = parseInt(req.params.skillId);
    if (isNaN(skillId)) {
      return res.status(400).json({ success: false, message: 'Invalid skill ID' });
    }

    const roleSkills = await prisma.role_soft_skills.findMany({
      where: { softSkillId: skillId },
      include: { roles: true }
    });

    const formattedRoles = roleSkills.map(rs => ({
      roleId: rs.roleId,
      roleName: rs.roles.Role || `Role ${rs.roleId}`,
      priority: rs.priority,
      minScore: rs.minScore,
      isRequired: rs.isRequired
    }));

    res.json({
      success: true,
      data: formattedRoles
    });
  } catch (error) {
    console.error('Error in GET /skills/:skillId/roles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// =============== AUTHENTICATED ROUTES ===============

router.post('/skills', authenticate, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Not implemented yet'
  });
});

router.put('/skills/:id', authenticate, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Not implemented yet'
  });
});

module.exports = router;
