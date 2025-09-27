// 1) require & init
const express = require('express');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 2) CORS
const cors = require('cors');
const url = require('url');

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// promijeni po potrebi – prefiks tvog Vercel projekta
const VERCEL_PROJECT_PREFIX = 'try-buy-inventory';

function isAllowedVercelOrigin(origin) {
  try {
    const { host, protocol } = new url.URL(origin);
    // dozvoli samo https
    if (protocol !== 'https:') return false;
    // *.vercel.app i host koji počinje na 'try-buy-inventory'
    return host.endsWith('.vercel.app') && host.startsWith(VERCEL_PROJECT_PREFIX);
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: function (origin, callback) {
    // bez Origin zaglavlja (npr. curl/healthz) -> pusti
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || isAllowedVercelOrigin(origin)) {
      return callback(null, true);
    }
    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
const trybuyRoutes = require('./routes/trybuy');
app.use('/api/trybuy', trybuyRoutes);

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
// Zamijenjeno: /users → /adminusers
app.get('/adminusers', requireAuth, requireRole('superadmin','country_admin'), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  res.json(users);
});
app.post('/adminusers', requireAuth, requireRole('superadmin','country_admin'), async (req, res) => {
  let { email, password, role, countryId } = req.body || {};
  email = String(email || '').trim().toLowerCase();
  role = String(role || 'OPERATOR').toUpperCase();

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  if (!['OPERATOR','COUNTRY_ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Ako je caller country_admin, prisilno vežemo na njegovu zemlju
  const caller = req.user || {};
  const callerRole = String(caller.role || '').toUpperCase();
  if (callerRole === 'COUNTRY_ADMIN') {
    if (!caller.countryId) {
      return res.status(403).json({ error: 'Caller has no country bound' });
    }
    countryId = caller.countryId;
  } else {
    if (role !== 'SUPERADMIN' && !countryId) {
      return res.status(400).json({ error: 'countryId is required for non-superadmin users' });
    }
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,                 // "OPERATOR" | "COUNTRY_ADMIN"
      countryId: countryId ?? null,
    },
    select: { id: true, email: true, role: true, countryId: true, createdAt: true }
  });

  return res.status(201).json({ user: created });
});
app.patch('/adminusers/:id', requireAuth, requireRole('superadmin','country_admin'), async (req, res) => {
  const id = Number(req.params.id);
  const data = { ...req.body };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 12);
    delete data.password;
  }
  const updated = await prisma.user.update({ where: { id }, data });
  res.json(updated);
});
app.delete('/adminusers/:id', requireAuth, requireRole('superadmin','country_admin'), async (req, res) => {
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
app.patch(
  "/admin/galaxy-try/:code/:id",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      const id   = String(req.params.id || "").trim();
      if (!code || !id) return res.status(400).json({ error: "Missing code or id" });

      const raw = req.body ?? {};

      // UI -> DB mapiranja (točno prema tvojoj tablici - sve TEXT):
      const mapUiToDb = {
        submission_id: "submission_id",
        first_name:    "first_name",
        last_name:     "last_name",
        email:         "email",
        phone:         "phone",
        address:       "address",
        city:          "city",
        postal_code:   "postal_code",
        pickup_city:   "pickup_city",
        created_at:    "created_at",
        contacted:     "contacted",      // "Yes" ili ""
        handover_at:   "handover_at",
        model:         "model",
        serial:        "serial",
        note:          "note",
        user_feedback: "user_feedback",
        days_left:     "days_left",
        finished:      "finished",       // boolean u UI -> "Yes"/""
      };

      // pripremi payload (prazno -> NULL; finished boolean -> "Yes"/"")
      const payload = {};
      for (const [uiKey, dbKey] of Object.entries(mapUiToDb)) {
        if (!(uiKey in raw)) continue;
        if (uiKey === "finished" && typeof raw.finished === "boolean") {
          payload[dbKey] = raw.finished ? "Yes" : "";
        } else {
          payload[dbKey] = raw[uiKey] === "" ? null : raw[uiKey];
        }
      }

      const cols = Object.keys(payload);
      if (!cols.length) return res.status(400).json({ error: "No editable fields provided" });

      // dinamički UPDATE samo poslanih polja
      const setSql = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
      const params = cols.map(c => payload[c]);
      params.push(id, code);

      const sql = `
        UPDATE public.leads_import
           SET ${setSql}
         WHERE submission_id = $${cols.length + 1}
           AND country_code  = $${cols.length + 2}
         RETURNING
          submission_id, country_code, first_name, last_name, email, phone, address, city, postal_code,
          pickup_city, created_at, contacted, handover_at, days_left, model, serial, note,
          user_feedback, finished
      `;

      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true, updated: rows[0] });
    } catch (e) {
      console.error("PATCH galaxy-try error", e);
      return res.status(500).json({ error: "Update failed" });
    }
  }
);
// === GALAXY TRY: EDIT (PATCH) po submission_id i country code ===
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
        'address','city','pickup_city','created_at',
        'contacted','handover_at','days_left',
        'model','serial','note','user_feedback','finished'
      ]);

         // zadrži samo dozvoljena polja koja su poslana
      const input = {};
      for (const [k,v] of Object.entries(req.body || {})) {
        if (!ALLOWED.has(k)) continue;
        if (v == null) { input[k] = null; continue; }
        if (k === 'serial') {
          const s = String(v).trim().replace(/\s+/g,'');
          input[k] = s === '' ? null : s;
        } else if (k === 'model' || k === 'note' || k === 'email' || k === 'phone' || k === 'address' || k === 'city' || k === 'pickup_city' || k === 'first_name' || k === 'last_name') {
          const s = String(v).trim();
          input[k] = s === '' ? null : s;
        } else {
          input[k] = v;
        }
      }

      if (!Object.keys(input).length) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      // === Normalize created_at ===
      if ("created_at" in input) {
        input.created_at = normalizeDateOnly(input.created_at);
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
          country_code     AS "Country Code",
          first_name       AS "First Name",
          last_name        AS "Last Name",
          email            AS "Email",
          phone            AS "Phone",
          address          AS "Address",
          city             AS "City",
          pickup_city      AS "Pickup City",
          created_at       AS "Created At",
          contacted        AS "Contacted At",
          handover_at      AS "Handover At",
          days_left       AS "Days Left",
          model            AS "Model",
          serial          AS "Serial",
          note             AS "Note",
          user_feedback   AS "User Feedback",
          finished         AS "Finished"
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

app.post('/admin/galaxy-try/:code',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Unknown country code' });
      }

      // Dozvoljena polja koja možemo upisati
      const ALLOWED = new Set([
        'first_name','last_name','email','phone',
        'address','city','pickup_city',
        'created_at','contacted','handover_at','days_left',
        'model','serial','note','user_feedback','finished'
      ]);

      const b = req.body || {};
      const payload = {};
      for (const [k,v] of Object.entries(b)) {
        if (!ALLOWED.has(k)) continue;
        if (k === 'finished' && typeof v === 'boolean') {
          payload[k] = v ? 'Yes' : '';
        } else {
          payload[k] = v ?? null;
        }
      }

      if ('finished' in payload && typeof payload.finished === 'boolean') {
        payload.finished = payload.finished ? 'Yes' : '';
      }

      // submission_id generiramo ako nije poslan
      const submission_id = String(b.submission_id || crypto.randomUUID());

      // === Normalize created_at (remove time, parse date) ===
      if (payload.created_at) {
        let dateStr = String(payload.created_at);
        if (dateStr.includes(' ')) dateStr = dateStr.split(' ')[0];      // drop time if "YYYY-MM-DD HH:MM:SS"
        else if (dateStr.includes('T')) dateStr = dateStr.split('T')[0]; // drop time if ISO string
        // If in DD-MM-YYYY format, convert to YYYY-MM-DD
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
          const [d, m, y] = dateStr.split('-');
          dateStr = `${y}-${m}-${d}`;
        }
        payload.created_at = new Date(`${dateStr}T00:00:00Z`);
      }
      // ...existing normalization for contacted, handover_at...
      if (payload.contacted) payload.contacted = new Date(payload.contacted);
      if (payload.handover_at)  payload.handover_at  = new Date(payload.handover_at);

      const cols = ['submission_id','country_code', ...Object.keys(payload)];
      const vals = [submission_id, code, ...Object.values(payload)];
      const placeholders = cols.map((_,i)=>`$${i+1}`).join(', ');

      const sql = `
        INSERT INTO leads_import (${cols.map(c=>`"${c}"`).join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (submission_id) DO UPDATE
        SET ${Object.keys(payload).map((c,i)=>`"${c}" = EXCLUDED."${c}"`).join(', ')},
            updated_at = NOW()
        RETURNING
          submission_id        AS submission_id,
          country_code         AS country_code,
          first_name           AS first_name,
          last_name            AS last_name,
          email                AS email,
          phone                AS phone,
          address              AS address,
          city                 AS city,
          pickup_city          AS pickup_city,
          created_at           AS created_at,
          contacted       AS contacted,
          handover_at        AS handover_at,
          days_left            AS days_left,
          model                AS model,
          serial               AS serial,
          note                 AS note,
          user_feedback   AS user_feedback,
          finished         AS finished
      `;
      const rows = await prisma.$queryRawUnsafe(sql, ...vals);
      return res.json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('GT create error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);
// DELETE /admin/galaxy-try/:code/:id
// Napomena: "id" tretiramo kao submission_id (string), ne kao numerički ID.
// Brisanje se radi u tablici leads_import, filtrirano po (submission_id, country_code).
app.delete(
  '/admin/galaxy-try/:code/:id',
  requireAuth,
  requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const sid  = String(req.params.id || '').trim();

      // Validacije
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Invalid country code (use HR, SI, or RS).' });
      }
      if (!sid) {
        return res.status(400).json({ error: 'Missing submission_id.' });
      }

      // Brisanje po (submission_id, country_code)
      const sql = `DELETE FROM leads_import WHERE submission_id = $1 AND country_code = $2`;
      const count = await prisma.$executeRawUnsafe(sql, sid, code);

      if (!count || Number(count) === 0) {
        return res.status(404).json({ error: 'Not found.' });
      }

      // Uspjeh: 204 No Content
      return res.status(204).send();
    } catch (err) {
      console.error('DELETE /admin/galaxy-try/:code/:id error', err);
      return res.status(500).json({ error: 'Server error.' });
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
          country_code     AS "Country Code",
          first_name       AS "First Name",
          last_name        AS "Last Name",
          email            AS "Email",
          phone            AS "Phone",
          address          AS "Address",
          city             AS "City",
          pickup_city      AS "Pickup City",
          created_at       AS "Created At",
          contacted        AS "Contacted At",
          handover_at      AS "Handover At",
          days_left        AS "Days Left",
          model            AS "Model",
          serial           AS "Serial",
          note             AS "Note",
          user_feedback    AS "User Feedback",
          finished         AS "Finished"
        FROM leads_import
        WHERE country_code = $1
        ORDER BY created_at DESC NULLS LAST, submission_id DESC
      `;
      const rows = await prisma.$queryRawUnsafe(sql, code);
          return res.json(rows || []);
        } catch (err) {
          console.error('GET /admin/galaxy-try/:code/list error', err);
          return res.status(500).json({ error: 'Server error' });
        }
      }
    );

// === GALAXY TRY HR: Import (CSV/XLSX) — upsert s created_at + normalizacija ===
app.post('/admin/galaxy-try/hr/import',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const { rows } = req.body || {};
      if (!Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'No rows provided' });
      }

      const isoOrNull = (v) => {
        if (v == null || v === '') return null;
        const d = new Date(v);
        return isNaN(d) ? null : d.toISOString();
      };
      const numOrNull = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
      const strOrNull = (v) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s === '' ? null : s;
      };
      const serialStr = (v) => {
        if (v == null) return null;
        const s = String(v).trim().replace(/\s+/g, '');
        return s === '' ? null : s;
      };


      let upserted = 0;

      for (const r of rows) {
        if (!r.submission_id) continue;

        // === Normalize created_at, contacted, handover_at ===
        if (r.created_at) {
          let d = String(r.created_at);
          if (d.includes(' ')) d = d.split(' ')[0];
          if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
            const [day, mon, yr] = d.split('-');
            d = `${yr}-${mon}-${day}`;
          }
          r.created_at = new Date(`${d}T00:00:00Z`);
        }
    
        
        if (r.handover_at) {
          let d = String(r.handover_at);
          if (d.includes(' ')) d = d.split(' ')[0];
          if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
            const [day, mon, yr] = d.split('-');
            d = `${yr}-${mon}-${day}`;
          }
          r.handover_at = new Date(`${d}T00:00:00Z`);
        }

        // Normalizacija ulaza
        const finishedRaw = r.finished
        const p = {
          first_name:  strOrNull(r.first_name),
          last_name:   strOrNull(r.last_name),
          email:       strOrNull(r.email),
          phone:       strOrNull(r.phone),
          address:     strOrNull(r.address),
          city:        strOrNull(r.city),
          pickup_city: strOrNull(r.pickup_city),
          created_at:  isoOrNull(r.created_at),   // ⇐ NOVO
          contacted:   isoOrNull(r.contacted),
          handover_at: isoOrNull(r.handover_at),
          days_left:   numOrNull(r.days_left),
          model:       strOrNull(r.model),
          serial:      serialStr(r.serial),
          note:        strOrNull(r.note),
          user_feedback:        strOrNull(r.user_feedback),
          finished:  typeof finishedRaw === 'boolean'
            ? (finishedRaw ? 'Yes' : '')
            : strOrNull(finishedRaw)
        };

        // UPDATE (uključuje created_at)
        const qU = `
          UPDATE leads_import SET
            first_name  = COALESCE($2, first_name),
            last_name   = COALESCE($3, last_name),
            email       = COALESCE($4, email),
            phone       = COALESCE($5, phone),
            address     = COALESCE($6, address),
            city        = COALESCE($7, city),
            pickup_city = COALESCE($8, pickup_city),
            created_at  = COALESCE($9, created_at),
            contacted   = COALESCE($10, contacted),
            handover_at = COALESCE($11, handover_at),
            days_left   = COALESCE($12, days_left),
            model       = COALESCE($13, model),
            serial      = COALESCE($14, serial),
          note        = COALESCE($15, note),
          finished    = COALESCE($16, finished),
          user_feedback        = COALESCE($17, user_feedback),
                       
            updated_at  = NOW()
          WHERE submission_id = $1 AND country_code = 'HR'
        `;
        const vU = [
          r.submission_id,
          p.first_name, p.last_name, p.email, p.phone,
          p.address, p.city, p.pickup_city,
          p.created_at, p.contacted, p.handover_at,
          p.days_left, p.model, p.serial, p.note, p.finished, p.user_feedback
        ];
        const updated = await prisma.$executeRawUnsafe(qU, ...vU);

        // INSERT ako ne postoji (s created_at)
        if (!updated) {
          const qI = `
            INSERT INTO leads_import (
              submission_id, country_code,
              first_name,last_name,email,phone,address,city,pickup_city,
              created_at,contacted,handover_at,days_left,model,serial,note,finished,user_feedback,
              updated_at
            ) VALUES (
              $1,'HR',
              $2,$3,$4,$5,$6,$7,$8,
              $9,$10,$11,$12,$13,$14,$15,$16,$17,
              NOW()
            )
          `;
          const vI = [
            r.submission_id,
            p.first_name, p.last_name, p.email, p.phone,
            p.address, p.city, p.pickup_city,
            p.created_at, p.contacted, p.handover_at,
            p.days_left, p.model, p.serial, p.note, p.finished, p.user_feedback
          ];
          await prisma.$executeRawUnsafe(qI, ...vI);
        }

        upserted++;
      }

      return res.json({ upserted, mode: 'upsert' });
    } catch (e) {
      console.error('Import error', e);
      return res.status(500).json({ error: 'Import error' });
    }
  }
);


// 6) start server
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});

// (opcionalno za testove)
module.exports = app;

// === CREATE USER (admin creates operator/country_admin) ===
// STARI PATH: app.post('/admin/users', ...)
// NOVI PATH:
app.post('/adminusers',
  requireAuth,
  requireRole('superadmin','country_admin'),
  async (req, res) => {
    try {
      let { email, password, role, countryId } = req.body || {};
      email = String(email || '').trim().toLowerCase();
      role = String(role || 'OPERATOR').toUpperCase();

      if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
      }
      if (!['OPERATOR','COUNTRY_ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Ako je caller country_admin, prisilno vežemo na njegovu zemlju
      const caller = req.user || {};
      const callerRole = String(caller.role || '').toUpperCase();
      if (callerRole === 'COUNTRY_ADMIN') {
        if (!caller.countryId) {
          return res.status(403).json({ error: 'Caller has no country bound' });
        }
        countryId = caller.countryId;
      } else {
        if (role !== 'SUPERADMIN' && !countryId) {
          return res.status(400).json({ error: 'countryId is required for non-superadmin users' });
        }
      }

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const created = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,                 // "OPERATOR" | "COUNTRY_ADMIN"
          countryId: countryId ?? null,
        },
        select: { id: true, email: true, role: true, countryId: true, createdAt: true }
      });

      return res.status(201).json({ user: created });
    } catch (err) {
      console.error('POST /adminusers error', err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);

// Dodaj helper na vrh (npr. uz ostale helper funkcije)
function normalizeDateOnly(input) {
  if (input == null || input === "") return null;
  let s = String(input);
  // odbaci vrijeme ako postoji (npr. "YYYY-MM-DD HH:MM:SS" ili ISO)
  if (s.includes(" ")) s = s.split(" ")[0];
  else if (s.includes("T")) s = s.split("T")[0];
  // "DD-MM-YYYY" → "YYYY-MM-DD"
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    s = `${y}-${m}-${d}`;
  }
  // vrati Date na 00:00:00Z
  return new Date(`${s}T00:00:00Z`);
}

// ===== GALAXY TRY: generička LISTA po country code =====
app.get('/admin/galaxy-try/:code/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();

      // mapiranje country -> VIEW
      const VIEW_MAP = {
        HR: 'ui_galaxytry_hr_list',
        SI: 'ui_galaxytry_si_list',
        RS: 'ui_galaxytry_rs_list',
      };

      const view = VIEW_MAP[code];
      if (!view) return res.status(400).json({ error: 'Unknown country code' });

      // dinamičko ime view-a (identifier) mora ići unsafe; vrijednosti idu parametrizirano
      const sql = `SELECT * FROM ${view}`;
      const rows = await prisma.$queryRawUnsafe(sql);

      res.json(rows);
    } catch (err) {
      console.error('GET /admin/galaxy-try/:code/list error', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// === TRY-AND-BUY: LIST po country code (HR/SI/RS)
app.get('/admin/try-and-buy/:code/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Unknown country code' });
      }

      // Vraćamo snake_case ključeve koje frontend očekuje,
      // a "contacted" je "Yes" ako postoji contacted, inače "".
      const sql = `
        SELECT
          submission_id                    AS submission_id,
          first_name                       AS first_name,
          last_name                        AS last_name,
          email                            AS email,
          phone                            AS phone,
          address                          AS address,
          city                             AS city,
          postal_code                      AS postal_code,
          pickup_city                      AS pickup_city,
          created_at                       AS created_at,
          CASE WHEN NULLIF(contacted, '') IS NOT NULL THEN 'Yes' ELSE '' END AS contacted,
          handover_at                      AS handover_at,
          model                            AS model,
          serial                           AS serial,
          note                             AS note,
          finished                          AS finished,
          user_feedback                    AS user_feedback
        FROM public.leads_import
        WHERE country_code = $1
        ORDER BY submission_id DESC
      `;
      const rows = await prisma.$queryRawUnsafe(sql, code);
      return res.json(rows || []);
    } catch (err) {
      console.error('GET /admin/try-and-buy/:code/list error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// === TRY-AND-BUY: PATCH po submission_id i country code ===
// PATCH /admin/try-and-buy/:code/:submission_id
// Body: { email?, phone?, address?, city?, pickup_city?, created_at?, contacted?, handover_at?, days_left?, model?, serial?, note?, finished?, user_feedback? }
app.patch(
  '/admin/try-and-buy/:code/:submission_id',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const sid  = String(req.params.submission_id || '');
      if (!['HR','SI','RS'].includes(code) || !sid) {
        return res.status(400).json({ error: 'Bad request' });
      }

      const ALLOWED = new Set([
        'email','phone','address','city','pickup_city',
        'created_at','contacted','handover_at','days_left',
        'model','serial','note','finished','user_feedback'
      ]);

         // zadrži samo dozvoljena polja koja su poslana
      const input = {};
      for (const [k,v] of Object.entries(req.body || {})) {
        if (!ALLOWED.has(k)) continue;
        if (v == null) { input[k] = null; continue; }
        if (k === 'serial') {
          const s = String(v).trim().replace(/\s+/g,'');
          input[k] = s === '' ? null : s;
        } else if (k === 'model' || k === 'note' || k === 'email' || k === 'phone' || k === 'address' || k === 'city' || k === 'pickup_city') {
          const s = String(v).trim();
          input[k] = s === '' ? null : s;
        } else if (k === 'finished') {
          if (typeof v === 'boolean') {
            input[k] = v ? 'Yes' : '';
          } else {
            input[k] = v;
          }
        } else {
          input[k] = v;
        }
      }

      if (!Object.keys(input).length) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      // === Normalize created_at ===
      if ("created_at" in input) {
        input.created_at = normalizeDateOnly(input.created_at);
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
          country_code     AS "Country Code",
          first_name       AS "First Name",
          last_name        AS "Last Name",
          email            AS "Email",
          phone            AS "Phone",
          address          AS "Address",
          city             AS "City",
          pickup_city      AS "Pickup City",
          created_at       AS "Created At",
          contacted        AS "Contacted At",
          handover_at      AS "Handover At",
          days_left       AS "Days Left",
          model            AS "Model",
          serial          AS "Serial",
          note             AS "Note",
          finished         AS "Finished",
          user_feedback   AS "User Feedback"
      `;
      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('PATCH /admin/try-and-buy/:code/:submission_id error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// === TRY-AND-BUY: CREATE (upsert) po country code (HR/SI/RS) ===
// POST /admin/try-and-buy/:code
// Body: { submission_id?, email, phone, address, city, pickup_city, created_at, contacted, handover_at, days_left, model, serial, note, finished, user_feedback }
app.post(
  '/admin/try-and-buy/:code',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Unknown country code' });
      }

      // Dozvoljena polja koja možemo upisati
      const ALLOWED = new Set([
        'submission_id','email','phone','address','city','pickup_city',
        'created_at','contacted','handover_at','days_left',
        'model','serial','note','finished','user_feedback'
      ]);

      const b = req.body || {};
      const payload = {};
      for (const [k,v] of Object.entries(b)) {
        if (!ALLOWED.has(k)) continue;
        if (k === 'finished' && typeof v === 'boolean') {
          payload[k] = v ? 'Yes' : '';
        } else {
          payload[k] = v ?? null;
        }
      }

      if ('finished' in payload && typeof payload.finished === 'boolean') {
        payload.finished = payload.finished ? 'Yes' : '';
      }

      // submission_id generiramo ako nije poslan
      const submission_id = String(b.submission_id || crypto.randomUUID());

      // === Normalize created_at (remove time, parse date) ===
      if (payload.created_at) {
        let dateStr = String(payload.created_at);
        if (dateStr.includes(' ')) dateStr = dateStr.split(' ')[0];      // drop time if "YYYY-MM-DD HH:MM:SS"
        else if (dateStr.includes('T')) dateStr = dateStr.split('T')[0]; // drop time if ISO string
        // If in DD-MM-YYYY format, convert to YYYY-MM-DD
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
          const [d, m, y] = dateStr.split('-');
          dateStr = `${y}-${m}-${d}`;
        }
        payload.created_at = new Date(`${dateStr}T00:00:00Z`);
      }
      // ...existing normalization for contacted, handover_at...
      if (payload.contacted) payload.contacted = new Date(payload.contacted);
      if (payload.handover_at)  payload.handover_at  = new Date(payload.handover_at);

      const cols = ['submission_id','country_code', ...Object.keys(payload)];
      const vals = [submission_id, code, ...Object.values(payload)];
      const placeholders = cols.map((_,i)=>`$${i+1}`).join(', ');

      const sql = `
        INSERT INTO leads_import (${cols.map(c=>`"${c}"`).join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (submission_id) DO UPDATE
        SET ${Object.keys(payload).map((c,i)=>`"${c}" = EXCLUDED."${c}"`).join(', ')},
            updated_at = NOW()
        RETURNING
          submission_id        AS submission_id,
          country_code         AS country_code,
          first_name           AS first_name,
          last_name            AS last_name,
          email                AS email,
          phone                AS phone,
          address              AS address,
          city                 AS city,
          pickup_city          AS pickup_city,
          created_at           AS created_at,
          contacted       AS contacted,
          handover_at        AS handover_at,
          days_left            AS days_left,
          model                AS model,
          serial               AS serial,
          note                 AS note,
          finished         AS finished,
          user_feedback   AS user_feedback
      `;
      const rows = await prisma.$queryRawUnsafe(sql, ...vals);
      return res.json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('TRY-AND-BUY create error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// === TRY-AND-BUY: DELETE po submission_id i country code ===
// DELETE /admin/try-and-buy/:code/:submission_id
app.delete(
  '/admin/try-and-buy/:code/:submission_id',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      const sid  = String(req.params.submission_id || '').trim();

      // Validacije
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Invalid country code (use HR, SI, or RS).' });
      }
      if (!sid) {
        return res.status(400).json({ error: 'Missing submission_id.' });
      }

      // Brisanje po (submission_id, country_code)
      const sql = `DELETE FROM leads_import WHERE submission_id = $1 AND country_code = $2`;
      const count = await prisma.$executeRawUnsafe(sql, sid, code);

      if (!count || Number(count) === 0) {
        return res.status(404).json({ error: 'Not found.' });
      }

      // Uspjeh: 204 No Content
      return res.status(204).send();
    } catch (err) {
      console.error('DELETE /admin/try-and-buy/:code/:submission_id error', err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);

// === TRY-AND-BUY: lista po country code (HR/SI/RS)
app.get('/admin/try-and-buy/:code/list',
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
          country_code     AS "Country Code",
          first_name       AS "First Name",
          last_name        AS "Last Name",
          email            AS "Email",
          phone            AS "Phone",
          address          AS "Address",
          city             AS "City",
          pickup_city      AS "Pickup City",
          created_at       AS "Created At",
          contacted        AS "Contacted At",
          handover_at      AS "Handover At",
          days_left        AS "Days Left",
          model            AS "Model",
          serial           AS "Serial",
          note             AS "Note",
          finished         AS "Finished",
          user_feedback    AS "User Feedback"
        FROM leads_import
        WHERE country_code = $1
        ORDER BY created_at DESC NULLS LAST, submission_id DESC
      `;
      const rows = await prisma.$queryRawUnsafe(sql, code);
          return res.json(rows || []);
        } catch (err) {
          console.error('GET /admin/try-and-buy/:code/list error', err);
          return res.status(500).json({ error: 'Server error' });
        }
      }
    );

// === TRY-AND-BUY: Import (CSV/XLSX) — upsert s created_at + normalizacija ===
app.post('/admin/try-and-buy/hr/import',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const { rows } = req.body || {};
      if (!Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'No rows provided' });
      }

      const isoOrNull = (v) => {
        if (v == null || v === '') return null;
        const d = new Date(v);
        return isNaN(d) ? null : d.toISOString();
      };
      const numOrNull = (v) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
      const strOrNull = (v) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s === '' ? null : s;
      };
      const serialStr = (v) => {
        if (v == null) return null;
        const s = String(v).trim().replace(/\s+/g, '');
        return s === '' ? null : s;
      };


      let upserted = 0;

      for (const r of rows) {
        if (!r.submission_id) continue;

        // === Normalize created_at, contacted, handover_at ===
        if (r.created_at) {
          let d = String(r.created_at);
          if (d.includes(' ')) d = d.split(' ')[0];
          if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
            const [day, mon, yr] = d.split('-');
            d = `${yr}-${mon}-${day}`;
          }
          r.created_at = new Date(`${d}T00:00:00Z`);
        }
    
        
        if (r.handover_at) {
          let d = String(r.handover_at);
          if (d.includes(' ')) d = d.split(' ')[0];
          if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
            const [day, mon, yr] = d.split('-');
            d = `${yr}-${mon}-${day}`;
          }
          r.handover_at = new Date(`${d}T00:00:00Z`);
        }

        // Normalizacija ulaza
        const finishedRaw = r.finished;
        const p = {
          first_name:  strOrNull(r.first_name),
          last_name:   strOrNull(r.last_name),
          email:       strOrNull(r.email),
          phone:       strOrNull(r.phone),
          address:     strOrNull(r.address),
          city:        strOrNull(r.city),
          pickup_city: strOrNull(r.pickup_city),
          created_at:  isoOrNull(r.created_at),   // ⇐ NOVO
          contacted:   isoOrNull(r.contacted),
          handover_at: isoOrNull(r.handover_at),
          days_left:   numOrNull(r.days_left),
          model:       strOrNull(r.model),
          serial:      serialStr(r.serial),
          note:        strOrNull(r.note),
          finished:      typeof finishedRaw === 'boolean'
            ? (finishedRaw ? 'Yes' : '')
            : strOrNull(finishedRaw),
          user_feedback:        strOrNull(r.user_feedback),
        };

        // UPDATE (uključuje created_at)
        const qU = `
          UPDATE leads_import SET
            first_name  = COALESCE($2, first_name),
            last_name   = COALESCE($3, last_name),
            email       = COALESCE($4, email),
            phone       = COALESCE($5, phone),
            address     = COALESCE($6, address),
            city        = COALESCE($7, city),
            pickup_city = COALESCE($8, pickup_city),
            created_at  = COALESCE($9, created_at),
            contacted   = COALESCE($10, contacted),
            handover_at = COALESCE($11, handover_at),
            days_left   = COALESCE($12, days_left),
            model       = COALESCE($13, model),
            serial      = COALESCE($14, serial),
            note        = COALESCE($15, note),
            finished    = COALESCE($16, finished),
            user_feedback        = COALESCE($17, user_feedback),
            updated_at  = NOW()
          WHERE submission_id = $1 AND country_code = 'HR'
        `;
        const vU = [
          r.submission_id,
          p.first_name, p.last_name, p.email, p.phone,
          p.address, p.city, p.pickup_city,
          p.created_at, p.contacted, p.handover_at,
          p.days_left, p.model, p.serial, p.note, p.finished, p.user_feedback
        ];
        const updated = await prisma.$executeRawUnsafe(qU, ...vU);

        // INSERT ako ne postoji (s created_at)
        if (!updated) {
          const qI = `
            INSERT INTO leads_import (
              submission_id, country_code,
              first_name,last_name,email,phone,address,city,pickup_city,
              created_at,contacted,handover_at,days_left,model,serial,note,finished,user_feedback,
              updated_at
            ) VALUES (
              $1,'HR',
              $2,$3,$4,$5,$6,$7,$8,
              $9,$10,$11,$12,$13,$14,$15,$16,$17,
              NOW()
            )
          `;
          const vI = [
            r.submission_id,
            p.first_name, p.last_name, p.email, p.phone,
            p.address, p.city, p.pickup_city,
            p.created_at, p.contacted, p.handover_at,
            p.days_left, p.model, p.serial, p.note, p.finished, p.user_feedback
          ];
          await prisma.$executeRawUnsafe(qI, ...vI);
        }

        upserted++;
      }

      return res.json({ upserted, mode: 'upsert' });
    } catch (e) {
      console.error('Import error', e);
      return res.status(500).json({ error: 'Import error' });
    }
  }
);

// helper funkcija koja vraća samo datum u ISO formatu ("YYYY-MM-DD")
function onlyDateISO(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}