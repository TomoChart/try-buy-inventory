// routes/admin.hr.js
const router = require('express').Router();
const { Pool } = require('pg');
// Ako koristiš svoj auth middleware, prilagodi putanju:
const auth = require('../middleware/auth'); // ili (req,res,next)=>next()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render PG
});

// Devices (HR) – lista 5 stupaca
router.get('/admin/devices/hr/list', auth(['COUNTRYADMIN','SUPERADMIN']), async (req, res) => {
  try {
    const q = 'SELECT * FROM ui_devices_hr_list ORDER BY "Model" ASC, "Status" ASC';
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'DB error' });
  }
});

// Devices (HR) – detalj po serial_number
router.get('/admin/devices/hr/:serial', auth(['COUNTRYADMIN','SUPERADMIN']), async (req, res) => {
  try {
    const q = 'SELECT * FROM ui_devices_hr_detail WHERE serial_number = $1';
    const { rows } = await pool.query(q, [req.params.serial]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'DB error' });
  }
});

// Galaxy Try (HR) – lista
router.get('/admin/galaxy-try/hr/list', auth(['COUNTRYADMIN','SUPERADMIN']), async (req, res) => {
  try {
    const q = 'SELECT * FROM ui_galaxytry_hr_list ORDER BY "Datum prijave" DESC NULLS LAST';
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'DB error' });
  }
});

// Galaxy Try (HR) – detalj po submission_id
router.get('/admin/galaxy-try/hr/:id', auth(['COUNTRYADMIN','SUPERADMIN']), async (req, res) => {
  try {
    const q = 'SELECT * FROM ui_galaxytry_hr_detail WHERE submission_id = $1';
    const { rows } = await pool.query(q, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'DB error' });
  }
});

// Galaxy Try (HR) – CSV import (upsert)
router.post('/admin/galaxy-try/hr/import', auth(['COUNTRYADMIN','SUPERADMIN']), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'No rows provided' });
    }
    let upserted = 0;
    for (const r of rows) {
      if (!r.submission_id) continue;
      // Upsert logika: pokušaj update, ako ne postoji onda insert
      const qUpdate = `UPDATE galaxy_try_hr SET 
        first_name = $2, last_name = $3, email = $4, phone = $5, address = $6, city = $7, pickup_city = $8,
        date_contacted = $9, date_handover = $10, model = $11, serial_number = $12, note = $13
        WHERE submission_id = $1`;
      const vals = [
        r.submission_id, r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.pickup_city,
        r.date_contacted, r.date_handover, r.model, r.serial_number, r.note
      ];
      const result = await pool.query(qUpdate, vals);
      if (result.rowCount === 0) {
        // Insert ako ne postoji
        const qInsert = `INSERT INTO galaxy_try_hr (
          submission_id, first_name, last_name, email, phone, address, city, pickup_city,
          date_contacted, date_handover, model, serial_number, note
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;
        await pool.query(qInsert, vals);
      }
      upserted++;
    }
    res.json({ upserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Import error' });
  }
});

module.exports = router;
