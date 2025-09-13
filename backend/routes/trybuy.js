const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '..', 'trybuy-data.json');

let records = [];
try {
  records = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  records = [];
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

// GET /api/trybuy/:country - return all records (country ignored for now)
router.get('/:country', (_req, res) => {
  res.json(records);
});

// POST /api/trybuy/:country - bulk upsert
router.post('/:country', (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : [];
  arr.forEach((r) => {
    const idx = records.findIndex((rec) => rec.submission_id === r.submission_id);
    if (idx === -1) records.push(r);
    else records[idx] = { ...records[idx], ...r };
  });
  save();
  res.json({ upserted: arr.length });
});

// PATCH /api/trybuy/:country/:missionId - partial update
router.patch('/:country/:missionId', (req, res) => {
  const id = String(req.params.missionId);
  const idx = records.findIndex((r) => r.submission_id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  records[idx] = { ...records[idx], ...req.body };
  save();
  res.json(records[idx]);
});

// DELETE /api/trybuy/:country - bulk delete by missionIds
router.delete('/:country', (req, res) => {
  const ids = Array.isArray(req.body?.missionIds) ? req.body.missionIds.map(String) : [];
  records = records.filter((r) => !ids.includes(r.submission_id));
  save();
  res.json({ deleted: ids });
});

module.exports = router;

