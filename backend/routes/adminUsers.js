const express = require('express');
const bcrypt = require('bcryptjs');
const { authRequired } = require('../middleware/auth');
const { isSuperadmin, isCountryAdmin, requireSuperadmin, allowedCreateRole } = require('../middleware/rbac');
const { resolveCountryContext } = require('../middleware/context');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// GET /admin/users  (SUPERADMIN može ?country=HR; CA dobiva samo svoju)
router.get('/admin/users', authRequired, async (req, res) => {
  try {
    const ctx = await resolveCountryContext(req);
    let where = {};

    if (isCountryAdmin(req.user)) {
      where = { countryId: ctx.countryId ?? undefined };
    } else if (isSuperadmin(req.user)) {
      // SUPERADMIN bez ?country vidi sve; s ?country filtrira
      if (ctx.countryId) where = { countryId: ctx.countryId };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, role: true, countryId: true, createdAt: true, updatedAt: true, name: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (e) {
    console.error('GET /admin/users error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/users  { email, password, role, countryCode? }
router.post('/admin/users', authRequired, async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    const desiredRole = (req.body?.role || 'OPERATOR').toUpperCase();
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    if (!allowedCreateRole(req.user, desiredRole)) return res.status(403).json({ error: 'Forbidden: role not allowed' });

    const ctx = await resolveCountryContext(req);

    // countryId određujemo ovako:
    // - CA: uvijek njegova zemlja (ctx.countryId)
    // - SUPERADMIN: ako je poslao body.countryCode → koristimo to; inače, ako je u query-ju birao ?country, koristimo ctx.countryId; fallback null
    let countryId = ctx.countryId ?? null;
    if (isSuperadmin(req.user)) {
      const bodyCode = (req.body?.countryCode || '').toUpperCase().trim();
      if (bodyCode) {
        const c = await prisma.country.findUnique({ where: { code: bodyCode } });
        countryId = c?.id ?? null;
      }
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: desiredRole, countryId },
      select: { id: true, email: true, role: true, countryId: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Email already exists' });
    console.error('POST /admin/users error', e);
    res.status(500).json({ error: 'Server error' });
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
