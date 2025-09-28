/**
 * Test Certification System
 * @created 2025-09-27 18:30
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCertifications() {
  try {
    console.log('\n📋 Testing Certification System...\n');

    // Count certifications
    const count = await prisma.certification.count();
    console.log(`✅ Total certifications in database: ${count}`);

    // Get categories
    const categories = await prisma.certification.findMany({
      select: { category: true },
      distinct: ['category']
    });
    console.log('\n📂 Available categories:');
    categories.forEach(c => console.log(`  - ${c.category}`));

    // Sample certifications by category
    console.log('\n🎯 Sample certifications by category:');
    for (const cat of ['CLOUD', 'PROJECT', 'SECURITY']) {
      const certs = await prisma.certification.findMany({
        where: { category: cat },
        take: 3,
        select: { code: true, name: true, provider: true }
      });
      console.log(`\n  ${cat}:`);
      certs.forEach(c => {
        console.log(`    • ${c.code}: ${c.name}${c.provider ? ` (${c.provider})` : ''}`);
      });
    }

    // Test search functionality
    const searchResults = await prisma.certification.findMany({
      where: {
        OR: [
          { name: { contains: 'AWS', mode: 'insensitive' } },
          { provider: { contains: 'AWS', mode: 'insensitive' } }
        ]
      },
      select: { code: true, name: true }
    });
    console.log(`\n🔍 Search for "AWS" found ${searchResults.length} results:`);
    searchResults.forEach(c => console.log(`  - ${c.name}`));

    console.log('\n✅ Certification system test completed successfully!\n');

  } catch (error) {
    console.error('❌ Error testing certifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCertifications();