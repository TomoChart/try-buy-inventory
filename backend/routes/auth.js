// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

function normRole(r) {
  return String(r || '').toLowerCase(); // 'superadmin' | 'country_admin' | sl.
}

// DEV bypass (samo za razvoj; isključi u produkciji)
const DEV_BYPASS_ON =
  process.env.DEV_LOGIN_BYPASS === 'true' &&
  process.env.ADMIN_EMAIL &&
  process.env.ADMIN_PASSWORD &&
  process.env.JWT_SECRET;

router.post('/auth/login', async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const envEmail = String(process.env.ADMIN_EMAIL || '').trim();
    const envPass  = String(process.env.ADMIN_PASSWORD || '').trim();
    const devOn    = String(process.env.DEV_LOGIN_BYPASS || '').toLowerCase() === 'true';

    // DEV bypass (omogućuje ulaz odmah, dok ne dovršimo DB/seed)
    if (devOn &&
        rawEmail.toLowerCase() === envEmail.toLowerCase() &&
        password === envPass) {
      console.log('[DEV_LOGIN_BYPASS] OK for', rawEmail);
      const token = jwt.sign(
        { email: rawEmail, role: 'superadmin', countryId: null },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );
      return res.json({ token });
    }

    // 1) Case-insensitive lookup (Prisma)
    const user = await prisma.user.findFirst({
      where: { email: { equals: rawEmail, mode: 'insensitive' } },
      select: { id: true, email: true, passwordHash: true, role: true, countryId: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2) Bcrypt compare
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3) JWT
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: normRole(user.role), countryId: user.countryId ?? null },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.json({ token });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Auth error' });
  }
});

module.exports = router;
