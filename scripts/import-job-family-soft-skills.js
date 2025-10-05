/**
 * Import Job Family - Soft Skills Mappings from CSV
 * Date: 2025-10-04 00:06
 * Source: BE_nodejs/data/job_family_soft_skills.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Parse CSV (simple parser for this specific format)
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    // Handle quoted values with commas
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Last value

    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index];
    });
    return row;
  });
}

async function importJobFamilySoftSkills() {
  try {
    console.log('🚀 Starting job_family_soft_skills import...\n');

    // 1. Read CSV file
    const csvPath = path.join(__dirname, '../data/job_family_soft_skills.csv');
    console.log(`📖 Reading CSV from: ${csvPath}`);
    const csvData = parseCSV(csvPath);
    console.log(`✅ Loaded ${csvData.length} rows from CSV\n`);

    // 2. Load all job_family records
    const jobFamilies = await prisma.job_family.findMany({
      where: { is_active: true }
    });
    const jobFamilyMap = new Map(
      jobFamilies.map(jf => [jf.name, jf.id])
    );
    console.log(`✅ Loaded ${jobFamilies.length} job families from database`);

    // 3. Load all soft_skills records
    const softSkills = await prisma.soft_skills.findMany({
      where: { isActive: true }
    });
    const softSkillMap = new Map(
      softSkills.map(ss => [ss.name, ss.id])
    );
    console.log(`✅ Loaded ${softSkills.length} soft skills from database\n`);

    // 4. Prepare data for insertion
    const mappings = [];
    const errors = [];
    const missingJobFamilies = new Set();
    const missingSoftSkills = new Set();

    csvData.forEach((row, index) => {
      const jobFamilyId = jobFamilyMap.get(row.jobFamily);
      const softSkillId = softSkillMap.get(row.softSkill);

      if (!jobFamilyId) {
        missingJobFamilies.add(row.jobFamily);
        errors.push(`Row ${index + 2}: Job family not found: "${row.jobFamily}"`);
        return;
      }

      if (!softSkillId) {
        missingSoftSkills.add(row.softSkill);
        errors.push(`Row ${index + 2}: Soft skill not found: "${row.softSkill}"`);
        return;
      }

      mappings.push({
        job_family_id: jobFamilyId,
        soft_skill_id: softSkillId,
        priority: parseInt(row.priority),
        min_score: parseInt(row.minScore),
        is_required: row.isRequired === 'True',
        weight: parseFloat(row.weight),
        target_score: parseInt(row.targetScore),
        description: row.description,
        created_at: new Date(row.createdAt),
        updated_at: new Date(row.updatedAt)
      });
    });

    // 5. Report errors if any
    if (errors.length > 0) {
      console.error('❌ ERRORS FOUND:\n');
      errors.forEach(err => console.error(`  ${err}`));
      console.error('');

      if (missingJobFamilies.size > 0) {
        console.error('Missing Job Families:', Array.from(missingJobFamilies));
      }
      if (missingSoftSkills.size > 0) {
        console.error('Missing Soft Skills:', Array.from(missingSoftSkills));
        console.error('\n📝 You need to create these soft skills first!');
      }

      console.error(`\n❌ Cannot proceed with import. Fix errors first.\n`);
      process.exit(1);
    }

    // 6. Delete existing mappings (optional - if re-importing)
    console.log('🗑️  Deleting existing job_family_soft_skills mappings...');
    const deleted = await prisma.job_family_soft_skills.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} existing mappings\n`);

    // 7. Insert new mappings
    console.log(`📥 Inserting ${mappings.length} new mappings...`);
    const result = await prisma.job_family_soft_skills.createMany({
      data: mappings,
      skipDuplicates: true
    });
    console.log(`✅ Inserted ${result.count} mappings\n`);

    // 8. Verify insertion
    const totalCount = await prisma.job_family_soft_skills.count();
    console.log(`✅ Total mappings in database: ${totalCount}`);

    // 9. Show sample data
    console.log('\n📊 Sample mappings (Developer / Engineer):');
    const devSamples = await prisma.job_family_soft_skills.findMany({
      where: {
        job_family: {
          name: 'Developer / Engineer'
        }
      },
      include: {
        job_family: { select: { name: true } },
        soft_skills: { select: { name: true } }
      },
      orderBy: { priority: 'asc' }
    });

    devSamples.forEach(m => {
      console.log(`  ${m.priority}. ${m.soft_skills.name} (required: ${m.is_required}, weight: ${m.weight})`);
    });

    console.log('\n✅ Import completed successfully!');

  } catch (error) {
    console.error('❌ Error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importJobFamilySoftSkills();
