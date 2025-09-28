const prisma = require('./src/config/database');

async function getAllRoles() {
  try {
    const roles = await prisma.$queryRaw`
      SELECT id, "Role" as name 
      FROM roles 
      ORDER BY id
    `;
    
    console.log(`\nTotale ruoli trovati: ${roles.length}\n`);
    roles.forEach(role => {
      console.log(`${role.id}:${role.name}`);
    });
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getAllRoles();
