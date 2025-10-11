/**
 * Test Polling Endpoints for CV Extraction
 * Tests the new polling-based CV import notification system
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPollingEndpoints() {
  try {
    console.log('🧪 Testing Polling Endpoints\n');

    // 1. Check migration 037 fields exist
    console.log('1️⃣ Checking Migration 037 fields...');
    const latestExtraction = await prisma.cv_extractions.findFirst({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        employee_id: true,
        status: true,
        import_stats: true,
        error_phase: true,
        created_at: true,
        updated_at: true
      }
    });

    if (latestExtraction) {
      console.log('✅ Latest extraction found:', {
        id: latestExtraction.id,
        employee_id: latestExtraction.employee_id,
        status: latestExtraction.status,
        has_import_stats: !!latestExtraction.import_stats,
        has_error_phase: latestExtraction.error_phase !== undefined
      });
    } else {
      console.log('⚠️  No extractions found in database');
    }

    // 2. Check status values
    console.log('\n2️⃣ Checking all extraction statuses...');
    const statusCounts = await prisma.$queryRaw`
      SELECT status, COUNT(*)::int as count
      FROM cv_extractions
      GROUP BY status
      ORDER BY count DESC
    `;
    console.log('Status distribution:', statusCounts);

    // 3. Check recent extractions with new fields
    console.log('\n3️⃣ Checking recent extractions with import_stats...');
    const recentWithStats = await prisma.cv_extractions.findMany({
      where: {
        import_stats: { not: null }
      },
      orderBy: { id: 'desc' },
      take: 5,
      select: {
        id: true,
        employee_id: true,
        status: true,
        import_stats: true,
        created_at: true
      }
    });

    if (recentWithStats.length > 0) {
      console.log(`✅ Found ${recentWithStats.length} extractions with import_stats:`);
      recentWithStats.forEach(ext => {
        console.log(`  - ID ${ext.id}: ${ext.status}`, ext.import_stats);
      });
    } else {
      console.log('ℹ️  No extractions with import_stats yet (expected if migration just applied)');
    }

    // 4. Show status enum values
    console.log('\n4️⃣ Valid status values (from spec):');
    console.log('  - pending: Upload completed, waiting for Python extraction');
    console.log('  - processing: Python is extracting data from CV');
    console.log('  - extracted: Python finished extraction, JSON ready');
    console.log('  - importing: BE_nodejs is saving data to database tables');
    console.log('  - completed: All data saved to database successfully');
    console.log('  - failed: Error occurred in any phase');

    console.log('\n✅ All checks completed!');
    console.log('\n📋 Next steps:');
    console.log('  1. Start backend: cd BE_nodejs && npm start');
    console.log('  2. Test upload endpoint: POST /api/cv/extract-mvp');
    console.log('  3. Test polling endpoint: GET /api/cv/extraction-status/:extractionId');
    console.log('  4. Monitor status progression: pending → processing → extracted → importing → completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testPollingEndpoints();
