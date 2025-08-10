import { Router } from "express";
const router = Router();

/**
 * Loans: veza application ↔ device
 * Rules: 14 dana max, return_due = issued_at + 14d
 */
const loans = [];

router.get("/", (req, res) => {
  const { country, status } = req.query; // status: ON_LOAN | RETURNED
  let out = loans;
  if (country) out = out.filter(l => l.country === country);
  if (status)  out = out.filter(l => l.status === status);
  res.json({ items: out });
});

router.post("/", (req, res) => {
  const { country, application_id, device_id, issued_at } = req.body || {};
  if (!country || !application_id || !device_id) return res.status(400).json({ error: "country, application_id, device_id required" });
  const issued = issued_at ? new Date(issued_at) : new Date();
  const return_due = new Date(issued.getTime() + 14 * 24 * 60 * 60 * 1000);
  const item = {
    id: `l${Date.now()}`, country, application_id, device_id,
    issued_at: issued.toISOString(),
    return_due: return_due.toISOString(),
    returned_at: null,
    condition: null, comment: "", status: "ON_LOAN"
  };
  loans.push(item);
  res.status(201).json(item);
});

router.patch("/:id/return", (req, res) => {
  const i = loans.findIndex(l => l.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  const { condition = "OK", comment = "" } = req.body || {};
  loans[i] = {
    ...loans[i],
    returned_at: new Date().toISOString(),
    condition, comment, status: "RETURNED"
  };
  res.json(loans[i]);
});

export default router;
