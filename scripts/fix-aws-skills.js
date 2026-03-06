const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Fix synonyms (deduplicate first, then add new ones)
  // Cloud Architecture (1825)
  const uniqueSynonyms1825 = [...new Set([
    'cloud architecture', 'architecture documentation', 'solution architecture',
    'aws architect', 'aws architectures', 'architetture aws'
  ])];
  await prisma.skills.update({ where: { id: 1825 }, data: { Synonyms_Skill: uniqueSynonyms1825 } });
  console.log('Skill 1825 synonyms:', JSON.stringify(uniqueSynonyms1825));

  // Amazon ECS (75)
  const uniqueSynonyms75 = [...new Set([
    'amazon elastic container service (ecs)', 'elastic container service',
    'aws ecs', 'amazon elastic container service ecs', 'amazon ecs', 'ecs'
  ])];
  await prisma.skills.update({ where: { id: 75 }, data: { Synonyms_Skill: uniqueSynonyms75 } });
  console.log('Skill 75 synonyms:', JSON.stringify(uniqueSynonyms75));

  // 2. Get tenant_id from an existing employee_skill
  const sample = await prisma.employee_skills.findFirst({
    where: { employee_id: 261 },
    select: { tenant_id: true }
  });
  const tenantId = sample.tenant_id;
  console.log('Tenant ID:', tenantId);

  // 3. Seed ECS (75) to top AWS employees via raw SQL
  const targets = [
    { empId: 261, prof: 7, years: 3.5 },
    { empId: 228, prof: 6, years: 3.0 },
    { empId: 222, prof: 5, years: 2.5 },
    { empId: 227, prof: 7, years: 4.0 },
    { empId: 232, prof: 6, years: 3.5 }
  ];

  for (const t of targets) {
    const exists = await prisma.employee_skills.findFirst({
      where: { employee_id: t.empId, skill_id: 75 }
    });
    if (exists) {
      console.log('Employee ' + t.empId + ' already has ECS');
      continue;
    }
    await prisma.$executeRawUnsafe(`
      INSERT INTO employee_skills (employee_id, skill_id, proficiency_level, years_experience, tenant_id, source, created_at, updated_at)
      VALUES ($1, 75, $2, $3, $4, 'seed-demo-fix', NOW(), NOW())
    `, t.empId, t.prof, t.years, tenantId);
    console.log('Seeded ECS to employee ' + t.empId + ' prof:' + t.prof);
  }

  console.log('Done!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
