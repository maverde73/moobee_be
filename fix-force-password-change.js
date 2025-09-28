const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixForcePasswordChange() {
  console.log('🔓 Removing force password change flag...\n');

  const users = [
    'rmaiello@nexadata.it',
    'cabdelmessih@nexadata.it'
  ];

  for (const email of users) {
    try {
      const result = await prisma.tenant_users.updateMany({
        where: { email },
        data: {
          force_password_change: false
        }
      });

      if (result.count > 0) {
        console.log(`✅ Removed force password change for: ${email}`);
      } else {
        console.log(`⚠️  No user found with email: ${email}`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${email}:`, error.message);
    }
  }

  console.log('\n✨ Complete!');
  await prisma.$disconnect();
}

fixForcePasswordChange().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});