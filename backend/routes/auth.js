
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

function normRole(r) {
  return String(r || '').toLowerCase(); // 'superadmin' | 'country_admin'
}

// /auth/login
router.post('/login', async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    // 1) Dev backdoor (isključivo ako je postavljeno u .env)
    if (process.env.DEV_LOGIN_BYPASS === 'true' &&
        rawEmail === process.env.ADMIN_EMAIL &&
        password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(
        { email: rawEmail, role: 'superadmin' },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );
      return res.json({ token });
    }

    // 2) Case-insensitive lookup (Prisma)
    const email = rawEmail.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, passwordHash: true, role: true, countryId: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: normRole(user.role), countryId: user.countryId ?? null },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Auth error' });
  }
});

module.exports = router;
