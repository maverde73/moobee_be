/**
 * Script per verificare i ruoli esistenti nel database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoles() {
  try {
    const roles = await prisma.$queryRaw`
      SELECT id, "Role" as name
      FROM roles
      ORDER BY id
      LIMIT 100
    `;

    console.log('Ruoli esistenti nel database:');
    console.log('=============================');

    roles.forEach(role => {
      console.log(`ID: ${role.id} - ${role.name}`);
    });

    console.log(`\nTotale ruoli trovati: ${roles.length}`);

    // Verifica ruoli con soft skills
    const rolesWithSkills = await prisma.$queryRaw`
      SELECT DISTINCT r.id, r."Role" as name, COUNT(rs.id) as skill_count
      FROM roles r
      LEFT JOIN role_soft_skills rs ON rs."roleId" = r.id
      WHERE rs.id IS NOT NULL
      GROUP BY r.id, r."Role"
      ORDER BY skill_count DESC
      LIMIT 50
    `;

    console.log('\nRuoli con soft skills:');
    console.log('======================');
    rolesWithSkills.forEach(role => {
      console.log(`ID: ${role.id} - ${role.name} (${role.skill_count} skills)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoles();