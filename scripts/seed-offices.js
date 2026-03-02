/**
 * Seed script: Create offices and assign employees to them.
 *
 * Creates 5 offices for the Moobee tenant and distributes
 * existing active employees round-robin across the offices.
 *
 * Usage: node scripts/seed-offices.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = 'f5eafcce-26af-4699-aa97-dd8829621406';

const OFFICES = [
  { name: 'Sede Milano', city: 'Milano' },
  { name: 'Sede Napoli', city: 'Napoli' },
  { name: 'Sede Roma', city: 'Roma' },
  { name: 'Sede Bari', city: 'Bari' },
  { name: 'Sede Palermo', city: 'Palermo' },
];

async function main() {
  console.log('=== Seed Offices ===\n');

  // 1. Create offices (upsert by name + tenant_id)
  const createdOffices = [];
  for (const office of OFFICES) {
    const existing = await prisma.offices.findFirst({
      where: { name: office.name, tenant_id: TENANT_ID },
    });

    if (existing) {
      console.log(`Office already exists: ${office.name} (id=${existing.id})`);
      createdOffices.push(existing);
    } else {
      const created = await prisma.offices.create({
        data: {
          name: office.name,
          city: office.city,
          tenant_id: TENANT_ID,
          is_active: true,
        },
      });
      console.log(`Created office: ${created.name} (id=${created.id})`);
      createdOffices.push(created);
    }
  }

  console.log(`\nTotal offices: ${createdOffices.length}`);

  // 2. Distribute active employees among offices (round-robin)
  const employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_ID, is_active: true },
    select: { id: true, first_name: true, last_name: true, office_id: true },
    orderBy: { id: 'asc' },
  });

  console.log(`\nActive employees to distribute: ${employees.length}`);

  let updated = 0;
  for (let i = 0; i < employees.length; i++) {
    const office = createdOffices[i % createdOffices.length];
    if (employees[i].office_id !== office.id) {
      await prisma.employees.update({
        where: { id: employees[i].id },
        data: { office_id: office.id },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} employees with office assignments.`);

  // 3. Summary
  for (const office of createdOffices) {
    const count = await prisma.employees.count({
      where: { office_id: office.id, is_active: true },
    });
    console.log(`  ${office.name} (${office.city}): ${count} employees`);
  }

  console.log('\n=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
