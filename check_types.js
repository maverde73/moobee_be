const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTypes() {
  const result = await prisma.$queryRaw`
    SELECT
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_name IN ('employees', 'employee_certifications')
      AND column_name IN ('id', 'employee_id', 'tenant_id')
    ORDER BY table_name, column_name;
  `;

  console.log('Column Types:');
  console.table(result);

  await prisma.$disconnect();
}

checkTypes();
