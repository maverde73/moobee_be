/**
 * Script per creare un tenant di default
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDefaultTenant() {
  try {
    // Check if a default tenant already exists
    const existingDefault = await prisma.tenants.findFirst({
      where: {
        slug: 'default'
      }
    });

    if (existingDefault) {
      console.log('Default tenant already exists:');
      console.log('ID:', existingDefault.id);
      console.log('Name:', existingDefault.name);
      return existingDefault;
    }

    // Create default tenant
    const defaultTenant = await prisma.tenants.create({
      data: {
        slug: 'default',
        name: 'Default Organization',
        email: 'admin@default.com',
        subscription_plan: 'enterprise',
        subscription_status: 'active',
        max_employees: 1000,
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
          },
          notifications: {
            sms_enabled: false,
            webhook_url: null,
            email_enabled: true
          }
        }
      }
    });

    console.log('✅ Default tenant created successfully!');
    console.log('ID:', defaultTenant.id);
    console.log('Name:', defaultTenant.name);
    console.log('Slug:', defaultTenant.slug);

    console.log('\nYou can use this tenant ID in your application:');
    console.log(`export TENANT_ID="${defaultTenant.id}"`);

    return defaultTenant;
  } catch (error) {
    console.error('Error creating default tenant:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultTenant();