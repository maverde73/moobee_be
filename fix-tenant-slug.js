const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixTenantSlug() {
  console.log('🔧 Fixing tenant slug...\n');

  try {
    // Update Nexa Data tenant slug
    const result = await prisma.tenants.update({
      where: { id: 'f5eafcce-26af-4699-aa97-dd8829621406' },
      data: { slug: 'nexadata' }
    });

    console.log(`✅ Updated tenant slug from '${result.slug}' to 'nexadata'`);
    console.log(`   Name: ${result.name}`);
    console.log(`   ID: ${result.id}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixTenantSlug();
