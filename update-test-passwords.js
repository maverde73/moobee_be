const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updatePasswords() {
  console.log('🔐 Updating test user passwords...\n');

  const userPasswords = [
    // Nexa Data users
    { email: 'rmaiello@nexadata.it', password: 'Password123!' },
    { email: 'cabdelmessih@nexadata.it', password: 'Password123!' },
  ];

  for (const { email, password } of userPasswords) {
    try {
      // Generate password hash
      const passwordHash = await bcrypt.hash(password, 10);

      // Update user in database
      const result = await prisma.tenant_users.updateMany({
        where: { email },
        data: {
          password_hash: passwordHash,
          password: null // Clear plain password if it exists
        }
      });

      if (result.count > 0) {
        console.log(`✅ Updated password for: ${email}`);
      } else {
        console.log(`⚠️  No user found with email: ${email}`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${email}:`, error.message);
    }
  }

  console.log('\n✨ Password update complete!');
  await prisma.$disconnect();
}

updatePasswords().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});