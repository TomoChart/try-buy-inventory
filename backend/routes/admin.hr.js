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

module.exports = router;