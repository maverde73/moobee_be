const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRolesQuery() {
  try {
    console.log('Testing roles query - Only NameKnown_Role field:\n');

    const roles = await prisma.$queryRaw`
      SELECT DISTINCT
        id::text as id,
        INITCAP("NameKnown_Role") as name
      FROM roles
      WHERE "NameKnown_Role" IS NOT NULL
      ORDER BY INITCAP("NameKnown_Role") ASC
      LIMIT 20
    `;

    console.log('Results:');
    console.log(JSON.stringify(roles, null, 2));

    console.log('\nTotal results:', roles.length);
    console.log('\nFirst 5 roles:');
    roles.slice(0, 5).forEach(role => {
      console.log(`- ID: ${role.id}, Name: ${role.name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRolesQuery();