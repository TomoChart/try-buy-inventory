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
          address = COALESCE($3, address),
          city = COALESCE($4, city),
          pickup_city = COALESCE($5, pickup_city),
          date_contacted = COALESCE($6, date_contacted),
          date_handover = COALESCE($7, date_handover),
          model = COALESCE($8, model),
          serial_number = COALESCE($9, serial_number),
          note = COALESCE($10, note)
        WHERE submission_id = $11 AND country_code = $12
        RETURNING
          submission_id, email, phone, address, city, pickup_city, date_contacted, date_handover, model, serial_number, note
      `;

      const vals = [
        payload.email ?? null,
        payload.phone ?? null,
        payload.address ?? null,
        payload.city ?? null,
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
        'date_contacted','date_handover',
        'model','serial_number','note'
      ]);

      const b = req.body || {};
      const payload = {};
      for (const [k,v] of Object.entries(b)) {
        if (ALLOWED.has(k)) payload[k] = v ?? null;
      }

      // submission_id generiramo ako nije poslan
      const submission_id = String(b.submission_id || crypto.randomUUID());

      // normalizacija datuma (ako su došli kao "YYYY-MM-DD")
      if (payload.date_contacted) payload.date_contacted = new Date(payload.date_contacted);
      if (payload.date_handover)  payload.date_handover  = new Date(payload.date_handover);

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
          first_name           AS first_name,
          last_name            AS last_name,
          email                AS email,
          phone                AS phone,
          address              AS address,
          city                 AS city,
          pickup_city          AS pickup_city,
          created_at           AS created_at,
          date_contacted       AS date_contacted,
          date_handover        AS date_handover,
          model                AS model,
          serial_number        AS serial_number,
          note                 AS note
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
          console.error('GET /admin/galaxy-try/:code/list error', err);
          return res.status(500).json({ error: 'Server error' });
        }
      }
    );

// === GALAXY TRY HR: CSV import (upsert) ===
app.post('/admin/galaxy-try/hr/import', requireAuth, requireRole('country_admin','superadmin'), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'No rows provided' });
    }
    let upserted = 0;
    for (const r of rows) {
      if (!r.submission_id) continue;
      // Upsert logika: pokušaj update, ako ne postoji onda insert
      const qUpdate = `UPDATE leads_import SET 
        first_name = $2, last_name = $3, email = $4, phone = $5, address = $6, city = $7, pickup_city = $8,
        date_contacted = $9, date_handover = $10, model = $11, serial_number = $12, note = $13
        WHERE submission_id = $1 AND country_code = 'HR'`;
      const vals = [
        r.submission_id, r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.pickup_city,
        r.date_contacted, r.date_handover, r.model, r.serial_number, r.note
      ];
      const result = await prisma.$executeRawUnsafe(qUpdate, ...vals);
      if (result === 0) {
        // Insert ako ne postoji
        const qInsert = `INSERT INTO leads_import (
          submission_id, country_code, first_name, last_name, email, phone, address, city, pickup_city,
          date_contacted, date_handover, model, serial_number, note
        ) VALUES ($1,'HR',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;
        await prisma.$executeRawUnsafe(qInsert, r.submission_id, r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.pickup_city,
          r.date_contacted, r.date_handover, r.model, r.serial_number, r.note);
      }
      upserted++;
    }
    res.json({ upserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Import error' });
  }
});

// === GALAXY TRY HR: CSV import (upsert) ===
app.post('/admin/galaxy-try/hr/import', requireAuth, requireRole('country_admin','superadmin'), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'No rows provided' });
    }
    let upserted = 0;
    for (const r of rows) {
      if (!r.submission_id) continue;
      // Upsert logika: pokušaj update, ako ne postoji onda insert
      const qUpdate = `UPDATE leads_import SET 
        first_name = $2, last_name = $3, email = $4, phone = $5, address = $6, city = $7, pickup_city = $8,
        date_contacted = $9, date_handover = $10, model = $11, serial_number = $12, note = $13
        WHERE submission_id = $1 AND country_code = 'HR'`;
      const vals = [
        r.submission_id, r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.pickup_city,
        r.date_contacted, r.date_handover, r.model, r.serial_number, r.note
      ];
      const result = await prisma.$executeRawUnsafe(qUpdate, ...vals);
      if (result === 0) {
        // Insert ako ne postoji
        const qInsert = `INSERT INTO leads_import (
          submission_id, country_code, first_name, last_name, email, phone, address, city, pickup_city,
          date_contacted, date_handover, model, serial_number, note
        ) VALUES ($1,'HR',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;
        await prisma.$executeRawUnsafe(qInsert, r.submission_id, r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.pickup_city,
          r.date_contacted, r.date_handover, r.model, r.serial_number, r.note);
      }
      upserted++;
    }
    res.json({ upserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Import error' });
  }
});

// 6) start server
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});

// (opcionalno za testove)
module.exports = app;

/**
 * Create user (operator/admin)
 * Access: SUPERADMIN (može sve) ili country_admin (ograničeno na svoju zemlju)
 * Body:
 *  - email (string, required)
 *  - password (string, required)
 *  - role (string: "OPERATOR" | "COUNTRY_ADMIN", default "OPERATOR")
 *  - countryId (number | null)  -> required za COUNTRY_ADMIN i OPERATOR
 */
app.post('/admin/users',
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

      // Ako je caller country_admin, mora kreirati unutar svoje zemlje
      const caller = req.user || {};
      const callerRole = String(caller.role || '').toUpperCase();
      if (callerRole === 'COUNTRY_ADMIN') {
        if (!caller.countryId) {
          return res.status(403).json({ error: 'Caller has no country bound' });
        }
        countryId = caller.countryId; // force na svoju zemlju
      } else {
        // SUPERADMIN: ako je role != SUPERADMIN, zahtijevaj countryId
        if (role !== 'SUPERADMIN' && !countryId) {
          return res.status(400).json({ error: 'countryId is required for non-superadmin users' });
        }
      }

      // jedinstveni email
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const created = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,           // "OPERATOR" | "COUNTRY_ADMIN"
          countryId: countryId ?? null,
        },
        select: { id: true, email: true, role: true, countryId: true, createdAt: true }
      });

      return res.status(201).json({ user: created });
    } catch (err) {
      console.error('POST /admin/users error', err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);