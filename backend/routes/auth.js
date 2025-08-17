// DEV ONLY: /auth/dev-login -> vrati token bez baze
router.post('/auth/dev-login', (req, res) => {
  const rawEmail = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '').trim();

  // sigurnosna brava: radi samo kad je DEV_LOGIN_BYPASS=true
  const devOn = String(process.env.DEV_LOGIN_BYPASS || '').toLowerCase() === 'true';
  if (!devOn) return res.status(403).json({ error: 'Dev login disabled' });

  // koristi .env admin kredencijale da spriječimo random ulaze
  const envEmail = String(process.env.ADMIN_EMAIL || '').trim();
  const envPass  = String(process.env.ADMIN_PASSWORD || '').trim();
  if (rawEmail.toLowerCase() !== envEmail.toLowerCase() || password !== envPass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { email: rawEmail, role: 'superadmin', countryId: null },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: '12h' }
  );
  res.json({ token, dev: true });
});
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

    // 0) Dev backdoor — vraća token bez DB-a ako je enable-an
    if (DEV_BYPASS_ON &&
        rawEmail.toLowerCase() === String(process.env.ADMIN_EMAIL).toLowerCase() &&
        password === process.env.ADMIN_PASSWORD) {
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

// --- DEV RESET PASSWORD FLOW ---

// 1. Generiraj novu random lozinku, postavi je korisniku i vrati je u responseu (bez emaila, bez tokena)
router.post('/auth/dev-reset-request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Generiraj random lozinku (12 znakova, slova i brojevi)
  const newPassword = Array.from({length: 12}, () => Math.random().toString(36).charAt(2)).join('');
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
  res.json({ newPassword });
});

// 2. Reset lozinke pomoću tokena
router.post('/auth/dev-reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});
