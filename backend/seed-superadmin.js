const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 't.martinovic@mpg.hr';
  const password = process.env.SUPERADMIN_PASSWORD || 'superuser1';
  const passwordHash = bcrypt.hashSync(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'SUPERADMIN' },
    create: { email, passwordHash, role: 'SUPERADMIN' }, // id će se generirati (cuid)
  });

  console.log('✅ Superadmin upsertan:', email);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Seed error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
