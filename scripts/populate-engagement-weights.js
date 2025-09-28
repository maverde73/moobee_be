#!/usr/bin/env node
/**
 * Script to populate engagement question weights
 * Created: 2025-09-26 21:35
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function populateWeights() {
  console.log('=== Populating Engagement Question Weights ===\n');

  try {
    // 1. Get all engagement questions with templates
    const questions = await prisma.engagement_questions.findMany({
      include: {
        template: true
      }
    });

    console.log(`Found ${questions.length} questions to process\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const question of questions) {
      const text = question.question_text.toLowerCase();

      // Determine area based on question content
      let area = 'GENERAL';
      let weight = 1.0;

      if (text.includes('motivat') || text.includes('energiz') || text.includes('entusiasm')) {
        area = 'MOTIVATION';
        weight = 1.2;
      } else if (text.includes('leader') || text.includes('manager') || text.includes('supervis') || text.includes('gestione')) {
        area = 'LEADERSHIP';
        weight = 1.1;
      } else if (text.includes('communicat') || text.includes('inform') || text.includes('feedback') || text.includes('comunicazione')) {
        area = 'COMMUNICATION';
        weight = 1.0;
      } else if (text.includes('balance') || text.includes('life') || text.includes('stress') || text.includes('equilibrio')) {
        area = 'WORK_LIFE_BALANCE';
        weight = 0.9;
      } else if (text.includes('belong') || text.includes('team') || text.includes('cultur') || text.includes('appartenenza')) {
        area = 'BELONGING';
        weight = 1.1;
      } else if (text.includes('grow') || text.includes('develop') || text.includes('career') || text.includes('learn') || text.includes('crescita')) {
        area = 'GROWTH';
        weight = 1.0;
      } else if (text.includes('recogni') || text.includes('appreciat') || text.includes('reward') || text.includes('riconoscimento')) {
        area = 'RECOGNITION';
        weight = 0.8;
      } else if (text.includes('autonom') || text.includes('decision') || text.includes('freedom') || text.includes('autonomia')) {
        area = 'AUTONOMY';
        weight = 0.9;
      }

      try {
        // Check if weight already exists
        const existing = await prisma.engagement_question_weights.findUnique({
          where: {
            template_id_question_id: {
              template_id: question.template_id,
              question_id: question.id
            }
          }
        });

        if (existing) {
          console.log(`✓ Weight already exists for: "${question.question_text.substring(0, 50)}..."`);
        } else {
          // Create new weight
          await prisma.engagement_question_weights.create({
            data: {
              template_id: question.template_id,
              question_id: question.id,
              area: area,
              weight: weight,
              impact_factor: 1.0,
              is_reversed: false
            }
          });
          successCount++;
          console.log(`✓ Added weight for: "${question.question_text.substring(0, 50)}..." -> ${area} (${weight})`);
        }
      } catch (err) {
        errorCount++;
        console.error(`✗ Error for question ${question.id}: ${err.message}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`✓ Successfully added ${successCount} weights`);
    if (errorCount > 0) {
      console.log(`✗ Failed to add ${errorCount} weights`);
    }

    // Show distribution by area
    const distribution = await prisma.engagement_question_weights.groupBy({
      by: ['area'],
      _count: {
        id: true
      }
    });

    console.log('\n=== Weight Distribution by Area ===');
    distribution.forEach(item => {
      console.log(`${item.area}: ${item._count.id} questions`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateWeights();