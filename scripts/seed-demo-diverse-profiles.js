/**
 * seed-demo-diverse-profiles.js
 *
 * Creates diversified employee profiles for realistic matching demo:
 * - Phase 1: Upsert offices (8 cities)
 * - Phase 2: Redistribute employees across offices (demo-calibrated)
 * - Phase 3: Skill assignment with primary/secondary/tertiary tiers + noise
 * - Phase 4: Certifications per seniority
 * - Phase 5: Languages (Italian + English + optional 3rd)
 * - Phase 6: Project assignments (varied availability)
 * - Phase 7: Freshness variance on employee_skills.updated_at
 *
 * Usage: cd BE_nodejs && node scripts/seed-demo-diverse-profiles.js
 */

const { Client } = require('pg');

const DB_URL = 'postgresql://postgres:bABwhkinFbMZmzyAzghHlqNJhYuIEfnc@shuttle.proxy.rlwy.net:25389/railway';
const TENANT_ID = 'f5eafcce-26af-4699-aa97-dd8829621406';

// ============================================================
// CLUSTER DEFINITIONS (verified skill IDs from DB)
// ============================================================

const CLUSTERS = {
  'Frontend React': {
    skillIds: [1365, 1682, 821, 693, 277, 1807, 1367],
    skillNames: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Next.js', 'React Redux']
  },
  'Frontend Angular': {
    skillIds: [628, 1682, 821, 693, 277, 1597],
    skillNames: ['Angular', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SASS']
  },
  'Frontend Vue': {
    skillIds: [1745, 1682, 821, 693, 277, 1597],
    skillNames: ['Vue.js', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SASS']
  },
  'Backend Java': {
    skillIds: [1568, 1537, 1298, 115, 836, 113],
    skillNames: ['Java', 'Spring Framework', 'PostgreSQL', 'Maven', 'JUnit', 'Kafka']
  },
  'Backend .NET': {
    skillIds: [249, 975, 1020, 979, 30, 1035],
    skillNames: ['C#', 'ASP.NET', 'SQL Server', 'Azure', 'ADO.NET', 'Visual C# .NET']
  },
  'Backend Node': {
    skillIds: [1132, 1682, 1068, 1376, 648, 1298],
    skillNames: ['Node.js', 'TypeScript', 'MongoDB', 'Redis', 'GraphQL', 'PostgreSQL']
  },
  'Backend Python': {
    skillIds: [1335, 456, 578, 1298, 1376, 458],
    skillNames: ['Python', 'Django', 'Flask', 'PostgreSQL', 'Redis', 'Docker']
  },
  'DevOps': {
    skillIds: [458, 858, 741, 81, 825, 882, 88],
    skillNames: ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'Jenkins', 'Linux', 'Ansible']
  },
  'Data Engineering': {
    skillIds: [1335, 120, 113, 100, 1298, 108, 1334],
    skillNames: ['Python', 'Spark', 'Kafka', 'Airflow', 'PostgreSQL', 'Hadoop', 'PySpark']
  },
  'Mobile': {
    skillIds: [1366, 1682, 1575, 856, 821, 1365],
    skillNames: ['React Native', 'TypeScript', 'Swift', 'Kotlin', 'JavaScript', 'React']
  }
};

// Adjacent clusters for secondary skill selection
const ADJACENT_CLUSTERS = {
  'Frontend React': ['Frontend Vue', 'Mobile', 'Backend Node'],
  'Frontend Angular': ['Frontend React', 'Backend Java', 'Backend .NET'],
  'Frontend Vue': ['Frontend React', 'Backend Node', 'Backend Python'],
  'Backend Java': ['Backend .NET', 'DevOps', 'Data Engineering'],
  'Backend .NET': ['Backend Java', 'DevOps', 'Frontend Angular'],
  'Backend Node': ['Frontend React', 'Backend Python', 'DevOps'],
  'Backend Python': ['Data Engineering', 'DevOps', 'Backend Node'],
  'DevOps': ['Backend Java', 'Backend Python', 'Backend Node'],
  'Data Engineering': ['Backend Python', 'DevOps', 'Backend Java'],
  'Mobile': ['Frontend React', 'Backend Node', 'Frontend Vue']
};

const POSITION_CLUSTER_MAP = {
  'Frontend Developer': ['Frontend React', 'Frontend Angular', 'Frontend Vue'],
  'Backend Developer': ['Backend Java', 'Backend .NET', 'Backend Node', 'Backend Python'],
  'Full Stack Developer': ['Backend Node', 'Backend Python', 'Frontend React'],
  'DevOps Engineer': ['DevOps'],
  'Data Engineer': ['Data Engineering'],
  'Data Analyst': ['Data Engineering'],
  'Senior Developer': ['Backend Java', 'Backend .NET', 'Backend Node', 'Backend Python', 'Frontend React'],
  'Tech Lead': ['Backend Java', 'Backend Node', 'DevOps'],
  'Architect': ['Backend Java', 'DevOps', 'Backend Node'],
  'Developer': ['Backend Node', 'Backend Python', 'Frontend React', 'Backend Java'],
  'Junior Developer': ['Frontend React', 'Frontend Vue', 'Backend Node', 'Backend Python'],
  'UX Designer': ['Frontend React', 'Frontend Vue', 'Frontend Angular'],
  'QA Engineer': ['Backend Java', 'Backend Python', 'Backend Node'],
  'Mobile Developer': ['Mobile'],
  'Cloud Engineer': ['DevOps'],
  'Solution Architect': ['DevOps', 'Backend Java'],
  'Project Manager': ['Backend Node', 'Frontend React'],
  'Scrum Master': ['Backend Node', 'Frontend React'],
  'HR Specialist': ['Frontend React'],
  'Business Analyst': ['Data Engineering', 'Backend Python']
};

// Frontend cluster names (for Genova exclusion)
const FRONTEND_CLUSTERS = ['Frontend React', 'Frontend Angular', 'Frontend Vue'];

// Certification pools per cluster
const CERT_POOLS = {
  'DevOps': ['AWS Certified Solutions Architect', 'AWS Certified Developer', 'Kubernetes Administrator (CKA)', 'HashiCorp Terraform Associate'],
  'Backend Java': ['Oracle Java Certified', 'Spring Professional Certification', 'Scrum Master (CSM)'],
  'Backend .NET': ['Microsoft Certified Developer', 'Azure Solutions Architect', 'Scrum Master (CSM)'],
  'Backend Node': ['AWS Certified Developer', 'MongoDB Certified', 'Scrum Master (CSM)'],
  'Backend Python': ['AWS Certified Developer', 'Google Cloud Professional', 'Scrum Master (CSM)'],
  'Frontend React': ['Scrum Master (CSM)', 'AWS Certified Developer'],
  'Frontend Angular': ['Scrum Master (CSM)', 'Microsoft Certified Developer'],
  'Frontend Vue': ['Scrum Master (CSM)', 'AWS Certified Developer'],
  'Data Engineering': ['Google Cloud Professional', 'AWS Certified Solutions Architect', 'Databricks Certified'],
  'Mobile': ['Scrum Master (CSM)', 'AWS Certified Developer']
};

// Language CEFR levels
const ENGLISH_LEVELS = ['B1', 'B2', 'C1', 'C2'];
const THIRD_LANGUAGES = ['French', 'German', 'Spanish'];

// ============================================================
// OFFICES (Phase 1)
// ============================================================

const OFFICES_TO_CREATE = [
  { name: 'Sede Milano', city: 'Milano' },
  { name: 'Sede Roma', city: 'Roma' },
  { name: 'Sede Genova', city: 'Genova' },
  { name: 'Sede Torino', city: 'Torino' },
  { name: 'Sede Bologna', city: 'Bologna' },
  { name: 'Sede Napoli', city: 'Napoli' },
  { name: 'Sede Firenze', city: 'Firenze' },
  { name: 'Sede Bari', city: 'Bari' }
];

// Office distribution weights (must sum to 1.0)
const OFFICE_DISTRIBUTION = {
  'Milano': 0.35,
  'Roma': 0.15,
  'Torino': 0.12,
  'Genova': 0.05,
  'Bologna': 0.10,
  'Napoli': 0.08,
  'Firenze': 0.08,
  'Bari': 0.07
};

// ============================================================
// UTILITIES
// ============================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to DB\n');

  try {
    // ── Phase 1: Upsert offices ──
    console.log('=== Phase 1: Offices ===');
    const officeMap = {}; // city → officeId

    for (const office of OFFICES_TO_CREATE) {
      const existing = await client.query(
        `SELECT id FROM offices WHERE name = $1 AND tenant_id = $2`,
        [office.name, TENANT_ID]
      );

      if (existing.rows.length > 0) {
        officeMap[office.city] = existing.rows[0].id;
        console.log(`  Office exists: ${office.name} (id=${existing.rows[0].id})`);
      } else {
        const created = await client.query(
          `INSERT INTO offices (name, city, tenant_id, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
          [office.name, office.city, TENANT_ID]
        );
        officeMap[office.city] = created.rows[0].id;
        console.log(`  Created office: ${office.name} (id=${created.rows[0].id})`);
      }
    }

    // ── Load all active employees ──
    const empResult = await client.query(`
      SELECT e.id, e.first_name, e.last_name, e.position, e.office_id
      FROM employees e
      WHERE e.tenant_id = $1 AND e.is_active = true
      ORDER BY e.id
    `, [TENANT_ID]);
    const employees = empResult.rows;
    console.log(`\nFound ${employees.length} active employees`);

    // ── Phase 2: Redistribute employees across offices ──
    console.log('\n=== Phase 2: Office distribution ===');

    // Build city assignment list based on weights
    const cities = Object.keys(OFFICE_DISTRIBUTION);
    const cityAssignments = [];
    for (const city of cities) {
      const count = Math.round(employees.length * OFFICE_DISTRIBUTION[city]);
      for (let i = 0; i < count; i++) cityAssignments.push(city);
    }
    // Fill remainder with Milano
    while (cityAssignments.length < employees.length) cityAssignments.push('Milano');

    const shuffledCities = shuffle(cityAssignments);

    // We need to know each employee's cluster first to enforce Genova constraint
    // So we pre-compute clusters, then assign offices
    const employeeClusterMap = {};
    for (const emp of employees) {
      const position = emp.position || 'Developer';
      const preferredClusters = POSITION_CLUSTER_MAP[position];
      let clusterName;
      if (preferredClusters) {
        clusterName = pickRandom(preferredClusters);
      } else {
        clusterName = pickRandom(Object.keys(CLUSTERS));
      }
      employeeClusterMap[emp.id] = clusterName;
    }

    // Assign offices - Genova only for non-frontend employees
    let officeUpdated = 0;
    const officeCounts = {};
    for (let i = 0; i < employees.length; i++) {
      let city = shuffledCities[i];
      const empCluster = employeeClusterMap[employees[i].id];

      // Genova constraint: no frontend devs
      if (city === 'Genova' && FRONTEND_CLUSTERS.includes(empCluster)) {
        city = 'Milano'; // Redirect frontend devs to Milano
      }

      const officeId = officeMap[city];
      if (officeId) {
        await client.query(
          `UPDATE employees SET office_id = $1 WHERE id = $2`,
          [officeId, employees[i].id]
        );
        employees[i].office_id = officeId;
        employees[i]._city = city;
        officeUpdated++;
        officeCounts[city] = (officeCounts[city] || 0) + 1;
      }
    }

    console.log(`  Updated ${officeUpdated} employees`);
    for (const [city, cnt] of Object.entries(officeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${city}: ${cnt} (${((cnt / employees.length) * 100).toFixed(0)}%)`);
    }

    // ── Verify skill IDs ──
    const allSkillIds = new Set();
    for (const cluster of Object.values(CLUSTERS)) {
      for (const id of cluster.skillIds) allSkillIds.add(id);
    }
    const skillCheck = await client.query(
      `SELECT id FROM skills WHERE id = ANY($1)`,
      [Array.from(allSkillIds)]
    );
    const validSkillIds = new Set(skillCheck.rows.map(r => r.id));

    // ── Phase 3: Skills with varied proficiency ──
    console.log('\n=== Phase 3: Skill assignment ===');

    // Delete old seed/null skills (preserve cv_extracted, assessment)
    const deleteResult = await client.query(`
      DELETE FROM employee_skills
      WHERE tenant_id = $1 AND (source = 'seed' OR source = 'manual' OR source IS NULL)
    `, [TENANT_ID]);
    console.log(`  Deleted ${deleteResult.rowCount} old seed/null skills`);

    // Load existing preserved skills to avoid conflicts
    const existingResult = await client.query(
      `SELECT employee_id, skill_id FROM employee_skills WHERE tenant_id = $1`,
      [TENANT_ID]
    );
    const existingSet = new Set(existingResult.rows.map(r => `${r.employee_id}-${r.skill_id}`));

    // Assign seniority: 50% Junior, 30% Mid, 20% Senior
    const shuffledEmps = shuffle([...employees]);
    const juniorCount = Math.round(shuffledEmps.length * 0.50);
    const midCount = Math.round(shuffledEmps.length * 0.30);

    const empProfiles = [];
    for (let i = 0; i < shuffledEmps.length; i++) {
      let seniority;
      if (i < juniorCount) seniority = 'Junior';
      else if (i < juniorCount + midCount) seniority = 'Mid';
      else seniority = 'Senior';
      empProfiles.push({ ...shuffledEmps[i], seniority });
    }

    // Proficiency ranges by tier and seniority
    const PROF_RANGES = {
      Junior: { primary: [3, 5], secondary: [1, 3], tertiary: [1, 2] },
      Mid:    { primary: [5, 7], secondary: [3, 5], tertiary: [1, 3] },
      Senior: { primary: [7, 10], secondary: [5, 8], tertiary: [2, 5] }
    };

    let insertedSkills = 0;
    let updatedSeniority = 0;
    const seniorityCounts = { Junior: 0, Mid: 0, Senior: 0 };

    // Pre-assign freshness buckets (Phase 7)
    // ~40% current (0-60 days), ~30% aging (90-150 days), ~30% stale (200-400 days)
    const shuffledForFreshness = shuffle([...Array(empProfiles.length).keys()]);
    const currentCount = Math.round(empProfiles.length * 0.40);
    const agingCount = Math.round(empProfiles.length * 0.30);
    const freshnessBucket = {};
    for (let i = 0; i < shuffledForFreshness.length; i++) {
      const empIdx = shuffledForFreshness[i];
      if (i < currentCount) freshnessBucket[empIdx] = 'current';
      else if (i < currentCount + agingCount) freshnessBucket[empIdx] = 'aging';
      else freshnessBucket[empIdx] = 'stale';
    }

    for (let empIdx = 0; empIdx < empProfiles.length; empIdx++) {
      const emp = empProfiles[empIdx];
      const seniority = emp.seniority;
      const ranges = PROF_RANGES[seniority];
      seniorityCounts[seniority]++;

      const primaryCluster = employeeClusterMap[emp.id];
      const primarySkills = CLUSTERS[primaryCluster]?.skillIds.filter(id => validSkillIds.has(id)) || [];

      // Pick 0-1 secondary clusters
      const adjacentOptions = (ADJACENT_CLUSTERS[primaryCluster] || []).filter(c => CLUSTERS[c]);
      const hasSecondary = Math.random() < 0.6;
      const secondaryCluster = hasSecondary && adjacentOptions.length > 0 ? pickRandom(adjacentOptions) : null;
      const secondarySkills = secondaryCluster
        ? CLUSTERS[secondaryCluster].skillIds.filter(id => validSkillIds.has(id) && !primarySkills.includes(id))
        : [];

      // Tertiary: grab a few from other clusters not primary/secondary
      const otherClusters = Object.keys(CLUSTERS).filter(c => c !== primaryCluster && c !== secondaryCluster);
      const tertiaryPool = [];
      for (const c of shuffle(otherClusters).slice(0, 2)) {
        for (const id of CLUSTERS[c].skillIds) {
          if (validSkillIds.has(id) && !primarySkills.includes(id) && !secondarySkills.includes(id)) {
            tertiaryPool.push(id);
          }
        }
      }

      // Select skills per tier
      const selectedPrimary = shuffle(primarySkills).slice(0, randomInt(2, 3));
      const selectedSecondary = shuffle(secondarySkills).slice(0, randomInt(3, Math.min(5, secondarySkills.length)));
      const selectedTertiary = shuffle([...new Set(tertiaryPool)]).slice(0, randomInt(2, 4));

      // Determine freshness date for this employee's skills
      let updatedAtDate;
      const bucket = freshnessBucket[empIdx];
      if (bucket === 'current') {
        updatedAtDate = daysAgo(randomInt(5, 60));
      } else if (bucket === 'aging') {
        updatedAtDate = daysAgo(randomInt(90, 150));
      } else {
        updatedAtDate = daysAgo(randomInt(200, 400));
      }

      const insertSkill = async (skillId, tier) => {
        const key = `${emp.id}-${skillId}`;
        if (existingSet.has(key)) return;

        const [profMin, profMax] = ranges[tier];
        const baseProficiency = randomInt(profMin, profMax);
        // Add noise ±1-2
        const noise = randomInt(-2, 2);
        const proficiency = clamp(baseProficiency + noise, 1, 10);
        const years = Math.max(0.5, parseFloat((proficiency * 0.8 + randomFloat(-1.5, 1.5)).toFixed(1)));

        await client.query(`
          INSERT INTO employee_skills (employee_id, skill_id, proficiency_level, years_experience, source, tenant_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'seed', $5, $6, $6)
          ON CONFLICT (employee_id, skill_id) DO NOTHING
        `, [emp.id, skillId, proficiency, years, TENANT_ID, updatedAtDate]);

        existingSet.add(key);
        insertedSkills++;
      };

      for (const id of selectedPrimary) await insertSkill(id, 'primary');
      for (const id of selectedSecondary) await insertSkill(id, 'secondary');
      for (const id of selectedTertiary) await insertSkill(id, 'tertiary');

      // Update employee_roles seniority
      const roleCheck = await client.query(
        `SELECT id FROM employee_roles WHERE employee_id = $1 AND tenant_id = $2 LIMIT 1`,
        [emp.id, TENANT_ID]
      );
      if (roleCheck.rows.length > 0) {
        await client.query(
          `UPDATE employee_roles SET seniority = $1 WHERE employee_id = $2 AND tenant_id = $3`,
          [seniority, emp.id, TENANT_ID]
        );
        updatedSeniority++;
      }
    }

    console.log(`  Inserted ${insertedSkills} skills`);
    console.log(`  Updated ${updatedSeniority} seniority records`);
    for (const [sen, cnt] of Object.entries(seniorityCounts)) {
      console.log(`    ${sen}: ${cnt} (${((cnt / employees.length) * 100).toFixed(0)}%)`);
    }

    // ── Phase 4: Certifications ──
    console.log('\n=== Phase 4: Certifications ===');

    let certInserted = 0;
    for (const emp of empProfiles) {
      const cluster = employeeClusterMap[emp.id];
      const pool = CERT_POOLS[cluster] || ['Scrum Master (CSM)'];
      const seniority = emp.seniority;

      let certCount;
      if (seniority === 'Junior') {
        certCount = Math.random() < 0.70 ? 0 : 1;
      } else if (seniority === 'Mid') {
        certCount = Math.random() < 0.40 ? 0 : randomInt(1, 2);
      } else {
        certCount = randomInt(1, Math.min(3, pool.length));
      }

      if (certCount === 0) continue;

      const selectedCerts = shuffle(pool).slice(0, certCount);
      for (const certName of selectedCerts) {
        // Check if already exists
        const exists = await client.query(
          `SELECT id FROM employee_certifications WHERE employee_id = $1 AND certification_name = $2 AND tenant_id = $3`,
          [emp.id, certName, TENANT_ID]
        );
        if (exists.rows.length > 0) continue;

        const issueDate = daysAgo(randomInt(90, 1200));
        const expiryDate = new Date(issueDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 3);

        await client.query(`
          INSERT INTO employee_certifications (id, employee_id, certification_name, issuing_organization, issue_date, expiry_date, is_active, tenant_id, created_at, updated_at)
          VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, true, $6, NOW(), NOW())
        `, [emp.id, certName, 'Various', issueDate, expiryDate, TENANT_ID]);
        certInserted++;
      }
    }
    console.log(`  Inserted ${certInserted} certifications`);

    // ── Phase 5: Languages ──
    console.log('\n=== Phase 5: Languages ===');

    // Fetch language IDs
    const langResult = await client.query(
      `SELECT id, name FROM languages WHERE name IN ('Italian', 'English', 'French', 'German', 'Spanish')`
    );
    const langMap = {};
    for (const row of langResult.rows) langMap[row.name] = row.id;
    console.log(`  Found languages: ${Object.keys(langMap).join(', ')}`);

    // Fetch proficiency level IDs
    const profLevelResult = await client.query(
      `SELECT id, cefr_code FROM language_proficiency_levels`
    );
    const profLevelMap = {};
    for (const row of profLevelResult.rows) profLevelMap[row.cefr_code] = row.id;

    let langInserted = 0;
    for (const emp of empProfiles) {
      // Italian for all
      if (langMap['Italian']) {
        const exists = await client.query(
          `SELECT id FROM employee_languages WHERE employee_id = $1 AND language_id = $2`,
          [emp.id, langMap['Italian']]
        );
        if (exists.rows.length === 0) {
          await client.query(`
            INSERT INTO employee_languages (id, employee_id, language_id, is_native, tenant_id, created_at, updated_at)
            VALUES (uuid_generate_v4(), $1, $2, true, $3, NOW(), NOW())
          `, [emp.id, langMap['Italian'], TENANT_ID]);
          langInserted++;
        }
      }

      // English for ~70%
      if (langMap['English'] && Math.random() < 0.70) {
        const exists = await client.query(
          `SELECT id FROM employee_languages WHERE employee_id = $1 AND language_id = $2`,
          [emp.id, langMap['English']]
        );
        if (exists.rows.length === 0) {
          const level = pickRandom(ENGLISH_LEVELS);
          const profLevelId = profLevelMap[level] || null;
          await client.query(`
            INSERT INTO employee_languages (id, employee_id, language_id, proficiency_level_id, reading_level, writing_level, spoken_interaction_level, spoken_production_level, listening_level, tenant_id, created_at, updated_at)
            VALUES (uuid_generate_v4(), $1, $2, $3, $4, $4, $4, $4, $4, $5, NOW(), NOW())
          `, [emp.id, langMap['English'], profLevelId, level, TENANT_ID]);
          langInserted++;
        }
      }

      // Third language for ~12%
      if (Math.random() < 0.12) {
        const thirdLang = pickRandom(THIRD_LANGUAGES);
        if (langMap[thirdLang]) {
          const exists = await client.query(
            `SELECT id FROM employee_languages WHERE employee_id = $1 AND language_id = $2`,
            [emp.id, langMap[thirdLang]]
          );
          if (exists.rows.length === 0) {
            const level = pickRandom(['A2', 'B1', 'B2']);
            const profLevelId = profLevelMap[level] || null;
            await client.query(`
              INSERT INTO employee_languages (id, employee_id, language_id, proficiency_level_id, reading_level, writing_level, spoken_interaction_level, spoken_production_level, listening_level, tenant_id, created_at, updated_at)
              VALUES (uuid_generate_v4(), $1, $2, $3, $4, $4, $4, $4, $4, $5, NOW(), NOW())
            `, [emp.id, langMap[thirdLang], profLevelId, level, TENANT_ID]);
            langInserted++;
          }
        }
      }
    }
    console.log(`  Inserted ${langInserted} language records`);

    // ── Phase 6: Project assignments (varied availability) ──
    console.log('\n=== Phase 6: Project assignments ===');

    // Get active projects
    const projectResult = await client.query(
      `SELECT id FROM projects WHERE tenant_id = $1 AND status = 'ACTIVE' LIMIT 10`,
      [TENANT_ID]
    );
    const projectIds = projectResult.rows.map(r => r.id);

    if (projectIds.length === 0) {
      console.log('  No active projects found, skipping assignments');
    } else {
      // Delete existing seed assignments (we'll re-create)
      await client.query(`
        DELETE FROM project_assignments
        WHERE tenant_id = $1 AND role_in_project = 'seed-assignment'
      `, [TENANT_ID]);

      let assignInserted = 0;
      const today = new Date();
      const threeMonthsLater = new Date(today);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Sort: seniors more likely assigned
      const sortedForAssign = [...empProfiles].sort((a, b) => {
        const order = { Senior: 0, Mid: 1, Junior: 2 };
        return (order[a.seniority] || 2) - (order[b.seniority] || 2);
      });

      // ~20% fully allocated, ~15% 60-80%, ~15% 20-40%, ~50% unassigned
      const total = sortedForAssign.length;
      const fullCount = Math.round(total * 0.20);
      const highCount = Math.round(total * 0.15);
      const lowCount = Math.round(total * 0.15);

      for (let i = 0; i < total; i++) {
        let allocation;
        if (i < fullCount) {
          allocation = 100;
        } else if (i < fullCount + highCount) {
          allocation = randomInt(60, 80);
        } else if (i < fullCount + highCount + lowCount) {
          allocation = randomInt(20, 40);
        } else {
          continue; // unassigned
        }

        const emp = sortedForAssign[i];
        const projectId = pickRandom(projectIds);

        await client.query(`
          INSERT INTO project_assignments (project_id, employee_id, role_in_project, allocation_percentage, start_date, end_date, is_active, tenant_id, created_at)
          VALUES ($1, $2, 'seed-assignment', $3, $4, $5, true, $6, NOW())
        `, [projectId, emp.id, allocation, oneMonthAgo, threeMonthsLater, TENANT_ID]);
        assignInserted++;
      }

      console.log(`  Inserted ${assignInserted} project assignments`);
      console.log(`    100% allocated: ${fullCount}`);
      console.log(`    60-80% allocated: ${highCount}`);
      console.log(`    20-40% allocated: ${lowCount}`);
      console.log(`    Unassigned: ${total - fullCount - highCount - lowCount}`);
    }

    // ── Report ──
    console.log('\n=== Final Report ===');

    const avgResult = await client.query(`
      SELECT AVG(cnt)::numeric(5,1) as avg_skills, MIN(cnt) as min_skills, MAX(cnt) as max_skills
      FROM (
        SELECT employee_id, COUNT(*) as cnt
        FROM employee_skills WHERE tenant_id = $1 GROUP BY employee_id
      ) t
    `, [TENANT_ID]);
    const avg = avgResult.rows[0];
    console.log(`Skills per employee: avg=${avg.avg_skills}, min=${avg.min_skills}, max=${avg.max_skills}`);

    const profResult = await client.query(`
      SELECT
        CASE
          WHEN proficiency_level BETWEEN 1 AND 3 THEN '1-3 (Low)'
          WHEN proficiency_level BETWEEN 4 AND 6 THEN '4-6 (Mid)'
          WHEN proficiency_level BETWEEN 7 AND 10 THEN '7-10 (High)'
        END as range,
        COUNT(*) as cnt
      FROM employee_skills WHERE tenant_id = $1 AND source = 'seed'
      GROUP BY range ORDER BY range
    `, [TENANT_ID]);
    console.log('\nProficiency distribution:');
    for (const row of profResult.rows) {
      console.log(`  ${row.range}: ${row.cnt}`);
    }

    const freshnessResult = await client.query(`
      SELECT freshness, COUNT(*) as cnt
      FROM (
        SELECT employee_id,
          CASE
            WHEN MAX(updated_at) > NOW() - INTERVAL '90 days' THEN 'current'
            WHEN MAX(updated_at) > NOW() - INTERVAL '180 days' THEN 'aging'
            ELSE 'stale'
          END as freshness
        FROM employee_skills WHERE tenant_id = $1
        GROUP BY employee_id
      ) t
      GROUP BY freshness ORDER BY freshness
    `, [TENANT_ID]);
    console.log('\nFreshness distribution:');
    for (const row of freshnessResult.rows) {
      console.log(`  ${row.freshness}: ${row.cnt}`);
    }

  } finally {
    await client.end();
    console.log('\nDone.');
  }
}

main().catch(err => {
  console.error('ERRORE:', err);
  process.exit(1);
});
