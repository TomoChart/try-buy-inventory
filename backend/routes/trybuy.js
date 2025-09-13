const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_FILE = path.join(__dirname, '../trybuy-data.json');
let db = {};
try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  db = {};
}
function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

router.get('/:country', (req, res) => {
  const c = String(req.params.country || '').toLowerCase();
  res.json(db[c] || []);
});

router.post('/:country', (req, res) => {
  const c = String(req.params.country || '').toLowerCase();
  const arr = Array.isArray(req.body) ? req.body : [];
  db[c] = db[c] || [];
  const map = new Map(db[c].map((r) => [String(r.submission_id), r]));
  arr.forEach((rec) => {
    const id = String(rec.submission_id);
    const existing = map.get(id);
    map.set(id, existing ? { ...existing, ...rec } : rec);
  });
  db[c] = Array.from(map.values());
  save();
  res.json({ ok: true });
});

router.patch('/:country/:missionId', (req, res) => {
  const c = String(req.params.country || '').toLowerCase();
  const id = String(req.params.missionId);
  const arr = db[c] || [];
  const idx = arr.findIndex((r) => String(r.submission_id) === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  arr[idx] = { ...arr[idx], ...req.body };
  db[c] = arr;
  save();
  res.json(arr[idx]);
});

router.delete('/:country', (req, res) => {
  const c = String(req.params.country || '').toLowerCase();
  const ids = Array.isArray(req.body?.missionIds) ? req.body.missionIds.map(String) : [];
  db[c] = (db[c] || []).filter((r) => !ids.includes(String(r.submission_id)));
  save();
  res.json({ deleted: ids });
});

module.exports = router;
