/**
 * Campaign Status Job
 * @module jobs/campaignStatusJob
 * @created 2025-09-24
 * @description Job scheduler per gestione automatica stati campagne
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

/**
 * Update campaign statuses based on dates
 * This job should run daily
 */
async function updateCampaignStatuses() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    logger.info('Starting campaign status update job');

    // 1. PLANNED → ACTIVE: campaigns that should start today
    const campaignsToActivate = await prisma.engagement_campaigns.updateMany({
      where: {
        status: 'PLANNED',
        start_date: {
          lte: today
        }
      },
      data: {
        status: 'ACTIVE',
        updated_at: now
      }
    });

    if (campaignsToActivate.count > 0) {
      logger.info(`Activated ${campaignsToActivate.count} campaigns`);

      // Update assignments status
      const activeCampaigns = await prisma.engagement_campaigns.findMany({
        where: {
          status: 'ACTIVE',
          start_date: {
            lte: today
          }
        }
      });

      for (const campaign of activeCampaigns) {
        await prisma.engagement_campaign_assignments.updateMany({
          where: {
            campaign_id: campaign.id,
            status: 'ASSIGNED'
          },
          data: {
            status: 'ASSIGNED',
            last_accessed_at: now
          }
        });
      }
    }

    // 2. ACTIVE/IN_PROGRESS → COMPLETED: campaigns that ended
    const campaignsToComplete = await prisma.engagement_campaigns.updateMany({
      where: {
        status: {
          in: ['ACTIVE', 'IN_PROGRESS']
        },
        end_date: {
          lt: today
        }
      },
      data: {
        status: 'COMPLETED',
        updated_at: now
      }
    });

    if (campaignsToComplete.count > 0) {
      logger.info(`Completed ${campaignsToComplete.count} campaigns`);

      // Mark assignments as expired if not completed
      const completedCampaigns = await prisma.engagement_campaigns.findMany({
        where: {
          status: 'COMPLETED',
          end_date: {
            lt: today
          }
        }
      });

      for (const campaign of completedCampaigns) {
        await prisma.engagement_campaign_assignments.updateMany({
          where: {
            campaign_id: campaign.id,
            status: {
              in: ['ASSIGNED', 'IN_PROGRESS']
            }
          },
          data: {
            status: 'EXPIRED'
          }
        });
      }
    }

    // 3. Check assignments nearing expiry (3 days warning)
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const campaignsNearingEnd = await prisma.engagement_campaigns.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'IN_PROGRESS']
        },
        end_date: {
          gte: today,
          lte: threeDaysFromNow
        }
      },
      include: {
        assignments: {
          where: {
            status: {
              in: ['ASSIGNED', 'IN_PROGRESS']
            },
            completed_at: null
          }
        }
      }
    });

    if (campaignsNearingEnd.length > 0) {
      logger.info(`Found ${campaignsNearingEnd.length} campaigns nearing end date`);
      // TODO: Send reminder notifications to employees
    }

    // 4. Auto-archive old completed campaigns (after 90 days)
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const campaignsToArchive = await prisma.engagement_campaigns.updateMany({
      where: {
        status: 'COMPLETED',
        end_date: {
          lt: ninetyDaysAgo
        }
      },
      data: {
        status: 'ARCHIVED',
        updated_at: now
      }
    });

    if (campaignsToArchive.count > 0) {
      logger.info(`Archived ${campaignsToArchive.count} old campaigns`);
    }

    logger.info('Campaign status update job completed successfully');
  } catch (error) {
    logger.error('Error in campaign status update job', error);
    throw error;
  }
}

/**
 * Check for data integrity issues
 */
async function checkDataIntegrity() {
  try {
    logger.info('Starting data integrity check');

    // 1. Check for orphaned assignments (campaign deleted but assignments remain)
    const orphanedAssignments = await prisma.engagement_campaign_assignments.findMany({
      where: {
        campaign: {
          is: null
        }
      }
    });

    if (orphanedAssignments.length > 0) {
      logger.warn(`Found ${orphanedAssignments.length} orphaned assignments`);
      // Clean up orphaned assignments
      await prisma.engagement_campaign_assignments.deleteMany({
        where: {
          id: {
            in: orphanedAssignments.map(a => a.id)
          }
        }
      });
    }

    // 2. Check for campaigns with has_responses flag mismatch
    const campaignsWithResponses = await prisma.engagement_campaigns.findMany({
      where: {
        has_responses: false
      },
      include: {
        _count: {
          select: {
            responses: true
          }
        }
      }
    });

    for (const campaign of campaignsWithResponses) {
      if (campaign._count.responses > 0) {
        await prisma.engagement_campaigns.update({
          where: { id: campaign.id },
          data: { has_responses: true }
        });
        logger.info(`Fixed has_responses flag for campaign ${campaign.id}`);
      }
    }

    // 3. Ensure no duplicate active assignments for same employee and period
    const duplicateAssignments = await prisma.$queryRaw`
      SELECT employee_id, COUNT(*) as count
      FROM engagement_campaign_assignments eca
      JOIN engagement_campaigns ec ON eca.campaign_id = ec.id
      WHERE eca.status IN ('ASSIGNED', 'IN_PROGRESS')
      AND ec.status IN ('ACTIVE', 'IN_PROGRESS')
      GROUP BY employee_id, ec.tenant_id
      HAVING COUNT(*) > 1
    `;

    if (duplicateAssignments.length > 0) {
      logger.warn(`Found ${duplicateAssignments.length} employees with duplicate active assignments`);
      // TODO: Handle duplicate assignments (keep most recent, archive others)
    }

    logger.info('Data integrity check completed');
  } catch (error) {
    logger.error('Error in data integrity check', error);
    throw error;
  }
}

/**
 * Send reminder notifications
 */
async function sendReminders() {
  try {
    logger.info('Starting reminder notification job');

    const activeCampaigns = await prisma.engagement_campaigns.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'IN_PROGRESS']
        },
        reminder_settings: {
          path: ['enabled'],
          equals: true
        }
      },
      include: {
        assignments: {
          where: {
            status: {
              in: ['ASSIGNED', 'IN_PROGRESS']
            },
            completed_at: null
          }
        }
      }
    });

    let totalReminders = 0;

    for (const campaign of activeCampaigns) {
      const reminderSettings = campaign.reminder_settings;
      const frequency = reminderSettings?.frequency || 7; // Default 7 days

      for (const assignment of campaign.assignments) {
        const lastReminder = assignment.last_reminder_at;
        const now = new Date();

        // Check if it's time to send a reminder
        const shouldSendReminder = !lastReminder ||
          (now.getTime() - new Date(lastReminder).getTime()) > (frequency * 24 * 60 * 60 * 1000);

        if (shouldSendReminder) {
          // TODO: Send actual reminder (email, in-app notification)
          logger.info(`Sending reminder for assignment ${assignment.id}`);

          await prisma.engagement_campaign_assignments.update({
            where: { id: assignment.id },
            data: {
              reminder_count: assignment.reminder_count + 1,
              last_reminder_at: now
            }
          });

          totalReminders++;
        }
      }
    }

    logger.info(`Sent ${totalReminders} reminder notifications`);
  } catch (error) {
    logger.error('Error in reminder notification job', error);
    throw error;
  }
}

// Export functions for use in cron job or manual execution
module.exports = {
  updateCampaignStatuses,
  checkDataIntegrity,
  sendReminders,

  // Main function to run all jobs
  async runAllJobs() {
    logger.info('Starting all campaign management jobs');

    try {
      await updateCampaignStatuses();
      await checkDataIntegrity();
      await sendReminders();
      logger.info('All campaign management jobs completed successfully');
    } catch (error) {
      logger.error('Error running campaign management jobs', error);
    } finally {
      await prisma.$disconnect();
    }
  }
};