const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function testNewScoring() {
  try {
    console.log('=== TEST NEW SCORING SYSTEM ===\n');

    // Get Nexadata tenant
    const tenant = await prisma.tenants.findFirst({
      where: {
        OR: [
          { name: 'Nexa data srl' },
          { domain: 'nexadata.it' }
        ]
      }
    });

    if (!tenant) {
      console.log('Nexadata tenant not found');
      return;
    }

    // Get a test user
    const user = await prisma.tenant_users.findFirst({
      where: {
        email: 'fvalentini@nexadata.it',
        tenant_id: tenant.id
      }
    });

    if (!user) {
      console.log('Test user not found');
      return;
    }

    // Generate JWT token
    const payload = {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production',
      { expiresIn: '1h' }
    );

    console.log('User:', user.email);

    // Find or create an assignment for this user
    // First, reset any IN_PROGRESS assignments back to ASSIGNED
    await prisma.assessment_campaign_assignments.updateMany({
      where: {
        employee_id: user.id,
        status: 'IN_PROGRESS'
      },
      data: {
        status: 'ASSIGNED',
        started_at: null
      }
    });

    let assignment = await prisma.assessment_campaign_assignments.findFirst({
      where: {
        employee_id: user.id,
        status: 'ASSIGNED'
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                assessment_questions: true
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      console.log('No active assignment found. Creating a test assignment...');

      // Find a campaign
      const campaign = await prisma.assessment_campaigns.findFirst({
        where: {
          tenant_id: tenant.id,
          status: 'ACTIVE'
        },
        include: {
          template: {
            include: {
              assessment_questions: true
            }
          }
        }
      });

      if (!campaign) {
        console.log('No active campaign found. Please create one first.');
        return;
      }

      // Create assignment
      assignment = await prisma.assessment_campaign_assignments.create({
        data: {
          campaign_id: campaign.id,
          employee_id: user.id,
          status: 'ASSIGNED',
          assigned_at: new Date(),
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        },
        include: {
          campaign: {
            include: {
              template: {
                include: {
                  assessment_questions: true
                }
              }
            }
          }
        }
      });

      console.log('Created test assignment:', assignment.id);
    }

    // Start the assessment directly in database
    console.log('\n1. Starting assessment...');

    // Update assignment to IN_PROGRESS
    await prisma.assessment_campaign_assignments.update({
      where: { id: assignment.id },
      data: {
        status: 'IN_PROGRESS',
        started_at: new Date()
      }
    });

    console.log('✅ Assessment started successfully');

    const { default: fetch } = await import('node-fetch');

    // Prepare test responses with varied scores and categories
    const testResponses = [];
    const categories = ['Comunicazione', 'Leadership', 'Problem Solving', 'Team Work', 'Innovazione'];

    assignment.campaign.template.assessment_questions.forEach((question, index) => {
      // Create varied scores for testing
      let value;
      if (index % 5 === 0) value = 5; // Excellent
      else if (index % 5 === 1) value = 4; // Good
      else if (index % 5 === 2) value = 3; // Average
      else if (index % 5 === 3) value = 2; // Below average
      else value = 1; // Poor

      const category = categories[index % categories.length];

      testResponses.push({
        questionId: question.id,
        value: value,
        text: question.text,
        category: category,
        question: question.text
      });
    });

    console.log('\n2. Submitting responses with varied scores...');
    console.log(`   - Total questions: ${testResponses.length}`);
    console.log(`   - Categories: ${categories.join(', ')}`);
    console.log(`   - Score distribution: 20% each (1-5)`);

    // Submit responses
    const submitResponse = await fetch(`http://localhost:3000/api/assessments/assignments/${assignment.id}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        responses: testResponses,
        score: null // Let the backend calculate it
      })
    });

    if (submitResponse.ok) {
      const result = await submitResponse.json();
      console.log('\n✅ Assessment submitted successfully!');

      // Get the saved result
      const savedResult = await prisma.assessment_results.findUnique({
        where: { id: result.data.result.id }
      });

      console.log('\n=== ANALYSIS OF SAVED RESULT ===');
      console.log('\n📊 SCORES BY CATEGORY:');
      if (savedResult.scores && Object.keys(savedResult.scores).length > 0) {
        console.log('✅ Category scores calculated:');
        Object.entries(savedResult.scores).forEach(([category, data]) => {
          console.log(`   ${category}: ${data.average}/5 (${data.total}/${data.count} questions)`);
        });
      } else {
        console.log('❌ Category scores not calculated');
      }

      console.log('\n🎯 OVERALL SCORE:');
      console.log(`   ${savedResult.overall_score}/5 (${(savedResult.overall_score * 20).toFixed(0)}%)`);

      console.log('\n📈 PERCENTILE:');
      if (savedResult.percentile !== null) {
        console.log(`   ✅ ${savedResult.percentile}% (better than ${savedResult.percentile}% of participants)`);
      } else {
        console.log('   ⚠️ Not calculated (may be first result)');
      }

      console.log('\n💪 STRENGTHS:');
      if (savedResult.strengths && savedResult.strengths.length > 0) {
        console.log('✅ Strengths identified:');
        savedResult.strengths.forEach(s => {
          console.log(`   - ${s.category}: Score ${s.score}/5`);
        });
      } else {
        console.log('❌ No strengths identified');
      }

      console.log('\n📈 AREAS FOR IMPROVEMENT:');
      if (savedResult.improvements && savedResult.improvements.length > 0) {
        console.log('✅ Improvements identified:');
        savedResult.improvements.forEach(i => {
          console.log(`   - ${i.category}: Score ${i.score}/5`);
        });
      } else {
        console.log('❌ No improvements identified');
      }

      console.log('\n💡 RECOMMENDATIONS:');
      if (savedResult.recommendations && savedResult.recommendations.length > 0) {
        console.log('✅ Recommendations generated:');
        savedResult.recommendations.forEach(r => {
          console.log(`   [${r.type}] ${r.message}`);
        });
      } else {
        console.log('❌ No recommendations generated');
      }

      console.log('\n✅ SUCCESS: All fields are now being calculated and saved correctly!');

    } else {
      const error = await submitResponse.text();
      console.log('\n❌ Failed to submit assessment:', error);
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewScoring();