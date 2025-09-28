/**
 * Script per creare un utente super admin di test
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    const email = 'superadmin@test.com';
    const password = 'Test123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Controlla se esiste già
    const existing = await prisma.tenant_users.findFirst({
      where: { email }
    });

    if (existing) {
      console.log('⚠️  Utente già esistente:', email);
      console.log('Password:', password);
      return;
    }

    // Crea l'utente
    const user = await prisma.tenant_users.create({
      data: {
        id: uuidv4(),
        email: email,
        password_hash: hashedPassword,
        role: 'super_admin',
        is_active: true,
        tenant_id: 'bec3cb9d-173e-4790-aaa0-98d7aa7ea387', // ID del tenant esistente
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log('✅ Super Admin creato con successo!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('ID:', user.id);

  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();