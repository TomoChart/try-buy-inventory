/**
 * Try-Buy Inventory API (single-file entry)
 * Express inicijalizacija prije ruta, CORS, Prisma, health, auth,
 * Devices import, Galaxy Try (list/patch/post/delete/detail + CSV import)
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

// --- app & parsers ---
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- CORS ---
const ALLOWED = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (ALLOWED.length === 0) {
  ALLOWED.push('https://try-buy-inventory.vercel.app', 'http://localhost:3000');
}
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- prisma & helpers ---
const prisma = new PrismaClient();

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
    const userRole = String(req.user?.role || req.user?.Role || '').toUpperCase();
    if (!userRole || !allowed.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// --- health ---
app.get('/', (_req,res)=>res.send({status:'OK'}));
app.get('/healthz', (_req,res)=>res.status(200).send({status:'healthy'}));

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

// ===== Countries =====
app.get('/countries', async (_req, res) => {
  try {
    const countries = await prisma.country.findMany({ select: { id:true, code:true }, orderBy: { code:'asc' } });
    res.json(countries);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// ===== DEVICES: CSV JSON IMPORT =====
app.post(
  "/admin/devices/:code/import",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    const mode = (String(req.query.mode || "upsert").toLowerCase());
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!['HR','SI','RS'].includes(code)) return res.status(400).json({ error: "Unknown country code" });
    if (!rows.length) return res.status(400).json({ error: "No rows" });
    if (rows.length > 5000) return res.status(413).json({ error: "Too many rows" });

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
        await prisma.$executeRawUnsafe("DELETE FROM devices_import WHERE country_code=$1", code);
      }
      let upserted = 0;
      for (const r of rows) {
        const v = normalize(r);
        if (!v.serial_number) continue;
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

// ===== GALAXY TRY: LIST =====
app.get('/admin/galaxy-try/:code/list',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Unknown country code' });
      }
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

// ===== GALAXY TRY: PATCH (edit) =====
app.patch(
  "/admin/galaxy-try/:code/:id",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      const id = String(req.params.id || "");
      if (!['HR','SI','RS'].includes(code) || !id) return res.status(400).json({ error: "Bad request" });

      const allowed = [
        "email","phone","address","city",
        "pickup_city","date_contacted","date_handover",
        "model","serial_number","note",
      ];
      const payload = {};
      for (const k of allowed) if (k in req.body) payload[k] = req.body[k] ?? null;
      if (!Object.keys(payload).length) return res.status(400).json({ error: "No editable fields provided" });

      const isoOrNull = (v) => v == null || v === "" ? null : (new Date(v)).toString() !== "Invalid Date" ? v : null;
      if ("date_contacted" in payload) payload.date_contacted = isoOrNull(payload.date_contacted);
      if ("date_handover"  in payload) payload.date_handover  = isoOrNull(payload.date_handover);

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
        id, code,
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

// ===== GALAXY TRY: POST (create/upsert single) =====
app.post('/admin/galaxy-try/:code',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase();
      if (!['HR','SI','RS'].includes(code)) {
        return res.status(400).json({ error: 'Unknown country code' });
      }
      const ALLOWED = new Set([
        'first_name','last_name','email','phone',
        'address','city','pickup_city',
        'date_contacted','date_handover',
        'model','serial_number','note'
      ]);
      const b = req.body || {};
      const payload = {};
      for (const [k,v] of Object.entries(b)) if (ALLOWED.has(k)) payload[k] = v ?? null;

      const submission_id = String(b.submission_id || crypto.randomUUID());
      if (payload.date_contacted) payload.date_contacted = new Date(payload.date_contacted);
      if (payload.date_handover)  payload.date_handover  = new Date(payload.date_handover);

      const cols = ['submission_id','country_code', ...Object.keys(payload)];
      const vals = [submission_id, code, ...Object.values(payload)];
      const placeholders = cols.map((_,i)=>`$${i+1}`).join(', ');

      const sql = `
        INSERT INTO leads_import (${cols.map(c=>`"${c}"`).join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (submission_id) DO UPDATE
        SET ${Object.keys(payload).map((c)=>`"${c}" = EXCLUDED."${c}"`).join(', ')},
            updated_at = NOW()
        RETURNING
          submission_id, first_name, last_name, email, phone, address, city, pickup_city,
          created_at, date_contacted, date_handover, model, serial_number, note
      `;
      const rows = await prisma.$queryRawUnsafe(sql, ...vals);
      return res.json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('GT create error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ===== GALAXY TRY: DELETE =====
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

// ===== GALAXY TRY: DETAIL (HR) =====
app.get('/admin/galaxy-try/hr/:id',
  requireAuth, requireRole('country_admin','superadmin'),
  async (req, res) => {
    const q = 'SELECT * FROM ui_galaxytry_hr_detail WHERE submission_id=$1';
    const r = await prisma.$queryRawUnsafe(q, req.params.id);
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  }
);

// ===== GALAXY TRY: CSV JSON IMPORT =====
app.post(
  "/admin/galaxy-try/:code/import",
  requireAuth,
  requireRole("country_admin", "superadmin"),
  async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    const mode = (String(req.query.mode || "upsert").toLowerCase());
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!['HR','SI','RS'].includes(code)) return res.status(400).json({ error: "Unknown country code" });
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
        await prisma.$executeRawUnsafe("DELETE FROM leads_import WHERE country_code=$1", code);
      }
      let upserted = 0;
      for (const r of rows) {
        const v = normalize(r);
        if (!v.submission_id) continue;
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

// --- listen ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port', PORT, 'CORS_ORIGINS:', ALLOWED);
});

// graceful shutdown
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });