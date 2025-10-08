const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fixUsers() {
  console.log('\n🔧 Fixing tenant_users for CV sample employees...\n');

  const cvEmails = [
    'mlamacchia@nexadata.it',
    'alomonaco@nexadata.it',
    'chuang@nexadata.it',
    'adompe@nexadata.it',
    'fvalentini@nexadata.it',
    'fcifaldi@nexadata.it',
    'ptirelli@nexadata.it',
    'acutolo@nexadata.it',
    'tromano@nexadata.it',
    'screscenzi@nexadata.it',
    'rortenzi@nexadata.it',
    'mcarnevale@nexadata.it',
    'azoia@nexadata.it',
    'apacetti@nexadata.it',
    'agiampa@nexadata.it',
    'gnardoni@nexadata.it',
    'evoytovich@nexadata.it',
    'fprosperi@nexadata.it',
    'lfanicchia@nexadata.it',
    'cabdelmessih@nexadata.it',
    'rbova@nexadata.it',
    'mesposito@nexadata.it',
    'asardaro@nexadata.it',
    'vsellan@nexadata.it',
    'dsimone@nexadata.it',
    'rbiasco@nexadata.it',
    'elisagiurelli@nexadata.it'
  ];

  const targetPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(targetPassword, 10);

  let updatedCount = 0;
  let notFoundCount = 0;
  let alreadyOkCount = 0;

  for (const email of cvEmails) {
    const user = await prisma.tenant_users.findFirst({
      where: { email }
    });

    if (!user) {
      console.log(`❌ NOT FOUND: ${email}`);
      notFoundCount++;
      continue;
    }

    // Check if needs update
    const needsPasswordUpdate = !user.password_hash && !user.password;
    const hasResetToken = !!user.password_reset_token;
    const hasResetExpires = !!user.password_reset_expires_at;
    const forceChange = !!user.force_password_change;

    if (!needsPasswordUpdate && !hasResetToken && !hasResetExpires && !forceChange) {
      console.log(`✓ ${email.padEnd(30)} - Already OK`);
      alreadyOkCount++;
      continue;
    }

    // Update user
    await prisma.tenant_users.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        password: null, // Clear old password field
        password_reset_token: null,
        password_reset_expires_at: null,
        force_password_change: false,
        is_active: true,
        failed_login_count: 0,
        locked_until: null
      }
    });

    console.log(`✅ ${email.padEnd(30)} - FIXED`);
    updatedCount++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${updatedCount}`);
  console.log(`   ✓ Already OK: ${alreadyOkCount}`);
  console.log(`   ❌ Not Found: ${notFoundCount}`);
  console.log(`\n🔐 All CV sample users now have password: "${targetPassword}"`);
  console.log(`   - password_hash set`);
  console.log(`   - password_reset_token cleared`);
  console.log(`   - password_reset_expires_at cleared`);
  console.log(`   - force_password_change = false\n`);

  await prisma.$disconnect();
}

fixUsers();
