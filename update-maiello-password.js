const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function updateMaielloPassword() {
  console.log("🔐 Updating Maiello password...\n");

  const email = "rmaiello@nexadata.it";
  const newPassword = "123456789_1";

  try {
    // Generate password hash
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user in database
    const result = await prisma.tenant_users.updateMany({
      where: { email },
      data: {
        password_hash: passwordHash,
        password: null, // Clear plain password if it exists
        force_password_change: false, // Ensure no password change required
      },
    });

    if (result.count > 0) {
      console.log(`✅ Updated password for: ${email}`);
      console.log(`   New password: ${newPassword}`);
    } else {
      console.log(`⚠️  No user found with email: ${email}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${email}:`, error.message);
  }

  console.log("\n✨ Password update complete!");
  await prisma.$disconnect();
}

updateMaielloPassword().catch(async (error) => {
  console.error("Fatal error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
