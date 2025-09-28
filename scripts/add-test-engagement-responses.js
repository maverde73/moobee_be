#!/usr/bin/env node
/**
 * Script to add test engagement responses for kpiatek
 * Created: 2025-09-26 21:15
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addTestResponses() {
  console.log('=== Adding Test Engagement Responses ===\n');

  try {
    // 1. Find kpiatek's completed assignment
    const kpiatek = await prisma.employees.findFirst({
      where: { email: 'kpiatek@nexadata.it' }
    });

    if (!kpiatek) {
      console.error('Employee kpiatek not found');
      return;
    }

    // Get tenant_user id
    const tenantUser = await prisma.tenant_users.findFirst({
      where: {
        email: 'kpiatek@nexadata.it',
        tenant_id: 'f5eafcce-26af-4699-aa97-dd8829621406' // Nexadata
      }
    });

    if (!tenantUser) {
      console.error('Tenant user not found');
      return;
    }

    console.log('Found kpiatek - Employee ID:', kpiatek.id, 'Tenant User ID:', tenantUser.id);

    // 2. Find completed assignment
    const assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        employee_id: kpiatek.id,
        status: 'COMPLETED'
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  take: 6 // Take first 6 questions
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      console.error('No completed assignment found for kpiatek');
      return;
    }

    console.log('Found completed assignment:', assignment.id);
    console.log('Campaign:', assignment.campaign.name);

    const questions = assignment.campaign.template.questions;
    console.log('Found', questions.length, 'questions in template');

    // 3. Add test responses
    const responses = [];
    const areas = ['MOTIVATION', 'LEADERSHIP', 'COMMUNICATION', 'WORK_LIFE_BALANCE', 'BELONGING', 'GROWTH'];

    for (let i = 0; i < Math.min(questions.length, 6); i++) {
      const question = questions[i];
      const score = 3 + Math.floor(Math.random() * 3); // Random score 3-5

      const response = await prisma.engagement_responses.create({
        data: {
          campaign_id: assignment.campaign_id,
          user_id: tenantUser.id, // Use tenant_users.id (String)
          question_id: question.id,
          response_value: score,
          responded_at: new Date(assignment.completed_at) // Use same date as completion
        }
      });

      responses.push(response);
      console.log(`✓ Added response for question ${i+1}: Score ${score}/5`);
    }

    console.log('\n✓ Successfully added', responses.length, 'test responses');

    // 4. Verify responses
    const totalResponses = await prisma.engagement_responses.count({
      where: {
        campaign_id: assignment.campaign_id,
        user_id: tenantUser.id
      }
    });

    console.log('Total responses for this campaign:', totalResponses);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addTestResponses();