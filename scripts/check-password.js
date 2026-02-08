/**
 * Script per verificare le password nel database
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPassword() {
  const email = process.argv[2] || 'rmaiello@nexadata.it';
  const testPassword = process.argv[3] || '123456789_1';

  console.log(`\n🔍 Verifica password per: ${email}`);
  console.log(`   Password da testare: ${testPassword}\n`);

  const user = await prisma.tenant_users.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      is_active: true,
      role: true,
      tenant_id: true
    }
  });

  if (!user) {
    console.log('❌ Utente non trovato!');
    return;
  }

  console.log('📋 Dati utente:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   tenant_id: ${user.tenant_id}`);
  console.log(`   is_active: ${user.is_active}`);
  console.log(`   Password hash: ${user.password ? user.password.substring(0, 20) + '...' : 'NULL'}`);
  console.log(`   Password length: ${user.password ? user.password.length : 0}`);

  if (!user.password) {
    console.log('\n❌ Password è NULL o vuota!');
    return;
  }

  // Test bcrypt comparison
  console.log('\n🔐 Test bcrypt.compare...');
  const isValid = await bcrypt.compare(testPassword, user.password);
  console.log(`   Risultato: ${isValid ? '✅ PASSWORD VALIDA' : '❌ PASSWORD NON VALIDA'}`);

  // Generate a new hash for comparison
  console.log('\n🔑 Hash di riferimento per la password:');
  const newHash = await bcrypt.hash(testPassword, 10);
  console.log(`   Nuovo hash: ${newHash.substring(0, 20)}...`);
}

checkPassword()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
