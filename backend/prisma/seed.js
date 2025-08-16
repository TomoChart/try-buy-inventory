import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1) Države — upsert po unique code
  const hr = await prisma.country.upsert({
    where: { code: "HR" },
    update: {},
    create: { code: "HR" },
  });
  console.log("HR country:", hr);
  const si = await prisma.country.upsert({
    where: { code: "SI" },
    update: {},
    create: { code: "SI" },
  });
  console.log("SI country:", si);
  const rs = await prisma.country.upsert({
    where: { code: "RS" },
    update: {},
    create: { code: "RS" },
  });
  console.log("RS country:", rs);

  // 2) Hash lozinki
  const passwordHashSuper = await bcrypt.hash("superuser!123", 12);
  const passwordHashCA = await bcrypt.hash("ChangeMe123!", 12);

  // 3) Korisnici — upsert po unique email
  await prisma.user.upsert({
    where: { email: "t.martinovic@mpg.hr" },
    update: {},
    create: { email: "t.martinovic@mpg.hr", passwordHash: passwordHashSuper, role: "superadmin" },
  });

  await prisma.user.upsert({
    where: { email: "hr.admin@system.local" },
    update: {},
    create: { email: "hr.admin@system.local", passwordHash: passwordHashCA, role: "country_admin", countryId: hr.id },
  });

  await prisma.user.upsert({
    where: { email: "si.admin@system.local" },
    update: {},
    create: { email: "si.admin@system.local", passwordHash: passwordHashCA, role: "country_admin", countryId: si.id },
  });

  await prisma.user.upsert({
    where: { email: "rs.admin@system.local" },
    update: {},
    create: { email: "rs.admin@system.local", passwordHash: passwordHashCA, role: "country_admin", countryId: rs.id },
  });

  // --- NOVO: country admin korisnici po zemlji ---
  const adminPassword = "adminxy123!";
  const passwordHashAdmins = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
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
