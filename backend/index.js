// ===== helper: provjeri da user smije raditi nad :code =====
async function ensureCountryAccess(req, res, next) {
  const code = String(req.params.code || '').toUpperCase();
  if (!code) return res.status(400).json({ error: 'Missing country code' });

  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'SUPERADMIN') { req.countryCode = code; return next(); }

  // country_admin: mora odgovarati njegovoj zemlji
  const user = await prisma.user.findUnique({ where: { id: Number(req.user.id || req.user.sub) } });
  if (!user || !user.countryId) return res.status(403).json({ error: 'Forbidden' });

  const c = await prisma.country.findUnique({ where: { id: user.countryId } });
  if (!c || c.code !== code) return res.status(403).json({ error: 'Forbidden' });

  req.countryCode = code;
  next();
}
// ===== Devices: UPDATE (PATCH) =====
app.patch('/admin/devices/:code/:serial', requireAuth, requireRole('country_admin','superadmin'), ensureCountryAccess, async (req, res) => {
  const code = req.countryCode;
  const serial = String(req.params.serial || '').trim();
  if (!serial) return res.status(400).json({ error: 'Missing serial' });

  // Dozvoljena polja za update (dodaj po potrebi):
  const {
    model, purpose, ownership, imei, control_no, color,
    status, name, lead_id, location, city, comment,
    date_assigned, expected_return, date_last_change
  } = req.body || {};

  // Business pravila za status:
  const S = String(status || '').toUpperCase();
  if (S) {
    if (S === 'AVAILABLE') {
      // auto: MPG Office ako nije zadano
      if (!location) req.body.location = 'MPG Office';
    } else if (S === 'LOAN') {
      if (!name || !city) return res.status(400).json({ error: 'For LOAN, "name" and "city" are required' });
    } else if (S === 'GALAXYTRY') {
      if (!lead_id) return res.status(400).json({ error: 'For GALAXYTRY, "lead_id" is required' });
    }
  }

  // Gradimo SET dio dinamički da ne prepisujemo s null ako polje nije poslano
  const fields = [];
  const vals = [];
  function setCol(col, val) {
    if (val !== undefined) { fields.push(`${col} = $${fields.length + 1}`); vals.push(val); }
  }
  setCol('model', model);
  setCol('purpose', purpose);
  setCol('ownership', ownership);
  setCol('imei', imei);
  setCol('control_no', control_no);
  setCol('color', color);
  setCol('status', status);
  setCol('name', name);
  setCol('leadid', lead_id);
  setCol('location', location);
  setCol('city', city);
  setCol('comment', comment);
  setCol('date_assigned', date_assigned);
  setCol('expected_return', expected_return);
  setCol('date_last_change', date_last_change);

  if (!fields.length) return res.json({ updated: 0 });

  const sql = `
    UPDATE devices_import
    SET ${fields.join(', ')}
    WHERE country_code = $${fields.length + 1} AND serial_number = $${fields.length + 2}
    RETURNING *`;
  vals.push(code, serial);

  try {
    const rows = await prisma.$queryRawUnsafe(sql, ...vals);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ updated: 1, item: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ===== Devices: CREATE (POST) =====
app.post('/admin/devices/:code', requireAuth, requireRole('country_admin','superadmin'), ensureCountryAccess, async (req, res) => {
  const code = req.countryCode;
  const { model, purpose, ownership, serial_number, imei, control_no, color, status, location, city, name, lead_id, comment } = req.body || {};
  if (!serial_number) return res.status(400).json({ error: 'serial_number is required' });

  try {
    const sql = `
      INSERT INTO devices_import(
        country_code, model, purpose, ownership, serial_number, imei, control_no, color, status, location, city, name, leadid, comment
      )
      VALUES($1,$2,$3,$4,$5,COALESCE($6,''),$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (serial_number) DO UPDATE SET
        model=EXCLUDED.model, purpose=EXCLUDED.purpose, ownership=EXCLUDED.ownership,
        imei=EXCLUDED.imei, control_no=EXCLUDED.control_no, color=EXCLUDED.color,
        status=EXCLUDED.status, location=EXCLUDED.location, city=EXCLUDED.city,
        name=EXCLUDED.name, leadid=EXCLUDED.leadid, comment=EXCLUDED.comment
      RETURNING *`;
    const vals = [code, model, purpose, ownership, serial_number, imei, control_no, color, status, location, city, name, lead_id, comment];
    const rows = await prisma.$queryRawUnsafe(sql, ...vals);
    res.json({ upserted: 1, item: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Create failed' });
  }
});

// ===== Galaxy Try: UPDATE (PATCH) =====
app.patch('/admin/galaxy-try/:code/:id', requireAuth, requireRole('country_admin','superadmin'), ensureCountryAccess, async (req, res) => {
  const code = req.countryCode;
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing submission id' });

  // Dozvoljena polja:
  const {
    first_name, last_name, email, phone, address, city, postal_code,
    date_contacted, date_handover, model, serial_number, note
  } = req.body || {};

  const fields = [];
  const vals = [];
  function setCol(col, val) { if (val !== undefined) { fields.push(`${col} = $${fields.length + 1}`); vals.push(val); } }

  setCol('first_name', first_name);
  setCol('last_name', last_name);
  setCol('email', email);
  setCol('phone', phone);
  setCol('address', address);
  setCol('city', city);
  setCol('postal_code', postal_code);
  setCol('date_contacted', date_contacted);
  setCol('date_handover', date_handover);
  setCol('model', model);
  setCol('serial_number', serial_number);
  setCol('note', note);

  if (!fields.length) return res.json({ updated: 0 });

  const sql = `
    UPDATE leads_import
    SET ${fields.join(', ')}
    WHERE country_code = $${fields.length + 1} AND submission_id = $${fields.length + 2}
    RETURNING *`;
  vals.push(code, id);

  try {
    const rows = await prisma.$queryRawUnsafe(sql, ...vals);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ updated: 1, item: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ===== Galaxy Try: CREATE (POST) =====
app.post('/admin/galaxy-try/:code', requireAuth, requireRole('country_admin','superadmin'), ensureCountryAccess, async (req, res) => {
  const code = req.countryCode;
  const { submission_id, first_name, last_name, email, phone, address, city, postal_code, pickup_city, consent, date_contacted, date_handover, model, serial_number, note, form_name } = req.body || {};
  if (!submission_id) return res.status(400).json({ error: 'submission_id is required' });

  try {
    const sql = `
      INSERT INTO leads_import(
        country_code, submission_id, first_name, last_name, email, phone, address, city, postal_code, pickup_city, consent, date_contacted, date_handover, model, serial_number, note, form_name
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (submission_id) DO UPDATE SET
        first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, email=EXCLUDED.email, phone=EXCLUDED.phone,
        address=EXCLUDED.address, city=EXCLUDED.city, postal_code=EXCLUDED.postal_code, pickup_city=EXCLUDED.pickup_city,
        consent=EXCLUDED.consent, date_contacted=COALESCE(EXCLUDED.date_contacted, leads_import.date_contacted),
        date_handover=COALESCE(EXCLUDED.date_handover, leads_import.date_handover),
        model=COALESCE(EXCLUDED.model, leads_import.model),
        serial_number=COALESCE(EXCLUDED.serial_number, leads_import.serial_number),
        note=EXCLUDED.note, form_name=EXCLUDED.form_name
      RETURNING *`;
    const vals = [code, submission_id, first_name, last_name, email, phone, address, city, postal_code, pickup_city, consent, date_contacted, date_handover, model, serial_number, note, form_name];
    const rows = await prisma.$queryRawUnsafe(sql, ...vals);
    res.json({ upserted: 1, item: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Create failed' });
  }
});
// index.js – poredano da se app prvo inicijalizira

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS: whitelist iz .env CORS_ORIGINS="a,b,c"
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

const prisma = new PrismaClient();

// ===== Helpers =====
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
      const userRole = String(req.user?.role || "").toUpperCase();
      if (!userRole || !allowed.includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    };
  }

// ===== Health =====
app.get('/', (_req, res) => res.send({ status: 'OK', message: 'Try Buy Backend API running' }));
app.get('/healthz', (_req, res) => res.status(200).send({ status: 'healthy' }));

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
