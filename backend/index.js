// === GALAXY TRY: EDIT (PATCH) po submission_id i country code ===
// Dozvoljena polja: first_name, last_name, email, phone, address, city,
// pickup_city, date_contacted, date_handover, model, serial_number, note
app.patch('/admin/galaxy-try/:code/:submission_id',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const sid  = String(req.params.submission_id || '');
      if (!['HR','SI','RS'].includes(code) || !sid) {
        return res.status(400).json({ error: 'Bad request' });
      }

      const ALLOWED = new Set([
        'first_name','last_name','email','phone',
        'address','city','pickup_city',
        'date_contacted','date_handover',
        'model','serial_number','note'
      ]);

      // zadrži samo dozvoljena polja koja su poslana
      const input = {};
      for (const [k,v] of Object.entries(req.body || {})) {
        if (ALLOWED.has(k)) input[k] = v ?? null;
      }
      if (!Object.keys(input).length) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      // dinamički SET dio za UPDATE
      const cols = Object.keys(input);
      const setClauses = cols.map((c,i) => `"${c}" = $${i+1}`).join(', ');
      const params = cols.map(c => input[c]);

      // WHERE parametri
      params.push(sid);         // $N-1
      params.push(code);        // $N

      const sql = `
        UPDATE leads_import
        SET ${setClauses}, updated_at = NOW()
        WHERE submission_id = $${cols.length+1}
          AND country_code  = $${cols.length+2}
        RETURNING
          submission_id    AS "Submission ID",
          created_at       AS "Created At",
          first_name       AS "First Name",
          last_name        AS "Last Name",
          email            AS "Email",
          phone            AS "Phone",
          address          AS "Address",
          city             AS "City",
          pickup_city      AS "Pickup City",
          date_contacted   AS "Contacted At",
          date_handover    AS "Handover At",
          model            AS "Model",
          serial_number    AS "Serial Number",
          note             AS "Note"
      `;
      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('GT edit error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// === GALAXY TRY: DELETE po submission_id i country code ===
app.delete('/admin/galaxy-try/:code/:submission_id',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const sid  = String(req.params.submission_id || '');
      if (!['HR','SI','RS'].includes(code) || !sid) {
        return res.status(400).json({ error: 'Bad request' });
      }

      const sql = `
        DELETE FROM leads_import
        WHERE submission_id = $1 AND country_code = $2
        RETURNING submission_id
      `;
      const rows = await prisma.$queryRawUnsafe(sql, sid, code);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, deleted: sid });
    } catch (err) {
      console.error('GT delete error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);
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
app.get('/admin/devices/hr/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (_req, res) => {
    const rows = await prisma.$queryRaw`SELECT * FROM ui_devices_hr_list`;
    res.json(rows);
  }
);

// DETALJ (po serijskom)
app.get('/admin/devices/hr/:serial',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    const q = 'SELECT * FROM ui_devices_hr_detail WHERE serial_number=$1';
    const r = await prisma.$queryRawUnsafe(q, req.params.serial);
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  }
);
// ===== DEVICES: generičke rute za list i detail po country code =====
app.get('/admin/devices/:code/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();

      // dozvoljene zemlje i pripadni VIEW-ovi
      const VIEW_MAP = {
        HR: 'ui_devices_hr_list',
        SI: 'ui_devices_si_list',
        RS: 'ui_devices_rs_list',
      };

      const view = VIEW_MAP[code];
      if (!view) return res.status(400).json({ error: 'Unknown country code' });

      // Dinamičko ime VIEW-a mora ići preko unsafe jer je identifier, ne literal.
      // (Parametrizacija se koristi samo za vrijednosti/literale, dolje u detail ruti.)
      const sql = `SELECT * FROM ${view}`;
      const rows = await prisma.$queryRawUnsafe(sql);

      res.json(rows);
    } catch (err) {
      console.error('GET /admin/devices/:code/list error', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

app.get('/admin/devices/:code/:serial',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const serial = String(req.params.serial || '');

      const VIEW_MAP = {
        HR: 'ui_devices_hr_detail',
        SI: 'ui_devices_si_detail',
        RS: 'ui_devices_rs_detail',
      };

      const view = VIEW_MAP[code];
      if (!view) return res.status(400).json({ error: 'Unknown country code' });

      // Ime VIEW-a je dinamični identifier (unsafe), ali vrijednost ide parametrizirano.
      const sql = `SELECT * FROM ${view} WHERE serial_number = $1`;
      const rows = await prisma.$queryRawUnsafe(sql, serial);

      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error('GET /admin/devices/:code/:serial error', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GALAXY TRY LISTA HR
/*
app.get('/admin/galaxy-try/hr/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (_req, res) => {
    const rows = await prisma.$queryRaw`SELECT * FROM ui_galaxytry_hr_list`;
    res.json(rows);
  }
);
*/
// -------- PATCH: GALAXY TRY (edit po submission_id) ------------------------
// PATCH /admin/galaxy-try/:code/:id
// Body: { email?, phone?, pickup_city?, date_contacted?, date_handover?, model?, serial_number?, note? }
app.patch(
  "/admin/galaxy-try/:code/:id",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      const id = String(req.params.id || "");

      if (!code || !id) return res.status(400).json({ error: "Missing code or id" });

      // dozvoljena polja za edit
      const allowed = [
        "email",
        "phone",
        "pickup_city",
        "date_contacted",
        "date_handover",
        "model",
        "serial_number",
        "note",
      ];

      const payload = {};
      for (const k of allowed) {
        if (k in req.body) payload[k] = req.body[k];
      }
      if (!Object.keys(payload).length) {
        return res.status(400).json({ error: "No editable fields provided" });
      }

      // jednostavne validacije (po potrebi proširi)
      const isoOrNull = (v) =>
        v == null || v === "" ? null : new Date(v).toString() !== "Invalid Date" ? v : null;
      if ("date_contacted" in payload) payload.date_contacted = isoOrNull(payload.date_contacted);
      if ("date_handover" in payload) payload.date_handover = isoOrNull(payload.date_handover);

      // update preko submission_id i country_code
      const sql = `
        UPDATE leads_import
        SET
          email = COALESCE($1, email),
          phone = COALESCE($2, phone),
          pickup_city = COALESCE($3, pickup_city),
          date_contacted = COALESCE($4, date_contacted),
          date_handover = COALESCE($5, date_handover),
          model = COALESCE($6, model),
          serial_number = COALESCE($7, serial_number),
          note = COALESCE($8, note)
        WHERE submission_id = $9 AND country_code = $10
        RETURNING
          submission_id,
          email, phone, pickup_city, date_contacted, date_handover,
          model, serial_number, note
      `;

      const vals = [
        payload.email ?? null,
        payload.phone ?? null,
        payload.pickup_city ?? null,
        payload.date_contacted ?? null,
        payload.date_handover ?? null,
        payload.model ?? null,
        payload.serial_number ?? null,
        payload.note ?? null,
        id,
        code,
      ];

      const rows = await prisma.$queryRawUnsafe(sql, ...vals);
      if (!rows.length) return res.status(404).json({ error: "Not found" });

      return res.json({ ok: true, updated: rows[0] });
    } catch (e) {
      console.error("PATCH galaxy-try error", e);
      return res.status(500).json({ error: "Update failed" });
    }
  }
);
// GALAXY TRY DETALJ (po submission_id)
app.get('/admin/galaxy-try/hr/:id',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    const q = 'SELECT * FROM ui_galaxytry_hr_detail WHERE submission_id=$1';
    const r = await prisma.$queryRawUnsafe(q, req.params.id);
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  }
);

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


// -------- CSV JSON IMPORT: DEVICES -----------------------------------------
// POST /admin/devices/:code/import?mode=upsert|replace
app.post(
  "/admin/devices/:code/import",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    const mode = (String(req.query.mode || "upsert").toLowerCase());
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!rows.length) return res.status(400).json({ error: "No rows" });
    if (rows.length > 5000) return res.status(413).json({ error: "Too many rows" });

    // canonical keys we support (mapirani iz CSV-a na FE)
    const pick = (r, k) => (r[k] ?? null);
    const normalize = (r) => ({
      country_code: code,
      model:          pick(r,"model"),
      purpose:        pick(r,"purpose"),
      ownership:      pick(r,"ownership"),
      serial_number:  pick(r,"serial_number"),
      imei:           pick(r,"imei") || pick(r,"imei1"),
      control_no:     pick(r,"control_no") ?? pick(r,"control") ?? pick(r,"control_number"),
      color:          pick(r,"color"),
      status:         pick(r,"status"),
      name:           pick(r,"name"),
      leadid:         pick(r,"leadid"),
      location:       pick(r,"location"),
      city:           pick(r,"city"),
      date_assigned:  pick(r,"date_assigned"),
      expected_return:pick(r,"expected_return"),
      date_last_change:pick(r,"date_last_change"),
      comment:        pick(r,"comment"),
      submission_id:  pick(r,"submission_id"),
      leadname:       pick(r,"leadname"),
      cityfromlead:   pick(r,"cityfromlead"),
    });

    try {
      await prisma.$executeRawUnsafe("BEGIN");
      if (mode === "replace") {
        await prisma.$executeRawUnsafe(
          "DELETE FROM devices_import WHERE country_code=$1",
          code
        );
      }
      let upserted = 0;
      for (const r of rows) {
        const v = normalize(r);
        if (!v.serial_number) continue; // bez serijskog ne radimo upsert
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO devices_import
            (country_code, model, purpose, ownership, serial_number, imei, control_no, color, status, name, leadid, location, city, date_assigned, expected_return, date_last_change, comment, submission_id, leadname, cityfromlead)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          ON CONFLICT (country_code, serial_number) DO UPDATE SET
            model=EXCLUDED.model,
            purpose=EXCLUDED.purpose,
            ownership=EXCLUDED.ownership,
            imei=EXCLUDED.imei,
            control_no=EXCLUDED.control_no,
            color=EXCLUDED.color,
            status=EXCLUDED.status,
            name=EXCLUDED.name,
            leadid=EXCLUDED.leadid,
            location=EXCLUDED.location,
            city=EXCLUDED.city,
            date_assigned=EXCLUDED.date_assigned,
            expected_return=EXCLUDED.expected_return,
            date_last_change=EXCLUDED.date_last_change,
            comment=EXCLUDED.comment,
            submission_id=EXCLUDED.submission_id,
            leadname=EXCLUDED.leadname,
            cityfromlead=EXCLUDED.cityfromlead
          `,
          v.country_code, v.model, v.purpose, v.ownership, v.serial_number, v.imei, v.control_no, v.color, v.status,
          v.name, v.leadid, v.location, v.city, v.date_assigned, v.expected_return, v.date_last_change,
          v.comment, v.submission_id, v.leadname, v.cityfromlead
        );
        upserted++;
      }
      await prisma.$executeRawUnsafe("COMMIT");
      res.json({ ok: true, mode, upserted });
    } catch (e) {
      await prisma.$executeRawUnsafe("ROLLBACK");
      console.error("devices import error", e);
      res.status(500).json({ error: "Import failed" });
    }
  }
);

// -------- CSV JSON IMPORT: GALAXY TRY --------------------------------------
// POST /admin/galaxy-try/:code/import?mode=upsert|replace
app.post(
  "/admin/galaxy-try/:code/import",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    const mode = (String(req.query.mode || "upsert").toLowerCase());
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!rows.length) return res.status(400).json({ error: "No rows" });
    if (rows.length > 5000) return res.status(413).json({ error: "Too many rows" });

    const pick = (r, k) => (r[k] ?? null);
    const normalize = (r) => ({
      country_code:  code,
      submission_id: pick(r,"submission_id"),
      created_at:    pick(r,"created_at"),
      first_name:    pick(r,"first_name"),
      last_name:     pick(r,"last_name"),
      email:         pick(r,"email") ?? pick(r,"e_mail") ?? pick(r,"e_pošta"),
      phone:         pick(r,"phone"),
      address:       pick(r,"address"),
      city:          pick(r,"city"),
      postal_code:   pick(r,"postal_code") ?? pick(r,"zip"),
      pickup_city:   pick(r,"pickup_city"),
      consent:       pick(r,"consent"),
      date_contacted:pick(r,"date_contacted"),
      date_handover: pick(r,"date_handover"),
      model:         pick(r,"model"),
      serial_number: pick(r,"serial_number") ?? pick(r,"s_n"),
      note:          pick(r,"note"),
      form_name:     pick(r,"form_name"),
    });

    try {
      await prisma.$executeRawUnsafe("BEGIN");
      if (mode === "replace") {
        await prisma.$executeRawUnsafe(
          "DELETE FROM leads_import WHERE country_code=$1",
          code
        );
      }
      let upserted = 0;
      for (const r of rows) {
        const v = normalize(r);
        if (!v.submission_id) continue; // submission id je ključ
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO leads_import
            (country_code, submission_id, created_at, first_name, last_name, email, phone, address, city, postal_code, pickup_city, consent, date_contacted, date_handover, model, serial_number, note, form_name)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          ON CONFLICT (submission_id) DO UPDATE SET
            created_at=EXCLUDED.created_at,
            first_name=EXCLUDED.first_name,
            last_name=EXCLUDED.last_name,
            email=EXCLUDED.email,
            phone=EXCLUDED.phone,
            address=EXCLUDED.address,
            city=EXCLUDED.city,
            postal_code=EXCLUDED.postal_code,
            pickup_city=EXCLUDED.pickup_city,
            consent=EXCLUDED.consent,
            date_contacted=COALESCE(EXCLUDED.date_contacted, leads_import.date_contacted),
            date_handover=COALESCE(EXCLUDED.date_handover,  leads_import.date_handover),
            model=COALESCE(EXCLUDED.model,         leads_import.model),
            serial_number=COALESCE(EXCLUDED.serial_number, leads_import.serial_number),
            note=COALESCE(EXCLUDED.note,           leads_import.note),
            form_name=EXCLUDED.form_name
          `,
          v.country_code, v.submission_id, v.created_at, v.first_name, v.last_name, v.email, v.phone, v.address,
          v.city, v.postal_code, v.pickup_city, v.consent, v.date_contacted, v.date_handover, v.model, v.serial_number,
          v.note, v.form_name
        );
        upserted++;
      }
      await prisma.$executeRawUnsafe("COMMIT");
      res.json({ ok: true, mode, upserted });
    } catch (e) {
      await prisma.$executeRawUnsafe("ROLLBACK");
      console.error("galaxy-try import error", e);
      res.status(500).json({ error: "Import failed" });
    }
  }
);

// === GALAXY TRY: lista po country code (HR/SI/RS)
app.get('/admin/galaxy-try/:code/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Unknown country code' });
      }

      // Napomena:
      // - izvor je leads_import (ili odgovarajući VIEW ako ga koristiš)
      // - filtriramo po country_code
      // - vraćamo i address + city
      const sql = `
        SELECT
          submission_id    AS "Submission ID",
          created_at       AS "Created At",
          first_name       AS "First Name",
          last_name        AS "Last Name",
          email            AS "Email",
          phone            AS "Phone",
          address          AS "Address",
          city             AS "City",
          pickup_city      AS "Pickup City",
          date_contacted   AS "Contacted At",
          date_handover    AS "Handover At",
          model            AS "Model",
          serial_number    AS "Serial Number",
          note             AS "Note"
        FROM leads_import
        WHERE country_code = $1
        ORDER BY created_at DESC NULLS LAST, submission_id DESC
      `;
      const rows = await prisma.$queryRawUnsafe(sql, code);
      return res.json(rows || []);
    } catch (err) {
      console.error('GT list error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);