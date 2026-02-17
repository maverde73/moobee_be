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
  try {
    const { name, description, category, orderIndex, isActive, code, nameEn, descriptionEn, evaluationCriteria } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const skillCode = code || name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const skill = await prisma.soft_skills.create({
      data: {
        name,
        nameEn: nameEn || name,
        description: description || null,
        descriptionEn: descriptionEn || description || null,
        category: category || 'general',
        orderIndex: orderIndex != null ? parseInt(orderIndex) : 0,
        isActive: isActive !== false,
        code: skillCode,
        evaluationCriteria: evaluationCriteria || null,
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: String(skill.id),
        code: skill.code,
        name: skill.name,
        nameEn: skill.nameEn,
        category: skill.category,
        description: skill.description
      }
    });
  } catch (error) {
    console.error('Error in POST /skills:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A soft skill with this code already exists' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/skills/:id', authenticate, async (req, res) => {
  try {
    const skillId = parseInt(req.params.id);
    if (isNaN(skillId)) {
      return res.status(400).json({ success: false, message: 'Invalid skill ID' });
    }

    const { name, description, category, orderIndex, isActive, nameEn, descriptionEn, evaluationCriteria } = req.body;

    const data = { updatedAt: new Date() };
    if (name !== undefined) data.name = name;
    if (nameEn !== undefined) data.nameEn = nameEn;
    if (description !== undefined) data.description = description;
    if (descriptionEn !== undefined) data.descriptionEn = descriptionEn;
    if (category !== undefined) data.category = category;
    if (orderIndex !== undefined) data.orderIndex = parseInt(orderIndex);
    if (isActive !== undefined) data.isActive = isActive;
    if (evaluationCriteria !== undefined) data.evaluationCriteria = evaluationCriteria;

    if (Object.keys(data).length === 1) {
      return res.status(400).json({ success: false, message: 'At least one field to update is required' });
    }

    const skill = await prisma.soft_skills.update({
      where: { id: skillId },
      data
    });

    res.json({
      success: true,
      data: {
        id: String(skill.id),
        code: skill.code,
        name: skill.name,
        nameEn: skill.nameEn,
        category: skill.category,
        description: skill.description
      }
    });
  } catch (error) {
    console.error('Error in PUT /skills/:id:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Soft skill not found' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
