const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixNexadataTenant() {
  console.log('🔧 Fixing Nexadata tenant...\n');

  try {
    // Check if nexadata tenant exists
    let tenant = await prisma.tenants.findFirst({
      where: { slug: 'nexadata' }
    });

    if (!tenant) {
      console.log('Creating nexadata tenant...');
      tenant = await prisma.tenants.create({
        data: {
          name: 'Nexa Data SRL',
          slug: 'nexadata',
          is_active: true
        }
      });
      console.log('✅ Created nexadata tenant with ID:', tenant.id);
    } else {
      console.log('✅ Nexadata tenant already exists with ID:', tenant.id);
    }

    // Ensure default tenant also exists
    let defaultTenant = await prisma.tenants.findFirst({
      where: { slug: 'default' }
    });

    if (!defaultTenant) {
      console.log('Creating default tenant...');
      defaultTenant = await prisma.tenants.create({
        data: {
          name: 'Default Organization',
          slug: 'default',
          is_active: true
        }
      });
      console.log('✅ Created default tenant with ID:', defaultTenant.id);
    } else {
      console.log('✅ Default tenant already exists with ID:', defaultTenant.id);
    }

    // Update employees to have correct tenant_id
    const nexadataEmployees = await prisma.employees.findMany({
      where: {
        OR: [
          { email: { endsWith: '@nexadata.it' } },
          { email: { contains: 'nexadata' } }
        ]
      }
    });

    if (nexadataEmployees.length > 0) {
      console.log(`\nUpdating ${nexadataEmployees.length} Nexadata employees to tenant ${tenant.id}...`);

      await prisma.employees.updateMany({
        where: {
          OR: [
            { email: { endsWith: '@nexadata.it' } },
            { email: { contains: 'nexadata' } }
          ]
        },
        data: {
          tenant_id: tenant.id
        }
      });

      console.log('✅ Updated employee tenant assignments');
    }

    console.log('\n✨ Tenant setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixNexadataTenant();