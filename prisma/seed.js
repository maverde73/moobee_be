const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create departments
  const hrDept = await prisma.departments.upsert({
    where: { department_name: 'Human Resources' },
    update: {},
    create: {
      department_name: 'Human Resources',
      department_code: 'HR',
      is_active: true
    }
  });

  const itDept = await prisma.departments.upsert({
    where: { department_name: 'Information Technology' },
    update: {},
    create: {
      department_name: 'Information Technology',
      department_code: 'IT',
      is_active: true
    }
  });

  const salesDept = await prisma.departments.upsert({
    where: { department_name: 'Sales' },
    update: {},
    create: {
      department_name: 'Sales',
      department_code: 'SALES',
      is_active: true
    }
  });

  console.log('✅ Departments created');

  // Create test employees
  const johnDoe = await prisma.employees.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      employee_code: 'EMP001',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+39 333 1234567',
      hire_date: new Date('2022-01-15'),
      department_id: itDept.id,
      position: 'Senior Software Developer',
      is_active: true
    }
  });

  const janeSmith = await prisma.employees.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: {
      employee_code: 'EMP002',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+39 333 7654321',
      hire_date: new Date('2021-06-01'),
      department_id: hrDept.id,
      position: 'HR Manager',
      is_active: true
    }
  });

  const bobJohnson = await prisma.employees.upsert({
    where: { email: 'bob.johnson@example.com' },
    update: {},
    create: {
      employee_code: 'EMP003',
      first_name: 'Bob',
      last_name: 'Johnson',
      email: 'bob.johnson@example.com',
      phone: '+39 333 9876543',
      hire_date: new Date('2023-03-10'),
      department_id: salesDept.id,
      position: 'Sales Representative',
      is_active: true
    }
  });

  console.log('✅ Employees created');

  // Get some roles and skills from the database
  const softwareDeveloperRole = await prisma.roles.findFirst({
    where: {
      Role: {
        contains: 'software developer',
        mode: 'insensitive'
      }
    }
  });

  const hrManagerRole = await prisma.roles.findFirst({
    where: {
      Role: {
        contains: 'hr manager',
        mode: 'insensitive'
      }
    }
  });

  const salesRole = await prisma.roles.findFirst({
    where: {
      Role: {
        contains: 'sales',
        mode: 'insensitive'
      }
    }
  });

  // Assign roles to employees if roles exist
  if (softwareDeveloperRole) {
    await prisma.employee_roles.create({
      data: {
        employee_id: johnDoe.id,
        role_id: softwareDeveloperRole.id,
        start_date: new Date('2022-01-15'),
        is_current: true
      }
    });
    console.log('✅ Assigned Software Developer role to John Doe');
  }

  if (hrManagerRole) {
    await prisma.employee_roles.create({
      data: {
        employee_id: janeSmith.id,
        role_id: hrManagerRole.id,
        start_date: new Date('2021-06-01'),
        is_current: true
      }
    });
    console.log('✅ Assigned HR Manager role to Jane Smith');
  }

  if (salesRole) {
    await prisma.employee_roles.create({
      data: {
        employee_id: bobJohnson.id,
        role_id: salesRole.id,
        start_date: new Date('2023-03-10'),
        is_current: true
      }
    });
    console.log('✅ Assigned Sales role to Bob Johnson');
  }

  // Get some skills
  const javascriptSkill = await prisma.skills.findFirst({
    where: {
      Skill: {
        contains: 'javascript',
        mode: 'insensitive'
      }
    }
  });

  const pythonSkill = await prisma.skills.findFirst({
    where: {
      Skill: {
        contains: 'python',
        mode: 'insensitive'
      }
    }
  });

  const nodeSkill = await prisma.skills.findFirst({
    where: {
      Skill: {
        contains: 'node',
        mode: 'insensitive'
      }
    }
  });

  // Add skills to John Doe
  if (javascriptSkill) {
    await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: {
          employee_id: johnDoe.id,
          skill_id: javascriptSkill.id
        }
      },
      update: {},
      create: {
        employee_id: johnDoe.id,
        skill_id: javascriptSkill.id,
        proficiency_level: 5,
        years_experience: 8.5,
        is_certified: true,
        certification_date: new Date('2020-06-15'),
        certification_authority: 'JavaScript Institute'
      }
    });
  }

  if (pythonSkill) {
    await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: {
          employee_id: johnDoe.id,
          skill_id: pythonSkill.id
        }
      },
      update: {},
      create: {
        employee_id: johnDoe.id,
        skill_id: pythonSkill.id,
        proficiency_level: 4,
        years_experience: 5.0
      }
    });
  }

  if (nodeSkill) {
    await prisma.employee_skills.upsert({
      where: {
        employee_id_skill_id: {
          employee_id: johnDoe.id,
          skill_id: nodeSkill.id
        }
      },
      update: {},
      create: {
        employee_id: johnDoe.id,
        skill_id: nodeSkill.id,
        proficiency_level: 5,
        years_experience: 6.0
      }
    });
  }

  console.log('✅ Skills assigned to employees');

  // Create a sample project
  const webProject = await prisma.projects.create({
    data: {
      project_name: 'Moobee Platform Development',
      project_code: 'PROJ-MOOBEE-001',
      description: 'Development of the Moobee HR management platform',
      client_name: 'Internal',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31'),
      budget: 150000.00,
      status: 'IN_PROGRESS',
      project_manager_id: johnDoe.id
    }
  });

  // Assign employees to project
  await prisma.project_assignments.create({
    data: {
      project_id: webProject.id,
      employee_id: johnDoe.id,
      role_in_project: 'Lead Developer',
      allocation_percentage: 80,
      start_date: new Date('2024-01-01'),
      is_active: true
    }
  });

  await prisma.project_assignments.create({
    data: {
      project_id: webProject.id,
      employee_id: janeSmith.id,
      role_in_project: 'HR Consultant',
      allocation_percentage: 20,
      start_date: new Date('2024-01-01'),
      is_active: true
    }
  });

  console.log('✅ Project created and employees assigned');

  // Create sample assessments
  await prisma.assessments.create({
    data: {
      employee_id: johnDoe.id,
      assessment_type: 'ANNUAL',
      assessment_date: new Date('2023-12-15'),
      overall_score: 4.5,
      technical_score: 4.8,
      soft_skills_score: 4.2,
      notes: 'Excellent technical skills, good team player',
      assessed_by: janeSmith.id,
      status: 'COMPLETED'
    }
  });

  console.log('✅ Assessment created');

  // Create engagement survey
  await prisma.engagement_surveys.create({
    data: {
      employee_id: johnDoe.id,
      survey_month: new Date('2024-01-01'),
      job_satisfaction: 4,
      work_life_balance: 4,
      career_development: 5,
      team_collaboration: 5,
      manager_support: 4,
      overall_score: 4.4,
      achieved_goals: ['Complete React migration', 'Implement new auth system'],
      challenges_faced: ['Tight deadlines', 'Legacy code refactoring'],
      support_needed: ['More testing resources', 'Training on new technologies'],
      comments: 'Overall satisfied with the work environment'
    }
  });

  console.log('✅ Engagement survey created');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('Email: john.doe@example.com');
  console.log('Password: Password123!');
  console.log('\nEmail: jane.smith@example.com');
  console.log('Password: Password123!');
  console.log('\nEmail: bob.johnson@example.com');
  console.log('Password: Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });