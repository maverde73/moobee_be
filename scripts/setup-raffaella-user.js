/**
 * Script per creare/aggiornare l'utente Raffaella Maiello con il tenant corretto
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setupRaffaellaUser() {
  try {
    console.log('📦 Setting up Raffaella Maiello user with correct tenant\n');

    const raffaellaTenantId = 'b1234567-89ab-cdef-0123-456789abcdef';
    const email = 'raffaella.maiello@nexadata.it';
    const defaultPassword = 'Password123!';

    // 1. Verifica/crea il tenant
    console.log('1. Verifica/crea tenant per Raffaella:');
    let tenant = await prisma.tenants.findUnique({
      where: { id: raffaellaTenantId }
    });

    if (!tenant) {
      console.log('   Creazione nuovo tenant...');
      tenant = await prisma.tenants.create({
        data: {
          id: raffaellaTenantId,
          slug: 'nexa-data',
          name: 'Nexa Data SRL',
          email: 'info@nexadata.it',
          subscription_plan: 'enterprise',
          subscription_status: 'active',
          max_employees: 100,
          settings: {
            locale: {
              currency: 'EUR',
              language: 'it',
              timezone: 'Europe/Rome',
              date_format: 'DD/MM/YYYY'
            },
            features: {
              projects: true,
              analytics: true,
              api_access: true,
              assessments: true,
              white_label: false,
              custom_reports: true
            }
          }
        }
      });
      console.log('   ✅ Tenant creato');
    } else {
      console.log('   ✅ Tenant esistente:', tenant.name);
    }

    // 2. Verifica/crea l'utente in tenant_users
    console.log('\n2. Verifica/crea utente Raffaella Maiello:');
    let user = await prisma.tenant_users.findFirst({
      where: { email }
    });

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    if (!user) {
      console.log('   Creazione nuovo utente...');

      // Prima trova o crea l'employee
      let employee = await prisma.employees.findFirst({
        where: { email: email }
      });

      if (!employee) {
        employee = await prisma.employees.create({
          data: {
            first_name: 'Raffaella',
            last_name: 'Maiello',
            email: email,
            tenant_id: raffaellaTenantId,
            position: 'HR Manager',
            department_id: 1, // Human Resources Department
            hire_date: new Date(),
            is_active: true
          }
        });
        console.log('   Employee creato');
      } else {
        // Aggiorna il tenant_id dell'employee esistente
        employee = await prisma.employees.update({
          where: { id: employee.id },
          data: { tenant_id: raffaellaTenantId, is_active: true }
        });
        console.log('   Employee esistente aggiornato');
      }

      // Poi crea l'utente tenant
      user = await prisma.tenant_users.create({
        data: {
          email: email,
          password_hash: hashedPassword,
          role: 'hr',
          tenant_id: raffaellaTenantId,
          employee_id: employee.id,
          is_active: true,
          email_verified_at: new Date(),
          two_factor_enabled: false
        }
      });

      console.log('   ✅ Utente creato');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${defaultPassword}`);
      console.log(`   Role: hr`);
      console.log(`   Tenant ID: ${raffaellaTenantId}`);
    } else {
      console.log('   Utente esistente. Aggiornamento tenant...');

      // Aggiorna il tenant ID se necessario
      if (user.tenant_id !== raffaellaTenantId) {
        await prisma.tenant_users.update({
          where: { id: user.id },
          data: {
            tenant_id: raffaellaTenantId,
            password_hash: hashedPassword, // Resetta password per sicurezza
            is_active: true
          }
        });

        // Aggiorna anche l'employee se esiste
        if (user.employee_id) {
          await prisma.employees.update({
            where: { id: user.employee_id },
            data: { tenant_id: raffaellaTenantId }
          });
        }

        console.log('   ✅ Tenant ID aggiornato');
        console.log(`   Password resettata: ${defaultPassword}`);
      } else {
        console.log('   ✅ Tenant ID già corretto');
      }
    }

    // 3. Verifica le selezioni di assessment per il tenant
    console.log('\n3. Verifica selezioni assessment:');
    const selections = await prisma.tenantAssessmentSelection.findMany({
      where: {
        tenantId: raffaellaTenantId,
        isActive: true
      },
      include: {
        template: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`   Selezioni attive: ${selections.length}`);
    selections.forEach(sel => {
      console.log(`   • ${sel.template.name}`);
    });

    // Se non ci sono selezioni, aggiungine alcune di default
    if (selections.length === 0) {
      console.log('\n   Aggiunta selezioni di default...');

      const templates = await prisma.assessmentTemplate.findMany({
        where: {
          isActive: true,
          type: { in: ['big_five', 'disc', 'belbin'] }
        },
        take: 3
      });

      for (const template of templates) {
        await prisma.tenantAssessmentSelection.create({
          data: {
            tenantId: raffaellaTenantId,
            templateId: template.id,
            isActive: true,
            selectedBy: 'system'
          }
        });
        console.log(`   • Aggiunto: ${template.name}`);
      }
    }

    // 4. Test login
    console.log('\n4. Test login:');
    const testUser = await prisma.tenant_users.findFirst({
      where: {
        email: email,
        is_active: true
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (testUser) {
      const validPassword = await bcrypt.compare(defaultPassword, testUser.password_hash);
      if (validPassword) {
        console.log('   ✅ Login test superato');
        console.log('   User data che verrà salvato in localStorage:');
        console.log({
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.first_name,
          lastName: testUser.last_name,
          role: testUser.role,
          tenantId: testUser.tenant_id,
          tenant: testUser.tenants
        });
      } else {
        console.log('   ❌ Password non valida');
      }
    } else {
      console.log('   ❌ Utente non trovato o non attivo');
    }

    console.log('\n✅ Setup completato!');
    console.log('\n📝 Credenziali di accesso:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${defaultPassword}`);
    console.log(`   Tenant: ${tenant.name} (${raffaellaTenantId})`);
    console.log('\n🚀 Ora puoi fare login in FE_moobee con queste credenziali');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

setupRaffaellaUser();