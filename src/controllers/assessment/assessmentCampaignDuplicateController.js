/**
 * Assessment Campaign Duplicate Controller
 * Handles campaign duplication and cloning operations
 * Extracted to comply with Giurelli's Standards
 */

const prisma = require('../../config/database');
const campaignValidators = require('./validators/assessmentCampaignValidators');

// Duplicate an assessment campaign
const duplicateCampaign = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id } = req.params;
    const { name, includeAssignments = false } = req.body;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    // Find original campaign
    const original = await findOriginalCampaign(id, tenantId);
    if (!original) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Create duplicate
    const duplicated = await createDuplicate(
      original,
      name || `${original.name} (Copy)`,
      includeAssignments
    );

    res.status(201).json({
      success: true,
      data: duplicated,
      message: 'Campaign duplicated successfully'
    });
  } catch (error) {
    console.error('Error duplicating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate campaign',
      details: error.message
    });
  }
};

// Find original campaign
const findOriginalCampaign = async (campaignId, tenantId) => {
  try {
    const campaign = await prisma.assessmentCampaign.findFirst({
      where: {
        id: campaignId,
        tenantId
      },
      include: {
        assessmentCampaignAssignments: {
          include: {
            tenantUser: true
          }
        },
        assessmentTemplate: true
      }
    });

    return campaign;
  } catch (error) {
    console.error('Error finding campaign:', error);
    throw error;
  }
};

// Create duplicate campaign
const createDuplicate = async (original, newName, includeAssignments) => {
  try {
    const campaignData = {
      name: newName,
      tenantId: original.tenantId,
      assessmentTemplateId: original.assessmentTemplateId,
      startDate: original.startDate,
      endDate: original.endDate,
      frequency: original.frequency,
      status: 'draft' // Always start as draft
    };

    if (includeAssignments && original.assessmentCampaignAssignments.length > 0) {
      campaignData.assessmentCampaignAssignments = {
        create: original.assessmentCampaignAssignments.map(assignment => ({
          tenantUserId: assignment.tenantUserId,
          assignedAt: new Date(),
          status: 'assigned'
        }))
      };
    }

    const duplicated = await prisma.assessmentCampaign.create({
      data: campaignData,
      include: {
        assessmentTemplate: true,
        assessmentCampaignAssignments: {
          include: {
            tenantUser: true
          }
        }
      }
    });

    return duplicated;
  } catch (error) {
    console.error('Error creating duplicate:', error);
    throw error;
  }
};

// Clone campaign with date shift
const cloneCampaignWithShift = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { id } = req.params;
    const { name, dayShift = 0, includeAssignments = false } = req.body;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    // Find original
    const original = await findOriginalCampaign(id, tenantId);
    if (!original) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Calculate shifted dates
    const shiftedDates = calculateShiftedDates(
      original.startDate,
      original.endDate,
      dayShift
    );

    // Create clone with shifted dates
    const cloned = await createClone(
      original,
      name || `${original.name} (Clone)`,
      shiftedDates,
      includeAssignments
    );

    res.status(201).json({
      success: true,
      data: cloned,
      message: 'Campaign cloned successfully'
    });
  } catch (error) {
    console.error('Error cloning campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clone campaign',
      details: error.message
    });
  }
};

// Calculate shifted dates
const calculateShiftedDates = (startDate, endDate, dayShift) => {
  const shiftMs = dayShift * 24 * 60 * 60 * 1000;
  
  return {
    startDate: new Date(startDate.getTime() + shiftMs),
    endDate: new Date(endDate.getTime() + shiftMs)
  };
};

// Create cloned campaign
const createClone = async (original, newName, dates, includeAssignments) => {
  try {
    const campaignData = {
      name: newName,
      tenantId: original.tenantId,
      assessmentTemplateId: original.assessmentTemplateId,
      startDate: dates.startDate,
      endDate: dates.endDate,
      frequency: original.frequency,
      status: 'draft'
    };

    if (includeAssignments && original.assessmentCampaignAssignments.length > 0) {
      campaignData.assessmentCampaignAssignments = {
        create: original.assessmentCampaignAssignments.map(assignment => ({
          tenantUserId: assignment.tenantUserId,
          assignedAt: new Date(),
          status: 'assigned'
        }))
      };
    }

    const cloned = await prisma.assessmentCampaign.create({
      data: campaignData,
      include: {
        assessmentTemplate: true,
        assessmentCampaignAssignments: {
          include: {
            tenantUser: true
          }
        }
      }
    });

    return cloned;
  } catch (error) {
    console.error('Error creating clone:', error);
    throw error;
  }
};

// Batch duplicate campaigns
const batchDuplicateCampaigns = async (req, res) => {
  try {
    const tenantId = req.tenantUser?.tenantId || req.user?.tenantId;
    const { campaignIds, namePrefix = 'Copy of' } = req.body;

    // Validate tenant
    const tenantValidation = campaignValidators.validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tenantValidation.error
      });
    }

    if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campaign IDs must be provided as an array'
      });
    }

    const duplicated = [];
    const failed = [];

    for (const campaignId of campaignIds) {
      try {
        const original = await findOriginalCampaign(campaignId, tenantId);
        if (original) {
          const duplicate = await createDuplicate(
            original,
            `${namePrefix} ${original.name}`,
            false
          );
          duplicated.push(duplicate);
        } else {
          failed.push({ id: campaignId, reason: 'Not found' });
        }
      } catch (error) {
        failed.push({ id: campaignId, reason: error.message });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        duplicated: duplicated.length,
        failed: failed.length,
        campaigns: duplicated,
        errors: failed
      }
    });
  } catch (error) {
    console.error('Error batch duplicating campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch duplicate campaigns',
      details: error.message
    });
  }
};

module.exports = {
  duplicateCampaign,
  cloneCampaignWithShift,
  batchDuplicateCampaigns
};