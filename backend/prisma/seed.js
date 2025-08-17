const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1) Countries (HR, SI, RS)
  const [hr, si, rs] = await Promise.all([
    prisma.country.upsert({ where: { code: 'HR' }, update: {}, create: { code: 'HR' } }),
    prisma.country.upsert({ where: { code: 'SI' }, update: {}, create: { code: 'SI' } }),
    prisma.country.upsert({ where: { code: 'RS' }, update: {}, create: { code: 'RS' } }),
  ]);

  // 2) Passwords
  const superHash = bcrypt.hashSync('superuser!123', 12);
  const caHash     = bcrypt.hashSync('ChangeMe123!', 12);

  // 3) Users (lowercase role nazivi!)
  await prisma.user.upsert({
    where: { email: 't.martinovic@mpg.hr' },
    update: { passwordHash: superHash, role: 'superadmin' },
    create: { email: 't.martinovic@mpg.hr', passwordHash: superHash, role: 'superadmin' },
  });

  await prisma.user.upsert({
    where: { email: 'hr.admin@system.local' },
    update: { passwordHash: caHash, role: 'country_admin', countryId: hr.id },
    create: { email: 'hr.admin@system.local', passwordHash: caHash, role: 'country_admin', countryId: hr.id },
  });

  await prisma.user.upsert({
    where: { email: 'si.admin@system.local' },
    update: { passwordHash: caHash, role: 'country_admin', countryId: si.id },
    create: { email: 'si.admin@system.local', passwordHash: caHash, role: 'country_admin', countryId: si.id },
  });

  await prisma.user.upsert({
    where: { email: 'rs.admin@system.local' },
    update: { passwordHash: caHash, role: 'country_admin', countryId: rs.id },
    create: { email: 'rs.admin@system.local', passwordHash: caHash, role: 'country_admin', countryId: rs.id },
  });

  console.log('✅ Seed done: superadmin + country_admins');
}

main().catch((e) => {
  console.error('❌ Seed error:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
    where: { email: "adminhr@mpg.hr" },
    update: {},
    create: {
      email: "adminhr@mpg.hr",
      passwordHash: passwordHashAdmins,
      role: "country_admin",
      countryId: hr.id, // HR
    },
  });

  await prisma.user.upsert({
    where: { email: "adminsi@mpg.si" },
    update: {},
    create: {
      email: "adminsi@mpg.si",
      passwordHash: passwordHashAdmins,
      role: "country_admin",
      countryId: si.id, // SI
    },
  });

  await prisma.user.upsert({
    where: { email: "adminrs@mpg.rs" },
    update: {},
    create: {
      email: "adminrs@mpg.rs",
      passwordHash: passwordHashAdmins,
      role: "country_admin",
      countryId: rs.id, // RS
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
