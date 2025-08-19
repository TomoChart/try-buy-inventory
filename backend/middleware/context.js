const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resolveCountryContext(req) {
  // 1) SUPERADMIN može zadati zemlju putem ?country=HR ili headera
  const requestedCode = (req.query.country || req.headers['x-admin-country'] || '').toUpperCase().trim();

  if (req.user?.role === 'SUPERADMIN' && requestedCode) {
    // za Users koristimo countryId (FK), za Devices koristit ćemo code string
    const c = await prisma.country.findUnique({ where: { code: requestedCode } });
    return { mode: 'superadmin', code: requestedCode, countryId: c?.id ?? null };
  }

  // 2) Country admin / operator – zaključani na svoju zemlju
  return { mode: 'own', code: null, countryId: req.user?.countryId ?? null };
}

module.exports = { resolveCountryContext, prisma };
