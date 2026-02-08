/**
 * Script per impostare le password di test nel database
 * Esegui con: node scripts/set-test-passwords.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mappa email -> password in chiaro
const testUsers = [
  // Moobee Platform Users
  { email: 'hr@moobee.com', password: 'HR123!' },
  { email: 'employee@moobee.com', password: 'Employee123!' },
  { email: 'admin@moobee.com', password: 'Admin123!' },
  { email: 'superadmin@moobee.com', password: 'SuperAdmin123!' },

  // Nexa Data Users
  { email: 'rmaiello@nexadata.it', password: '123456789_1' },
  { email: 'alomonaco@nexadata.it', password: 'Password123!' },
  { email: 'chuang@nexadata.it', password: 'Password123!' },
  { email: 'adompe@nexadata.it', password: 'Password123!' },
  { email: 'fvalentini@nexadata.it', password: 'Password123!' },
  { email: 'fcifaldi@nexadata.it', password: 'Password123!' },
  { email: 'ptirelli@nexadata.it', password: 'Password123!' },
  { email: 'acutolo@nexadata.it', password: 'Password123!' },
  { email: 'tromano@nexadata.it', password: 'Password123!' },
  { email: 'mlamacchia@nexadata.it', password: 'Password123!' },
  { email: 'mcarnevale@nexadata.it', password: 'Password123!' },
  { email: 'screscenzi@nexadata.it', password: 'Password123!' },
  { email: 'rortenzi@nexadata.it', password: 'Password123!' },
  { email: 'kpiatek@nexadata.it', password: 'Password123!' },
  { email: 'juddin@nexadata.it', password: 'Password123!' },
  { email: 'acapozi@nexadata.it', password: 'Password123!' },
  { email: 'dsimone@nexadata.it', password: 'Password123!' },
  { email: 'cmiraglia@nexadata.it', password: 'Password123!' },
  { email: 'cabdelmessih@nexadata.it', password: 'Password123!' },
];

async function setPasswords() {
  console.log('🔐 Impostazione password di test...\n');

  for (const user of testUsers) {
    try {
      // Hash della password con bcrypt (salt round 10)
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Aggiorna nel database
      const result = await prisma.tenant_users.updateMany({
        where: { email: user.email },
        data: {
          password: hashedPassword,
          force_password_change: false
        }
      });

      if (result.count > 0) {
        console.log(`✅ ${user.email} -> password impostata`);
      } else {
        console.log(`⚠️  ${user.email} -> utente non trovato nel DB`);
      }
    } catch (error) {
      console.error(`❌ ${user.email} -> errore: ${error.message}`);
    }
  }

  console.log('\n✅ Completato!');
}

setPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
