const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function ensureCountry(code) {
  return prisma.country.upsert({
    where: { code },
    update: {},
    create: { code },
  });
}

async function upsertAdmin(email, password, countryCode) {
  const passwordHash = bcrypt.hashSync(password, 12);
  const country = await prisma.country.findUnique({ where: { code: countryCode } });

  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'COUNTRY_ADMIN', countryId: country?.id ?? null },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      role: 'COUNTRY_ADMIN',
      countryId: country?.id ?? null,
    },
  });
}

async function main() {
  // Countries
  await Promise.all([ensureCountry('HR'), ensureCountry('SI'), ensureCountry('RS')]);

  // Admins (lozinka možeš promijeniti kroz ENV)
  const adminPass = process.env.DEFAULT_ADMIN_PASS || 'adminxy123!';

  await upsertAdmin('adminhr@mpg.hr', adminPass, 'HR');
  await upsertAdmin('adminsi@mpg.si', adminPass, 'SI');
  await upsertAdmin('adminrs@mpg.rs', adminPass, 'RS');

  console.log('✅ Country admini upsertani');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Seed error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
