const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { authRequired } = require('../middleware/auth');
const { isSuperadmin, isCountryAdmin, requireSuperadmin, allowedCreateRole } = require('../middleware/rbac');

const prisma = new PrismaClient();
const router = express.Router();

// Helper: dohvati countryId po kodu (HR/SI/RS)
async function getCountryIdByCode(code) {
  if (!code) return null;
  const c = await prisma.country.findUnique({ where: { code: code } });
  return c ? c.id : null;
}

// GET /admin/users?country=HR
router.get('/admin/users', authRequired, async (req, res) => {
  try {
    const qCountry = req.query.country || null;

    // Country admin vidi samo svoju zemlju bez obzira na query
    if (isCountryAdmin(req.user)) {
      if (!req.user.countryId) return res.json([]);
      const users = await prisma.user.findMany({
        where: { countryId: req.user.countryId },
        select: { id: true, email: true, role: true, countryId: true, createdAt: true, updatedAt: true, name: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(users);
    }

    // Superadmin: može filtrirati po query ?country=HR ili sve
    let where = {};
    if (qCountry) {
      const cid = await getCountryIdByCode(qCountry);
      where = { countryId: cid ?? undefined };
    }
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, role: true, countryId: true, createdAt: true, updatedAt: true, name: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  } catch (e) {
    console.error('GET /admin/users error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/users  { email, password, role, countryCode }
router.post('/admin/users', authRequired, async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    const role = (req.body?.role || 'OPERATOR').toUpperCase();
    const countryCode = req.body?.countryCode || null;

    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    if (!allowedCreateRole(req.user, role)) return res.status(403).json({ error: 'Forbidden: role not allowed' });

    let countryId = await getCountryIdByCode(countryCode);

    // Country admin smije isključivo u svoju zemlju
    if (isCountryAdmin(req.user)) {
      if (!req.user.countryId) return res.status(403).json({ error: 'Forbidden' });
      countryId = req.user.countryId;
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role, countryId },
      select: { id: true, email: true, role: true, countryId: true, createdAt: true, updatedAt: true },
    });
    return res.status(201).json(user);
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Email already exists' });
    console.error('POST /admin/users error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/users/:id/password  { newPassword }
router.patch('/admin/users/:id/password', authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const newPassword = req.body?.newPassword || '';
    if (!newPassword) return res.status(400).json({ error: 'Missing newPassword' });

    // Pravo: superadmin svima; country admin samo u svojoj zemlji
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, countryId: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (isCountryAdmin(req.user)) {
      if (!req.user.countryId || target.countryId !== req.user.countryId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const passwordHash = bcrypt.hashSync(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /admin/users/:id/password error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/users/:id/role  { role }
router.patch('/admin/users/:id/role', authRequired, requireSuperadmin, async (req, res) => {
  try {
    const id = req.params.id;
    const role = (req.body?.role || '').toUpperCase();
    if (!role) return res.status(400).json({ error: 'Missing role' });

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true, countryId: true },
    });
    return res.json(user);
  } catch (e) {
    console.error('PATCH /admin/users/:id/role error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
