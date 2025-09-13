const express = require('express');
const router = express.Router();

// In-memory stub storage
let records = [];

// GET /api/trybuy - return all records
router.get('/', (_req, res) => {
  res.json(records);
});

// PATCH /api/trybuy/:missionId - partial update
router.patch('/:missionId', (req, res) => {
  const id = String(req.params.missionId);
  const idx = records.findIndex((r) => r.submission_id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  records[idx] = { ...records[idx], ...req.body };
  res.json(records[idx]);
});

// DELETE /api/trybuy - bulk delete by missionIds
router.delete('/', (req, res) => {
  const ids = Array.isArray(req.body?.missionIds) ? req.body.missionIds.map(String) : [];
  records = records.filter((r) => !ids.includes(r.submission_id));
  res.json({ deleted: ids });
});

module.exports = router;

