/**
 * Seed Projects Data
 * Created: 2025-09-27 14:50
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting project seed...');

  try {
    // Get tenant and users
    let tenant = await prisma.tenants.findFirst({
      where: { name: 'Nexadata' }
    });

    if (!tenant) {
      console.log('⚠️ Tenant Nexadata not found, using first available tenant...');
      tenant = await prisma.tenants.findFirst();

      if (!tenant) {
        console.log('⚠️ No tenants found, creating test tenant...');
        tenant = await prisma.tenants.create({
          data: {
            id: 'nexadata-' + Date.now(),
            name: 'Nexadata',
            email: 'admin@nexadata.it',
            domain: 'nexadata.it',
            subscription_type: 'premium',
            status: 'active',
            settings: {}
          }
        });
        console.log('✅ Created Nexadata tenant');
      }
    }

    let manager = await prisma.tenant_users.findFirst({
      where: {
        tenant_id: tenant.id,
        role: 'HR_MANAGER'
      }
    });

    if (!manager) {
      console.log('⚠️ No HR Manager found, using first available user...');
      manager = await prisma.tenant_users.findFirst({
        where: {
          tenant_id: tenant.id
        }
      });

      if (!manager) {
        console.log('⚠️ No users found, creating test manager...');
        manager = await prisma.tenant_users.create({
          data: {
            id: 'pm-' + Date.now(),
            tenant_id: tenant.id,
            email: 'pm@nexadata.it',
            username: 'project.manager',
            password_hash: '$2b$10$YourHashHere',
            first_name: 'Project',
            last_name: 'Manager',
            role: 'HR_MANAGER',
            is_active: true,
            settings: {}
          }
        });
        console.log('✅ Created test HR Manager');
      }
    }

    // Clear existing project data
    console.log('🗑️ Clearing existing project data...');
    await prisma.project_activity_logs.deleteMany();
    await prisma.project_matching_results.deleteMany();
    await prisma.project_assignments.deleteMany();
    await prisma.project_milestones.deleteMany();
    await prisma.project_roles.deleteMany();
    await prisma.projects.deleteMany();

    // Create projects
    console.log('📁 Creating projects...');
    const projects = await Promise.all([
      prisma.projects.create({
        data: {
          name: 'E-Commerce Platform Redesign',
          code: 'PROJ-2025-001',
          client_name: 'TechCorp Italia',
          status: 'ACTIVE',
          priority: 'HIGH',
          start_date: new Date('2025-01-15'),
          end_date: new Date('2025-06-30'),
          budget: 250000,
          type: 'FORMAL',
          description: 'Complete redesign of the e-commerce platform with modern React architecture',
          objectives: {
            primary: ['Improve conversion rate by 30%', 'Reduce page load time by 50%'],
            secondary: ['Implement A/B testing', 'Add progressive web app features']
          },
          deliverables: {
            milestone1: 'Design mockups and prototypes',
            milestone2: 'Frontend implementation',
            milestone3: 'Backend integration',
            milestone4: 'Testing and deployment'
          },
          project_manager_id: manager.id,
          tenant_id: tenant.id
        }
      }),
      prisma.projects.create({
        data: {
          name: 'Mobile Banking App',
          code: 'PROJ-2025-002',
          client_name: 'BankItalia SpA',
          status: 'PLANNING',
          priority: 'CRITICAL',
          start_date: new Date('2025-02-01'),
          end_date: new Date('2025-09-30'),
          budget: 500000,
          type: 'FORMAL',
          description: 'Development of a new mobile banking application for iOS and Android',
          objectives: {
            primary: ['Launch on both app stores', 'Support for 5+ payment methods'],
            secondary: ['Biometric authentication', 'Real-time notifications']
          },
          project_manager_id: manager.id,
          tenant_id: tenant.id
        }
      }),
      prisma.projects.create({
        data: {
          name: 'Internal HR System Upgrade',
          code: 'PROJ-2025-003',
          client_name: 'Internal',
          status: 'ACTIVE',
          priority: 'MEDIUM',
          start_date: new Date('2025-01-01'),
          end_date: new Date('2025-04-30'),
          budget: 80000,
          type: 'INFORMAL',
          description: 'Upgrade of the internal HR management system with new features',
          objectives: {
            primary: ['Implement performance review module', 'Add analytics dashboard'],
            secondary: ['Mobile responsive design', 'Integration with payroll']
          },
          project_manager_id: manager.id,
          tenant_id: tenant.id
        }
      })
    ]);

    console.log(`✅ Created ${projects.length} projects`);

    // Create roles for each project
    console.log('👥 Creating project roles...');
    const roles = [];

    // E-Commerce Platform roles
    roles.push(
      await prisma.project_roles.create({
        data: {
          project_id: projects[0].id,
          title: 'Senior Frontend Developer',
          seniority: 'SENIOR',
          quantity: 2,
          required_skills: { React: 90, TypeScript: 85, 'Node.js': 70 },
          allocation_percentage: 100,
          work_mode: 'HYBRID',
          priority: 'HIGH',
          status: 'OPEN',
          tenant_id: tenant.id
        }
      }),
      await prisma.project_roles.create({
        data: {
          project_id: projects[0].id,
          title: 'Backend Developer',
          seniority: 'MIDDLE',
          quantity: 2,
          required_skills: { 'Node.js': 85, PostgreSQL: 80, REST: 75 },
          allocation_percentage: 100,
          work_mode: 'REMOTE',
          priority: 'HIGH',
          status: 'OPEN',
          tenant_id: tenant.id
        }
      })
    );

    // Mobile Banking App roles
    roles.push(
      await prisma.project_roles.create({
        data: {
          project_id: projects[1].id,
          title: 'Mobile Developer',
          seniority: 'SENIOR',
          quantity: 3,
          required_skills: { 'React Native': 90, iOS: 85, Android: 85 },
          allocation_percentage: 100,
          work_mode: 'ONSITE',
          priority: 'CRITICAL',
          status: 'OPEN',
          tenant_id: tenant.id
        }
      }),
      await prisma.project_roles.create({
        data: {
          project_id: projects[1].id,
          title: 'Security Engineer',
          seniority: 'LEAD',
          quantity: 1,
          required_skills: { Security: 95, Encryption: 90, 'OAuth 2.0': 85 },
          allocation_percentage: 50,
          work_mode: 'HYBRID',
          priority: 'CRITICAL',
          status: 'OPEN',
          tenant_id: tenant.id
        }
      })
    );

    // Internal HR System roles
    roles.push(
      await prisma.project_roles.create({
        data: {
          project_id: projects[2].id,
          title: 'Full Stack Developer',
          seniority: 'MIDDLE',
          quantity: 1,
          required_skills: { React: 80, 'Node.js': 80, PostgreSQL: 75 },
          allocation_percentage: 75,
          work_mode: 'REMOTE',
          priority: 'NORMAL',
          status: 'OPEN',
          tenant_id: tenant.id
        }
      }),
      await prisma.project_roles.create({
        data: {
          project_id: projects[2].id,
          title: 'UI/UX Designer',
          seniority: 'JUNIOR',
          quantity: 1,
          required_skills: { Figma: 85, 'UI Design': 80, 'User Research': 70 },
          allocation_percentage: 50,
          work_mode: 'HYBRID',
          priority: 'LOW',
          status: 'IN_REVIEW',
          tenant_id: tenant.id
        }
      })
    );

    console.log(`✅ Created ${roles.length} project roles`);

    // Create milestones
    console.log('🎯 Creating project milestones...');
    const milestones = [];

    // E-Commerce milestones
    milestones.push(
      await prisma.project_milestones.create({
        data: {
          project_id: projects[0].id,
          name: 'Design & Prototyping',
          due_date: new Date('2025-02-28'),
          status: 'COMPLETED',
          completion_percentage: 100,
          tenant_id: tenant.id
        }
      }),
      await prisma.project_milestones.create({
        data: {
          project_id: projects[0].id,
          name: 'Frontend Development',
          due_date: new Date('2025-04-30'),
          status: 'IN_PROGRESS',
          completion_percentage: 45,
          tenant_id: tenant.id
        }
      })
    );

    // Mobile Banking milestones
    milestones.push(
      await prisma.project_milestones.create({
        data: {
          project_id: projects[1].id,
          name: 'Requirements & Security Analysis',
          due_date: new Date('2025-03-15'),
          status: 'PENDING',
          completion_percentage: 0,
          tenant_id: tenant.id
        }
      })
    );

    // HR System milestone
    milestones.push(
      await prisma.project_milestones.create({
        data: {
          project_id: projects[2].id,
          name: 'Performance Review Module',
          due_date: new Date('2025-03-31'),
          status: 'IN_PROGRESS',
          completion_percentage: 60,
          tenant_id: tenant.id
        }
      })
    );

    console.log(`✅ Created ${milestones.length} project milestones`);

    // Create some activity logs
    console.log('📝 Creating activity logs...');
    await prisma.project_activity_logs.create({
      data: {
        project_id: projects[0].id,
        action: 'STATUS_CHANGE',
        details: {
          from: 'PLANNING',
          to: 'ACTIVE',
          reason: 'All resources allocated, project kickoff completed'
        },
        performed_by: manager.id,
        tenant_id: tenant.id
      }
    });

    await prisma.project_activity_logs.create({
      data: {
        project_id: projects[1].id,
        action: 'PRIORITY_CHANGE',
        details: {
          from: 'HIGH',
          to: 'CRITICAL',
          reason: 'CEO escalation due to regulatory deadline'
        },
        performed_by: manager.id,
        tenant_id: tenant.id
      }
    });

    console.log('✅ Created activity logs');

    console.log('\n🎉 Project seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Projects: ${projects.length}`);
    console.log(`  - Roles: ${roles.length}`);
    console.log(`  - Milestones: ${milestones.length}`);
    console.log(`  - Open roles: ${roles.filter(r => r.status === 'OPEN').length}`);
    console.log(`  - Critical vacancies: ${roles.filter(r => r.priority === 'CRITICAL' && r.status === 'OPEN').length}`);

  } catch (error) {
    console.error('❌ Error seeding projects:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });