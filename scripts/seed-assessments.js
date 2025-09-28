/**
 * Script per popolare il database con assessment di esempio
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAssessments() {
  try {
    console.log('🌱 Starting assessment seeding...');

    // Prima verifica se esistono template
    const templatesCount = await prisma.assessment_templates.count();

    if (templatesCount === 0) {
      console.log('📝 Creating assessment templates...');

      // Crea alcuni template di esempio
      await prisma.assessment_templates.createMany({
        data: [
          {
            name: 'Big Five Leadership Assessment',
            type: 'BIG_FIVE',
            description: 'Comprehensive personality assessment based on the Big Five model',
            instructions: 'Answer each question honestly based on your typical behavior',
            suggestedRoles: ['Manager', 'Team Lead', 'Director'],
            suggestedFrequency: 'Quarterly',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['leadership', 'communication', 'decision-making'],
            aiLanguage: 'it'
          },
          {
            name: 'DISC Behavioral Assessment',
            type: 'DISC',
            description: 'Analyze behavioral styles and communication preferences',
            instructions: 'Select the option that best describes your natural behavior',
            suggestedRoles: ['All Employees'],
            suggestedFrequency: 'Bi-annually',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['communication', 'collaboration', 'adaptability'],
            aiLanguage: 'it'
          },
          {
            name: 'Belbin Team Roles',
            type: 'BELBIN',
            description: 'Identify team role preferences and strengths',
            instructions: 'Rate each statement based on how well it describes you',
            suggestedRoles: ['Team Members', 'Project Managers'],
            suggestedFrequency: 'Annually',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['teamwork', 'collaboration', 'role-awareness'],
            aiLanguage: 'it'
          },
          {
            name: 'Custom Skills Assessment',
            type: 'CUSTOM',
            description: 'Customizable assessment for specific competencies',
            instructions: 'Complete all sections to receive your skills profile',
            suggestedRoles: ['All Roles'],
            suggestedFrequency: 'As needed',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: false,
            aiLanguage: 'it'
          },
          {
            name: 'Customer Service Excellence',
            type: 'CUSTOM',
            description: 'Evaluate customer service skills and attitudes',
            instructions: 'Think about your typical customer interactions when answering',
            suggestedRoles: ['Customer Service', 'Sales', 'Support'],
            suggestedFrequency: 'Quarterly',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['customer-focus', 'problem-solving', 'empathy'],
            aiLanguage: 'it'
          },
          {
            name: 'Technical Skills Evaluation',
            type: 'CUSTOM',
            description: 'Assess technical competencies for engineering roles',
            instructions: 'Select your proficiency level for each technical area',
            suggestedRoles: ['Engineers', 'Developers', 'IT Staff'],
            suggestedFrequency: 'Semi-annually',
            isActive: true,
            isPublic: false,
            softSkillsEnabled: false,
            aiLanguage: 'it'
          },
          {
            name: 'Remote Work Readiness',
            type: 'CUSTOM',
            description: 'Evaluate readiness and skills for remote work',
            instructions: 'Answer based on your remote work experience and preferences',
            suggestedRoles: ['Remote Workers', 'Hybrid Teams'],
            suggestedFrequency: 'Once',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['self-management', 'digital-communication', 'independence'],
            aiLanguage: 'it'
          },
          {
            name: 'New Employee Onboarding',
            type: 'CUSTOM',
            description: 'Initial assessment for new hires to establish baseline competencies',
            instructions: 'This assessment helps us understand your current skills and experience',
            suggestedRoles: ['New Hires'],
            suggestedFrequency: 'Once',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['learning-agility', 'adaptability', 'communication'],
            aiLanguage: 'it'
          },
          {
            name: 'Sales Performance Assessment',
            type: 'CUSTOM',
            description: 'Evaluate sales skills, techniques, and customer relationship management',
            instructions: 'Reflect on your sales approach and customer interactions',
            suggestedRoles: ['Sales Representatives', 'Account Managers'],
            suggestedFrequency: 'Quarterly',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['negotiation', 'persuasion', 'relationship-building'],
            aiLanguage: 'it'
          },
          {
            name: 'Project Management Competency',
            type: 'CUSTOM',
            description: 'Assess project management skills and methodologies',
            instructions: 'Consider your experience managing projects and teams',
            suggestedRoles: ['Project Managers', 'Team Leads'],
            suggestedFrequency: 'Annually',
            isActive: true,
            isPublic: true,
            softSkillsEnabled: true,
            targetSoftSkillIds: ['planning', 'organization', 'risk-management'],
            aiLanguage: 'it'
          }
        ]
      });
      console.log('✅ Assessment templates created');
    }

    // Recupera i template creati
    const templates = await prisma.assessment_templates.findMany();
    console.log(`Found ${templates.length} templates`);

    // Per ogni template, crea alcune domande di esempio
    for (const template of templates) {
      const questionsCount = await prisma.assessmentQuestion.count({
        where: { templateId: template.id }
      });

      if (questionsCount === 0) {
        console.log(`Creating questions for template: ${template.name}`);

        // Numero di domande basato sul tipo
        const questionCount = template.type === 'BIG_FIVE' ? 5 :
                            template.type === 'DISC' ? 4 :
                            template.type === 'BELBIN' ? 3 : 2;

        const questions = [];
        for (let i = 1; i <= questionCount; i++) {
          questions.push({
            templateId: template.id,
            text: `${template.type} Question ${i}: Sample question for ${template.name}`,
            category: template.type,
            type: i % 2 === 0 ? 'likert' : 'multiple_choice',
            orderIndex: i,
            isRequired: true,
            metadata: {
              dimension: template.type === 'BIG_FIVE' ? ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'][i % 5] : null
            }
          });
        }

        // Crea le domande
        for (const question of questions) {
          const createdQuestion = await prisma.assessmentQuestion.create({
            data: question
          });

          // Crea le opzioni per ogni domanda
          if (question.type === 'multiple_choice') {
            await prisma.assessmentOption.createMany({
              data: [
                { questionId: createdQuestion.id, text: 'Strongly Disagree', value: 1, orderIndex: 1 },
                { questionId: createdQuestion.id, text: 'Disagree', value: 2, orderIndex: 2 },
                { questionId: createdQuestion.id, text: 'Neutral', value: 3, orderIndex: 3 },
                { questionId: createdQuestion.id, text: 'Agree', value: 4, orderIndex: 4 },
                { questionId: createdQuestion.id, text: 'Strongly Agree', value: 5, orderIndex: 5 }
              ]
            });
          } else if (question.type === 'likert') {
            await prisma.assessmentOption.createMany({
              data: [
                { questionId: createdQuestion.id, text: '1 - Never', value: 1, orderIndex: 1 },
                { questionId: createdQuestion.id, text: '2 - Rarely', value: 2, orderIndex: 2 },
                { questionId: createdQuestion.id, text: '3 - Sometimes', value: 3, orderIndex: 3 },
                { questionId: createdQuestion.id, text: '4 - Often', value: 4, orderIndex: 4 },
                { questionId: createdQuestion.id, text: '5 - Always', value: 5, orderIndex: 5 }
              ]
            });
          }
        }
      }
    }

    // Crea alcuni assessment nella tabella assessments per compatibilità
    const employees = await prisma.employees.findMany({ take: 5 });

    if (employees.length > 0) {
      console.log('Creating assessment records for employees...');

      for (const employee of employees) {
        const existingAssessment = await prisma.assessments.findFirst({
          where: {
            employee_id: employee.id,
            assessment_type: 'BIG_FIVE'
          }
        });

        if (!existingAssessment) {
          await prisma.assessments.create({
            data: {
              employee_id: employee.id,
              tenant_id: employee.tenant_id,
              assessment_type: templates[0]?.type || 'BIG_FIVE',
              assessment_date: new Date(),
              overall_score: Math.floor(Math.random() * 30) + 70, // Random score 70-100
              technical_score: Math.floor(Math.random() * 30) + 70,
              soft_skills_score: Math.floor(Math.random() * 30) + 70,
              status: 'published',
              notes: `Assessment completed for ${employee.first_name} ${employee.last_name}`
            }
          });
        }
      }
    }

    // Conta i risultati finali
    const totalTemplates = await prisma.assessment_templates.count();
    const totalQuestions = await prisma.assessment_questions.count();
    const totalAssessments = await prisma.assessments.count();

    console.log(`
🎉 Assessment seeding completed!
   Templates: ${totalTemplates}
   Questions: ${totalQuestions}
   Assessments: ${totalAssessments}
    `);

  } catch (error) {
    console.error('❌ Error seeding assessments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
seedAssessments()
  .then(() => {
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });