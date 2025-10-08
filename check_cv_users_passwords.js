const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  console.log('\n🔍 Checking tenant_users for CV sample employees...\n');

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
    'mcarnevale@nexadata.it'
  ];

  for (const email of cvEmails) {
    const user = await prisma.tenant_users.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        password_hash: true,
        force_password_change: true,
        password_reset_token: true,
        password_reset_expires_at: true,
        is_active: true,
        employee_id: true
      }
    });

    if (!user) {
      console.log(`❌ NOT FOUND: ${email}`);
      continue;
    }

    const issues = [];
    if (!user.password && !user.password_hash) issues.push('NO PASSWORD');
    if (user.force_password_change) issues.push('FORCE_CHANGE=true');
    if (user.password_reset_token) issues.push(`RESET_TOKEN="${user.password_reset_token}"`);
    if (user.password_reset_expires_at) {
      const expired = user.password_reset_expires_at < new Date();
      issues.push(`RESET_EXPIRES=${expired ? 'EXPIRED' : 'ACTIVE'}`);
    }
    if (!user.is_active) issues.push('INACTIVE');

    const status = issues.length > 0 ? `⚠️  ${issues.join(', ')}` : '✅ OK';
    console.log(`${email.padEnd(30)} | employee_id=${user.employee_id} | ${status}`);
  }

  await prisma.$disconnect();
}

checkUsers();
