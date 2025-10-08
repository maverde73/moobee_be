const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTypes() {
  const result = await prisma.$queryRaw`
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_name LIKE 'employee_%'
      AND column_name = 'tenant_id'
    ORDER BY table_name;
  `;

  console.log('\nTenant ID Types Across Employee Tables:');
  console.table(result);

  const uuidTables = result.filter(r => r.udt_name === 'uuid');
  const textTables = result.filter(r => r.udt_name === 'text');

  console.log(`\n✅ TEXT type: ${textTables.length} tables`);
  console.log(`❌ UUID type: ${uuidTables.length} tables`);

  if (uuidTables.length > 0) {
    console.log('\n⚠️  These tables still have UUID tenant_id:');
    uuidTables.forEach(t => console.log(`   - ${t.table_name}`));
  }

  await prisma.$disconnect();
}

checkTypes();
