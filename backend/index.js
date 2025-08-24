
// 1) require & init
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 2) CORS
const allowed = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : [];

app.use(cors({
  origin(origin, cb) {
    console.log('CORS_ORIGINS:', allowed, 'Origin:', origin);
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());

// 3) prisma, helpers, auth middleware
const prisma = new PrismaClient();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, countryId: user.countryId ?? null },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function requireRole(...roles) {
  const allowed = roles.map(r => String(r).toUpperCase());
  return (req, res, next) => {
    const userRole = String(req.user?.role || '').toUpperCase();
    if (!userRole || !allowed.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
async function ensureCountryAccess(req, res, next) {
  const code = String(req.params.code || '').toUpperCase();
  if (!code) return res.status(400).json({ error: 'Missing country code' });

  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'SUPERADMIN') { req.countryCode = code; return next(); }

  const user = await prisma.user.findUnique({ where: { id: Number(req.user.id || req.user.sub) } });
  if (!user || !user.countryId) return res.status(403).json({ error: 'Forbidden' });

  const c = await prisma.country.findUnique({ where: { id: user.countryId } });
  if (!c || c.code !== code) return res.status(403).json({ error: 'Forbidden' });

  req.countryCode = code;
  next();
}

// 4) health rute
app.get('/',  (_req,res)=>res.send({status:'OK'}));
app.get('/healthz', (_req,res)=>res.status(200).send({status:'healthy'}));

// 5) SVE ostale rute (devices, galaxy-try, users, …) TEK SADA:


// ===== Auth =====
app.post('/auth/login', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password ?? '';
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Server misconfigured' });

    const token = jwt.sign(
      { sub: user.id, role: user.role, countryId: user.countryId ?? null },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.json({ token });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ===== Users =====
app.get('/users', requireAuth, requireRole('superadmin','country_admin'), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  res.json(users);
});
app.post('/users', requireAuth, requireRole('superadmin','country_admin'), async (req, res) => {
  const { email, password, role, countryId } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({ data: { email, passwordHash, role, countryId: countryId ?? null } });
  res.json(created);
});
app.patch('/users/:id', requireAuth, requireRole('superadmin','country_admin'), async (req, res) => {
  const id = Number(req.params.id);
  const data = { ...req.body };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 12);
    delete data.password;
  }
  const updated = await prisma.user.update({ where: { id }, data });
  res.json(updated);
});
app.delete('/users/:id', requireAuth, requireRole('superadmin','country_admin'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

// ===== Countries =====
app.get('/countries', async (_req, res) => {
  try {
    const countries = await prisma.country.findMany({ select: { id:true, code:true }, orderBy: { code:'asc' } });
    res.json(countries);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// ===== HR DEVICES & GALAXY TRY (DB view-ovi) =====
app.get('/admin/devices/hr/list', requireAuth, requireRole('country_admin','superadmin'), async (_req,res) => {
  const rows = await prisma.$queryRaw`SELECT * FROM ui_devices_hr_list ORDER BY "Model" ASC, "Status" ASC`;
  res.json(rows);
});
app.get('/admin/devices/hr/:serial', requireAuth, requireRole('country_admin','superadmin'), async (req,res) => {
  const q = 'SELECT * FROM ui_devices_hr_detail WHERE serial_number = $1';
  const r = await prisma.$queryRawUnsafe(q, req.params.serial);
  if (!r.length) return res.status(404).json({ error:'Not found' });
  res.json(r[0]);
});
app.get('/admin/galaxy-try/hr/list', requireAuth, requireRole('country_admin','superadmin'), async (_req,res) => {
  const rows = await prisma.$queryRaw`SELECT * FROM ui_galaxytry_hr_list ORDER BY "Datum prijave" DESC NULLS LAST`;
  res.json(rows);
});
app.get('/admin/galaxy-try/hr/:id', requireAuth, requireRole('country_admin','superadmin'), async (req,res) => {
  const q = 'SELECT * FROM ui_galaxytry_hr_detail WHERE submission_id = $1';
  const r = await prisma.$queryRawUnsafe(q, req.params.id);
  if (!r.length) return res.status(404).json({ error:'Not found' });
  res.json(r[0]);
});

// ===== Demo /stats i /devices (ostavi ako ih koristiš) =====
const demoDevices = [
  { id:1, imei:'356789012345671', model:'Galaxy Fold7', status:'active', location:'Zagreb',   countryCode:'HR', updatedAt:new Date().toISOString() },
  { id:2, imei:'356789012345672', model:'Galaxy Fold7', status:'inactive', location:'Split',    countryCode:'HR', updatedAt:new Date().toISOString() },
  { id:3, imei:'356789012345673', model:'Galaxy S24',   status:'active', location:'Ljubljana',countryCode:'SI', updatedAt:new Date().toISOString() },
  // ...
];
const countryCache = new Map();
async function getCountryByCode(code) {
  const key = String(code||'').toUpperCase();
  if (!key) return null;
  if (countryCache.has(key)) return countryCache.get(key);
  const c = await prisma.country.findUnique({ where: { code:key } });
  if (c) countryCache.set(key, c);
  return c;
}
app.get('/stats', async (req,res) => {
  try {
    const code = String(req.query.code||'').toUpperCase();
    const c = await getCountryByCode(code);
    if (!c) return res.status(400).json({ error:'Unknown country code' });
    const users = await prisma.user.count({ where:{ countryId:c.id } });
    const devicesActive = demoDevices.filter(d => d.countryCode===code && d.status==='active').length;
    res.json({ country:{ id:c.id, code:c.code }, kpi:{ devicesActive, tryAndBuyActive:0, galaxyTryActivations:0, users } });
  } catch(e){ console.error(e); res.status(500).json({ error:'Failed to load stats' }); }
});
app.get('/devices', async (req,res) => {
  try {
    const code = String(req.query.code||'').toUpperCase();
    const c = await getCountryByCode(code);
    if (!c) return res.status(400).json({ error:'Unknown country code' });
    const page = Math.max(1, parseInt(req.query.page||'1',10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize||'10',10)));
    const search = String(req.query.search||'').toLowerCase();
    let rows = demoDevices.filter(d => d.countryCode===code);
    if (search) rows = rows.filter(d => d.imei.toLowerCase().includes(search) || d.model.toLowerCase().includes(search) || d.location.toLowerCase().includes(search));
    const total = rows.length, start = (page-1)*pageSize, items = rows.slice(start, start+pageSize);
    res.json({ total, page, pageSize, items });
  } catch(e){ console.error(e); res.status(500).json({ error:'Failed to load devices' }); }
});

// ===== Router moduli (ako ih koristiš) =====
// ⚠️ Ako koristiš inline rute iznad, NEMOJ dodatno mountati admin.hr da ne duplicira putanje.
// const adminHrRouter = require('./routes/admin.hr');
// app.use('/api', adminHrRouter);

const adminUsersRouter = require('./routes/adminUsers');
app.use(adminUsersRouter);

// ===== Listen =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
