/**
 * Assignment Controller Stub
 * Created: 2025-09-27 14:55
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get project assignments
 */
async function getProjectAssignments(req, res) {
  try {
    const { projectId } = req.params;

    const assignments = await prisma.project_assignments.findMany({
      where: { project_id: projectId }
    });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching project assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project assignments'
    });
  }
}

/**
 * Assign resource to project
 */
async function assignResource(req, res) {
  try {
    const { project_id, employee_id, role_in_project, allocation_percentage, start_date, end_date } = req.body;
    const tenantId = req.user?.tenantId || req.user?.tenant_id;

    if (!project_id || !employee_id || !start_date) {
      return res.status(400).json({
        success: false,
        message: 'project_id, employee_id, and start_date are required'
      });
    }

    const assignment = await prisma.project_assignments.create({
      data: {
        project_id: parseInt(project_id),
        employee_id: parseInt(employee_id),
        role_in_project: role_in_project || null,
        allocation_percentage: allocation_percentage ? parseInt(allocation_percentage) : null,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        is_active: true,
        tenant_id: tenantId
      }
    });

    res.status(201).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Error assigning resource:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning resource'
    });
  }
}

/**
 * Update assignment
 */
async function updateAssignment(req, res) {
  try {
    const { id } = req.params;
    const { role_in_project, allocation_percentage, start_date, end_date, is_active } = req.body;

    const data = {};
    if (role_in_project !== undefined) data.role_in_project = role_in_project;
    if (allocation_percentage !== undefined) data.allocation_percentage = parseInt(allocation_percentage);
    if (start_date !== undefined) data.start_date = new Date(start_date);
    if (end_date !== undefined) data.end_date = end_date ? new Date(end_date) : null;
    if (is_active !== undefined) data.is_active = is_active;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one field to update is required'
      });
    }

    const assignment = await prisma.project_assignments.update({
      where: { id: parseInt(id) },
      data
    });

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating assignment'
    });
  }
}

/**
 * Remove assignment (soft delete)
 */
async function removeAssignment(req, res) {
  try {
    const { id } = req.params;

    const assignment = await prisma.project_assignments.update({
      where: { id: parseInt(id) },
      data: { is_active: false }
    });

    res.json({
      success: true,
      data: assignment,
      message: 'Assignment deactivated'
    });
  } catch (error) {
    console.error('Error removing assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing assignment'
    });
  }
}

module.exports = {
  getProjectAssignments,
  assignResource,
  updateAssignment,
  removeAssignment
};