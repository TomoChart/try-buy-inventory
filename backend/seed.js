// seed.js (CommonJS) — radi s "type" bez ESM-a
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function ensureCountry(code) {
  return prisma.country.upsert({
    where: { code },
    update: {},
    create: { code },
  });
}

async function ensureUser({ email, password, role, countryCode = null }) {
  const passwordHash = bcrypt.hashSync(password, 12);

  let countryId = null;
  if (countryCode) {
    const c = await prisma.country.findUnique({ where: { code: countryCode } });
    countryId = c ? c.id : null;
  }

  return prisma.user.upsert({
    where: { email },                 // pretpostavka: email je unique u modelu User
    update: { passwordHash, role, countryId },
    create: {
      id: randomUUID(),               // User.id = TEXT NOT NULL → eksplicitno postavimo
      email: email.toLowerCase(),
      passwordHash,
      role,
      countryId,
    },
  });
}

async function main() {
  console.log('Seeding countries…');
  await Promise.all([ensureCountry('HR'), ensureCountry('SI'), ensureCountry('RS')]);

  console.log('Seeding users…');
  // Superadmin (po tvojoj uputi nova lozinka: superuser1)
  await ensureUser({
    email: 't.martinovic@mpg.hr',
    password: process.env.SUPERADMIN_PASSWORD || 'superuser1',
    role: 'SUPERADMIN',
  });

  // Country admini (po potrebi prilagodi domene/role)
  await ensureUser({
    email: 'adminhr@mpg.hr',
    password: process.env.DEFAULT_ADMIN_PASS || 'adminxy123!',
    role: 'COUNTRY_ADMIN',
    countryCode: 'HR',
  });
  await ensureUser({
    email: 'adminsi@mpg.si',
    password: process.env.DEFAULT_ADMIN_PASS || 'adminxy123!',
    role: 'COUNTRY_ADMIN',
    countryCode: 'SI',
  });
  await ensureUser({
    email: 'adminrs@mpg.rs',
    password: process.env.DEFAULT_ADMIN_PASS || 'adminxy123!',
    role: 'COUNTRY_ADMIN',
    countryCode: 'RS',
  });

  console.log('Seed complete ✅');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
