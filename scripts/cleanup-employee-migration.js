// ====================================================
// CLEANUP SCRIPT: Remove old columns after successful migration
// Date: 2025-09-26 01:00
// Purpose: Execute final cleanup of employee_id migration
// ====================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupMigration() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     EMPLOYEE ID MIGRATION - CLEANUP PHASE         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // Start transaction
    await prisma.$transaction(async (tx) => {
      console.log('🔄 Starting cleanup transaction...\n');

      // Drop old columns from engagement_campaign_assignments
      console.log('📋 Cleaning engagement_campaign_assignments...');
      await tx.$executeRaw`
        ALTER TABLE engagement_campaign_assignments
        DROP COLUMN IF EXISTS employee_id_old
      `;
      console.log('✅ Removed employee_id_old from engagement_campaign_assignments\n');

      // Drop old columns from assessment_campaign_assignments
      console.log('📋 Cleaning assessment_campaign_assignments...');
      await tx.$executeRaw`
        ALTER TABLE assessment_campaign_assignments
        DROP COLUMN IF EXISTS employee_id_old
      `;
      console.log('✅ Removed employee_id_old from assessment_campaign_assignments\n');

      // Drop old columns from assessment_results
      console.log('📋 Cleaning assessment_results...');
      await tx.$executeRaw`
        ALTER TABLE assessment_results
        DROP COLUMN IF EXISTS employee_id_old
      `;
      console.log('✅ Removed employee_id_old from assessment_results\n');

      // Drop temporary indexes
      console.log('📋 Removing temporary indexes...');
      await tx.$executeRaw`
        DROP INDEX IF EXISTS idx_engagement_assignments_employee_id_new
      `;
      await tx.$executeRaw`
        DROP INDEX IF EXISTS idx_assessment_assignments_employee_id_new
      `;
      await tx.$executeRaw`
        DROP INDEX IF EXISTS idx_assessment_results_employee_id_new
      `;
      console.log('✅ Removed all temporary indexes\n');
    });

    // Verify final schema
    console.log('📊 Final Schema Verification:');
    console.log('─────────────────────────────────────────────────────');

    const schemaInfo = await prisma.$queryRaw`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
      AND column_name = 'employee_id'
      ORDER BY table_name
    `;

    schemaInfo.forEach(col => {
      console.log(`✓ ${col.table_name}.employee_id: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Final statistics
    console.log('\n📊 Migration Cleanup Summary:');
    console.log('─────────────────────────────────────────────────────');

    const engagementCount = await prisma.engagement_campaign_assignments.count();
    const assessmentCount = await prisma.assessment_campaign_assignments.count();

    console.log(`• Engagement assignments: ${engagementCount} records`);
    console.log(`• Assessment assignments: ${assessmentCount} records`);

    // Check foreign key constraints
    const foreignKeys = await prisma.$queryRaw`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('engagement_campaign_assignments', 'assessment_campaign_assignments', 'assessment_results')
      AND kcu.column_name = 'employee_id'
    `;

    console.log('\n✅ Foreign Key Constraints:');
    foreignKeys.forEach(fk => {
      console.log(`   • ${fk.table_name}: ${fk.constraint_name}`);
    });

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║          CLEANUP COMPLETED SUCCESSFULLY!          ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('\n📌 Note: Backup tables are preserved at:');
    console.log('   • engagement_campaign_assignments_backup_20250925');
    console.log('   • assessment_campaign_assignments_backup_20250925');
    console.log('   • assessment_results_backup_20250925');
    console.log('   (Keep for 30 days before deletion)');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute cleanup
cleanupMigration().catch(console.error);