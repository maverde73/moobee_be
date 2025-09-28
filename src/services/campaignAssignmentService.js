// Campaign Assignment Service
// Created: 2025-09-26 16:17
// Purpose: Service to query campaign assignment details view for optimized data fetching

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CampaignAssignmentService {
  /**
   * Get all assignments for a specific campaign with employee details
   * @param {string} campaignId - The campaign ID
   * @param {string} campaignType - 'engagement' or 'assessment'
   * @returns {Promise<Array>} Array of assignment details with employee information
   */
  async getCampaignAssignmentDetails(campaignId, campaignType) {
    try {
      const query = `
        SELECT
          campaign_id,
          campaign_type,
          employee_id,
          employee_name,
          email,
          position,
          department,
          assignment_status,
          assigned_at,
          started_at,
          completed_at,
          created_at,
          updated_at
        FROM campaign_assignment_details
        WHERE campaign_id = $1
          AND campaign_type = $2
        ORDER BY employee_name ASC
      `;

      const result = await prisma.$queryRawUnsafe(query, campaignId, campaignType);
      return result;
    } catch (error) {
      console.error('Error fetching campaign assignment details:', error);
      throw new Error('Failed to fetch campaign assignment details');
    }
  }

  /**
   * Get all assignments for multiple campaigns
   * @param {Array<string>} campaignIds - Array of campaign IDs
   * @param {string} tenantId - Tenant ID for security filtering
   * @returns {Promise<Array>} Array of assignment details
   */
  async getMultipleCampaignAssignments(campaignIds, tenantId) {
    try {
      if (!campaignIds || campaignIds.length === 0) {
        return [];
      }

      const placeholders = campaignIds.map((_, index) => `$${index + 2}`).join(',');
      const query = `
        SELECT
          campaign_id,
          campaign_type,
          employee_id,
          employee_name,
          email,
          position,
          department,
          assignment_status,
          assigned_at,
          started_at,
          completed_at
        FROM campaign_assignment_details
        WHERE campaign_id IN (${placeholders})
          AND tenant_id = $1
        ORDER BY campaign_id, employee_name ASC
      `;

      const params = [tenantId, ...campaignIds];
      const result = await prisma.$queryRawUnsafe(query, ...params);
      return result;
    } catch (error) {
      console.error('Error fetching multiple campaign assignments:', error);
      throw new Error('Failed to fetch campaign assignments');
    }
  }

  /**
   * Get assignment statistics for a campaign
   * @param {string} campaignId - The campaign ID
   * @param {string} campaignType - 'engagement' or 'assessment'
   * @returns {Promise<Object>} Statistics object
   */
  async getCampaignStatistics(campaignId, campaignType) {
    try {
      const query = `
        SELECT
          COUNT(*) AS total_assignments,
          COUNT(CASE WHEN assignment_status = 'ASSIGNED' THEN 1 END) AS assigned_count,
          COUNT(CASE WHEN assignment_status = 'IN_PROGRESS' THEN 1 END) AS started_count,
          COUNT(CASE WHEN assignment_status = 'COMPLETED' THEN 1 END) AS completed_count,
          COUNT(DISTINCT department) AS departments_involved,
          MIN(assigned_at) AS first_assignment,
          MAX(completed_at) AS last_completion
        FROM campaign_assignment_details
        WHERE campaign_id = $1
          AND campaign_type = $2
      `;

      const result = await prisma.$queryRawUnsafe(query, campaignId, campaignType);

      // Convert BigInt to Number for JSON serialization
      const stats = result[0] || {};
      return {
        total_assignments: Number(stats.total_assignments || 0),
        assigned_count: Number(stats.assigned_count || 0),
        started_count: Number(stats.started_count || 0),
        completed_count: Number(stats.completed_count || 0),
        departments_involved: Number(stats.departments_involved || 0),
        first_assignment: stats.first_assignment,
        last_completion: stats.last_completion
      };
    } catch (error) {
      console.error('Error fetching campaign statistics:', error);
      throw new Error('Failed to fetch campaign statistics');
    }
  }

  /**
   * Get assignments grouped by status
   * @param {string} campaignId - The campaign ID
   * @param {string} campaignType - 'engagement' or 'assessment'
   * @returns {Promise<Object>} Assignments grouped by status
   */
  async getAssignmentsByStatus(campaignId, campaignType) {
    try {
      const assignments = await this.getCampaignAssignmentDetails(campaignId, campaignType);

      const grouped = {
        assigned: [],
        started: [],
        completed: []
      };

      assignments.forEach(assignment => {
        const status = assignment.assignment_status || 'ASSIGNED';
        if (status === 'ASSIGNED') {
          grouped.assigned.push(assignment);
        } else if (status === 'IN_PROGRESS') {
          grouped.started.push(assignment);
        } else if (status === 'COMPLETED') {
          grouped.completed.push(assignment);
        }
      });

      return grouped;
    } catch (error) {
      console.error('Error grouping assignments by status:', error);
      throw new Error('Failed to group assignments');
    }
  }
}

module.exports = new CampaignAssignmentService();