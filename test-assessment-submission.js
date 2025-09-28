const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function testAssessmentSubmission() {
  try {
    console.log('=== TEST ASSESSMENT SUBMISSION WITH PROPER SCORING ===\n');

    // Get test user
    const user = await prisma.tenant_users.findFirst({
      where: {
        email: 'fvalentini@nexadata.it'
      }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    // Check if user has an active assignment
    let assignment = await prisma.assessment_campaign_assignments.findFirst({
      where: {
        employee_id: user.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
      },
      include: {
        campaign: {
          include: {
            template: {
              include: {
                assessment_questions: {
                  include: {
                    assessment_options: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      console.log('No active assignment found. Creating one...');

      // Get or create a campaign
      const template = await prisma.assessment_templates.findFirst({
        where: {
          status: 'PUBLISHED'
        }
      });

      if (!template) {
        console.log('No published template found');
        return;
      }

      // Create a campaign
      const campaign = await prisma.assessment_campaigns.create({
        data: {
          name: 'Test Assessment Campaign',
          template_id: template.id,
          tenant_id: user.tenant_id,
          start_date: new Date(),
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          status: 'ACTIVE',
          created_by: user.id,
          created_at: new Date()
        }
      });

      // Create assignment
      assignment = await prisma.assessment_campaign_assignments.create({
        data: {
          campaign_id: campaign.id,
          employee_id: user.id,
          assigned_at: new Date(),
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'IN_PROGRESS',
          started_at: new Date()
        },
        include: {
          campaign: {
            include: {
              template: {
                include: {
                  assessment_questions: {
                    include: {
                      assessment_options: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    } else if (assignment.status === 'ASSIGNED') {
      // Start the assignment
      await prisma.assessment_campaign_assignments.update({
        where: { id: assignment.id },
        data: {
          status: 'IN_PROGRESS',
          started_at: new Date()
        }
      });
    }

    console.log('Using assignment:', assignment.id);
    console.log('Assessment:', assignment.campaign.template.name);
    console.log('Questions:', assignment.campaign.template.assessment_questions.length);

    // Prepare responses with varied scores by category
    const responses = [];
    const categories = {};

    assignment.campaign.template.assessment_questions.forEach((question, index) => {
      const category = question.category || 'General';

      // Track categories
      if (!categories[category]) {
        categories[category] = [];
      }

      // Create varied scores to test strengths and improvements
      let value;
      if (category === 'Leadership' || category === 'Comunicazione') {
        value = 4 + Math.random(); // High scores (4-5)
      } else if (category === 'Teamwork' || category === 'Problem Solving') {
        value = 3 + Math.random(); // Medium scores (3-4)
      } else {
        value = 1 + Math.random() * 2; // Low scores (1-3)
      }

      value = Math.min(5, Math.max(1, parseFloat(value.toFixed(2))));

      responses.push({
        questionId: question.id,
        value: value,
        text: question.assessment_options && question.assessment_options[Math.floor(value) - 1]
          ? question.assessment_options[Math.floor(value) - 1].text
          : `Response for question ${index + 1}`,
        question: question.text,
        category: category
      });

      categories[category].push(value);
    });

    console.log('\nCategory distribution:');
    Object.entries(categories).forEach(([cat, values]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      console.log(`  ${cat}: ${values.length} questions, avg score: ${avg.toFixed(2)}`);
    });

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

    // Submit the assessment
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`http://localhost:3000/api/assessments/assignments/${assignment.id}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ responses })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Assessment submitted successfully!');

      if (data.data && data.data.result) {
        const result = data.data.result;
        console.log('\n📊 Results:');
        console.log('Overall Score:', result.overall_score);
        console.log('Percentile:', result.percentile);

        if (result.scores) {
          console.log('\n📈 Category Scores:');
          Object.entries(result.scores).forEach(([cat, data]) => {
            console.log(`  ${cat}: ${data.average}/5`);
          });
        }

        if (result.strengths && result.strengths.length > 0) {
          console.log('\n💪 Strengths:');
          result.strengths.forEach(s => {
            console.log(`  - ${JSON.stringify(s)}`);
          });
        }

        if (result.improvements && result.improvements.length > 0) {
          console.log('\n🎯 Areas for Improvement:');
          result.improvements.forEach(i => {
            console.log(`  - ${JSON.stringify(i)}`);
          });
        }
      }
    } else {
      const error = await response.text();
      console.log('❌ Failed to submit assessment:', response.status);
      console.log('Error:', error);
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAssessmentSubmission();