const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired } = require('../middleware/auth');
const { resolveCountryContext } = require('../middleware/context');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /admin/devices?country=HR&model=Galaxy%20Trifold%207&status=ON_LOAN
 * Napomena: tvoja schema ima Device.country kao String? — filtriramo po code stringu
 */
router.get('/admin/devices', authRequired, async (req, res) => {
  try {
    const ctx = await resolveCountryContext(req);
    const model = (req.query.model || '').trim();
    const status = (req.query.status || '').trim();

    const where = {};
    if (ctx.code) where.country = ctx.code; // SUPERADMIN s ?country → filtriraj code
    if (!ctx.code && ctx.countryId) {
      // ako CA: prepoznaj code preko countryId
      const c = await prisma.country.findUnique({ where: { id: ctx.countryId } });
      if (c?.code) where.country = c.code;
    }
    if (model) where.model = { contains: model, mode: 'insensitive' };
    if (status) where.status = status;

    const list = await prisma.device.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, imei: true, serial: true, model: true, status: true, country: true, createdAt: true, updatedAt: true },
    });
    res.json(list);
  } catch (e) {
    console.error('GET /admin/devices error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /admin/loans?country=HR&model=Galaxy%20Trifold%207
 * vraća posudbe + osobu (ako postoji)
 */
router.get('/admin/loans', authRequired, async (req, res) => {
  try {
    const ctx = await resolveCountryContext(req);
    const model = (req.query.model || '').trim();

    // prvo nađi uređaje (po zemlji i modelu), pa loan-ove za njih
    const devWhere = {};
    if (ctx.code) devWhere.country = ctx.code;
    if (!ctx.code && ctx.countryId) {
      const c = await prisma.country.findUnique({ where: { id: ctx.countryId } });
      if (c?.code) devWhere.country = c.code;
    }
    if (model) devWhere.model = { contains: model, mode: 'insensitive' };

    const devices = await prisma.device.findMany({ where: devWhere, select: { id: true, model: true } });
    const deviceIds = devices.map(d => d.id);
    if (deviceIds.length === 0) return res.json([]);

    const loans = await prisma.loan.findMany({
      where: { deviceId: { in: deviceIds } },
      orderBy: [{ returnedAt: 'asc' }, { issuedAt: 'desc' }],
      select: {
        id: true, deviceId: true, issuedAt: true, returnedAt: true, notes: true,
        user: { select: { id: true, email: true, name: true, role: true, countryId: true } },
        device: { select: { model: true, serial: true, imei: true } },
      },
    });

    res.json(loans);
  } catch (e) {
    console.error('GET /admin/loans error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
