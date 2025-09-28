/**
 * Script to update passwords for Nexadata test users
 * Created: 25 September 2025, 16:30
 * Purpose: Fix login for test users documented in CLAUDE.md
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function updateNexadataPasswords() {
  console.log('🔐 Starting Nexadata password update...\n');

  // Users that need password update to "Password123!"
  const usersToUpdate = [
    'fvalentini@nexadata.it',
    'kpiatek@nexadata.it',
    'juddin@nexadata.it',
    'acapozi@nexadata.it',
    'dsimone@nexadata.it',
    'cmiraglia@nexadata.it'
  ];

  const newPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  let successCount = 0;
  let errorCount = 0;

  for (const email of usersToUpdate) {
    try {
      // Find the Nexadata tenant
      const tenant = await prisma.tenants.findFirst({
        where: {
          OR: [
            { name: 'Nexadata' },
            { domain: 'nexadata.it' }
          ]
        }
      });

      if (!tenant) {
        console.log('❌ Nexadata tenant not found');
        continue;
      }

      // Update the user password
      const updatedUser = await prisma.tenant_users.updateMany({
        where: {
          email: email.toLowerCase(),
          tenant_id: tenant.id
        },
        data: {
          password_hash: hashedPassword,
          updated_at: new Date()
        }
      });

      if (updatedUser.count > 0) {
        console.log(`✅ Updated password for ${email}`);
        successCount++;
      } else {
        console.log(`⚠️ User ${email} not found in Nexadata tenant`);
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Error updating ${email}:`, error.message);
      errorCount++;
    }
  }

  // Also ensure rmaiello and fgiusti have correct passwords
  console.log('\n📋 Verifying existing test users...');

  const verifyUsers = [
    { email: 'rmaiello@nexadata.it', password: '123456789_1' },
    { email: 'fgiusti@nexadata.it', password: 'Nexadata2024!' }
  ];

  for (const user of verifyUsers) {
    try {
      const tenant = await prisma.tenants.findFirst({
        where: {
          OR: [
            { name: 'Nexadata' },
            { domain: 'nexadata.it' }
          ]
        }
      });

      if (!tenant) continue;

      const existingUser = await prisma.tenant_users.findFirst({
        where: {
          email: user.email.toLowerCase(),
          tenant_id: tenant.id
        }
      });

      if (existingUser) {
        // Verify the password works
        const isValid = await bcrypt.compare(user.password, existingUser.password_hash);
        if (isValid) {
          console.log(`✅ ${user.email} password verified (${user.password})`);
        } else {
          // Update if needed
          const hashedPwd = await bcrypt.hash(user.password, 10);
          await prisma.tenant_users.update({
            where: { id: existingUser.id },
            data: {
              password_hash: hashedPwd,
              updated_at: new Date()
            }
          });
          console.log(`🔧 Fixed password for ${user.email} to ${user.password}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error verifying ${user.email}:`, error.message);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Successfully updated: ${successCount} users`);
  console.log(`   Errors: ${errorCount} users`);
  console.log('\n✨ Password update complete!');
  console.log('\n📝 All test users should now use these credentials:');
  console.log('   rmaiello@nexadata.it    -> 123456789_1');
  console.log('   fgiusti@nexadata.it     -> Nexadata2024!');
  console.log('   fvalentini@nexadata.it  -> Password123!');
  console.log('   kpiatek@nexadata.it     -> Password123!');
  console.log('   juddin@nexadata.it      -> Password123!');
  console.log('   acapozi@nexadata.it     -> Password123!');
  console.log('   dsimone@nexadata.it     -> Password123!');
  console.log('   cmiraglia@nexadata.it   -> Password123!');
}

// Run the update
updateNexadataPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());