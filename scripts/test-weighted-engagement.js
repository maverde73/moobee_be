#!/usr/bin/env node
/**
 * Script to test weighted engagement submission
 * Created: 2025-09-26 21:45
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWeightedEngagement() {
  console.log('=== Testing Weighted Engagement System ===\n');

  try {
    // 1. Find kpiatek's assignment
    const kpiatek = await prisma.employees.findFirst({
      where: { email: 'kpiatek@nexadata.it' }
    });

    if (!kpiatek) {
      console.error('Employee kpiatek not found');
      return;
    }

    const tenantUser = await prisma.tenant_users.findFirst({
      where: {
        email: 'kpiatek@nexadata.it',
        tenant_id: 'f5eafcce-26af-4699-aa97-dd8829621406'
      }
    });

    if (!tenantUser) {
      console.error('Tenant user not found');
      return;
    }

    console.log('Found kpiatek - Employee ID:', kpiatek.id, 'Tenant User ID:', tenantUser.id);

    // 2. Find an IN_PROGRESS or ASSIGNED assignment
    let assignment = await prisma.engagement_campaign_assignments.findFirst({
      where: {
        employee_id: kpiatek.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      // Create a new assignment for testing
      console.log('No active assignment found, creating one for testing...');

      const campaign = await prisma.engagement_campaigns.findFirst({
        where: {
          status: 'PUBLISHED',
          start_date: { lte: new Date() },
          end_date: { gte: new Date() }
        }
      });

      if (campaign) {
        assignment = await prisma.engagement_campaign_assignments.create({
          data: {
            campaign_id: campaign.id,
            employee_id: kpiatek.id,
            status: 'IN_PROGRESS',
            assigned_by: 'test-script',
            started_at: new Date()
          },
          include: {
            campaign: {
              include: {
                template: {
                  include: {
                    questions: {
                      orderBy: { order: 'asc' }
                    }
                  }
                }
              }
            }
          }
        });
        console.log('Created new assignment:', assignment.id);
      } else {
        console.error('No active campaign found');
        return;
      }
    }

    console.log('Using assignment:', assignment.id);
    console.log('Campaign:', assignment.campaign.name);
    console.log('Template:', assignment.campaign.template.title);
    console.log('Questions:', assignment.campaign.template.questions.length);

    // 3. Prepare test responses
    const responses = assignment.campaign.template.questions.map((question, index) => ({
      question_id: question.id,
      value: 3 + Math.floor(Math.random() * 3), // Random 3-5
      type: 'likert'
    }));

    console.log('\n=== Simulating Weighted Submission ===');

    // 4. Get question weights
    const weights = await prisma.engagement_question_weights.findMany({
      where: { template_id: assignment.campaign.template_id }
    });

    console.log('Found', weights.length, 'question weights');

    // 5. Calculate weighted scores
    const weightMap = {};
    weights.forEach(w => {
      weightMap[w.question_id] = w;
    });

    const areaScores = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const response of responses) {
      const weight = weightMap[response.question_id] || {
        area: 'GENERAL',
        weight: 1.0
      };

      const score = (response.value / 5) * weight.weight * 100;

      if (!areaScores[weight.area]) {
        areaScores[weight.area] = { total: 0, weight: 0, count: 0 };
      }

      areaScores[weight.area].total += score;
      areaScores[weight.area].weight += weight.weight;
      areaScores[weight.area].count += 1;

      totalWeightedScore += score;
      totalWeight += weight.weight;
    }

    // Calculate area averages
    const finalAreaScores = {};
    for (const area in areaScores) {
      finalAreaScores[area] = areaScores[area].total / areaScores[area].weight;
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    console.log('\n=== Calculated Scores ===');
    console.log('Overall Score:', Math.round(overallScore * 100) / 100);
    console.log('Area Scores:');
    for (const area in finalAreaScores) {
      console.log(`  ${area}: ${Math.round(finalAreaScores[area] * 100) / 100}`);
    }

    // 6. Save to engagement_results table
    const existingResult = await prisma.engagement_results.findFirst({
      where: {
        assignment_id: assignment.id,
        attempt_number: 1
      }
    });

    if (existingResult) {
      console.log('\n✓ Result already exists for this assignment');
    } else {
      const result = await prisma.engagement_results.create({
        data: {
          campaign_id: assignment.campaign_id,
          assignment_id: assignment.id,
          employee_id: kpiatek.id,
          tenant_user_id: tenantUser.id,
          template_id: assignment.campaign.template_id,
          responses: responses,
          weighted_scores: weightMap,
          area_scores: finalAreaScores,
          overall_score: Math.round(overallScore * 100) / 100,
          percentile: 75, // Mock percentile
          strengths: Object.entries(finalAreaScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([area, score]) => ({ area, score })),
          improvements: Object.entries(finalAreaScores)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 3)
            .map(([area, score]) => ({ area, score })),
          sentiment: overallScore >= 75 ? 'POSITIVE' : overallScore < 50 ? 'NEGATIVE' : 'NEUTRAL',
          completed_at: new Date(),
          started_at: assignment.started_at || new Date(),
          time_taken: 300, // 5 minutes
          attempt_number: 1,
          completion_rate: 100
        }
      });

      console.log('\n✓ Created engagement_results record:', result.id);

      // Update assignment status
      await prisma.engagement_campaign_assignments.update({
        where: { id: assignment.id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          completion_rate: 100
        }
      });

      console.log('✓ Updated assignment status to COMPLETED');
    }

    // 7. Verify data
    const totalResults = await prisma.engagement_results.count({
      where: { employee_id: kpiatek.id }
    });

    console.log('\n=== Summary ===');
    console.log('Total engagement results for kpiatek:', totalResults);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testWeightedEngagement();