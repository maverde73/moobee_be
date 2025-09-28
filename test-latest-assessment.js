const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function testLatestAssessment() {
  try {
    console.log('=== TEST LATEST ASSESSMENT ENDPOINT ===\n');

    // Get test user that has completed an assessment
    const user = await prisma.tenant_users.findFirst({
      where: {
        email: 'fvalentini@nexadata.it'  // This user completed a test
      }
    });

    if (!user) {
      console.log('User not found');
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

    console.log('Testing with user:', user.email);

    // Test the endpoint
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('http://localhost:3000/api/assessments/my-latest-result', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();

      if (data.success && data.data) {
        const result = data.data;
        console.log('\n✅ Latest Assessment Found:');
        console.log('--------------------------------');
        console.log('📅 Completed:', new Date(result.completedDate).toLocaleString('it-IT'));
        console.log('📊 Total Score:', result.totalScore + '/100');
        console.log('🏆 Level:', result.level);
        console.log('📈 Percentile:', result.percentile ? result.percentile + '%' : 'N/A');
        console.log('⏱️ Time Spent:', result.timeSpent + ' minutes');
        console.log('📝 Assessment:', result.assessmentName);

        console.log('\n📊 Section Scores:');
        if (result.sectionScores && Object.keys(result.sectionScores).length > 0) {
          Object.entries(result.sectionScores).forEach(([category, data]) => {
            console.log(`  - ${category}: ${data.average}/5`);
          });
        }

        console.log('\n💪 Strengths:', result.strengths.length > 0 ? result.strengths.join(', ') : 'None');
        console.log('🎯 Areas for Improvement:', result.areasForImprovement.length > 0 ? result.areasForImprovement.join(', ') : 'None');

        if (result.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          result.recommendations.forEach(rec => {
            console.log(`  [${rec.type}] ${rec.message}`);
          });
        }
      } else {
        console.log('\n⚠️ No assessment results found for this user');
      }
    } else {
      const error = await response.text();
      console.log('\n❌ Failed to fetch assessment:', response.status);
      console.log('Error:', error);
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLatestAssessment();